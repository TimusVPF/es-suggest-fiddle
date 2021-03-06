import { ApiResponse, Client } from '@elastic/elasticsearch';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ESSearchService } from '../../../core/es/services/es.service';
import { WithSearchMeta } from '../../../core/helpers/search.meta';
import { Article } from '../entities/article.entity';
import { TitleSearchUtility } from '../entities/search_utility';
import { ParseArticleService } from './article.parse.service';

@Injectable()
export class SearchArticleService {
    private esClient: Client;

    public constructor(
        @InjectRepository(Article) private articleRepository: Repository<Article>,
        @Inject(forwardRef(() => ParseArticleService)) private readonly parseService: ParseArticleService,
        esService: ESSearchService,
    ) {
        this.esClient = esService.getClient();
    }

    public async autocompleteTitle(prefix: string): Promise<TitleSearchUtility[]> {
        const result: ApiResponse = await this.esClient.search({
            body: {
                query: {
                    multi_match: {
                        fields: [
                            'titleCompletion',
                            'titleCompletion._2gram',
                            'titleCompletion._3gram',
                        ],
                        query: prefix,
                        type: 'bool_prefix',
                    },
                },
            },
        });
        return this.parseService.parseArticlesFromESBody(result.body);
    }

    public async searchArticleByTitle(title: string): Promise<WithSearchMeta<Article>> {
        const result: ApiResponse = await this.esClient.search({
            body: {
                query: {
                    match: { title },
                },
                suggest: {
                    suggest_title: {
                        term: {
                            field: 'title',
                        },
                        text: title,
                    },
                },
            },
        });
        const articles = this.parseService.parseArticlesFromESBody(result.body);
        const suggestions = this.parseService.parseSuggestionsFromESBody(result.body, title);
        return {
            content: articles,
            meta: {
                count: result.body.hits.total.value,
                suggest: suggestions,
            },
        };
    }
}
