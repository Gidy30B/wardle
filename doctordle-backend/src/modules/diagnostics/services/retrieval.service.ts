import { Injectable } from '@nestjs/common';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';
import { PrismaService } from '../../../core/db/prisma.service';
import { AppLoggerService } from '../../../core/logger/app-logger.service';
import { MetricsService } from '../../../core/logger/metrics.service';
import { EmbeddingService } from '../../../infra/embedding/embedding.service';
import { OntologyService } from '../../knowledge/ontology.service';
import { SynonymService } from '../../knowledge/synonym.service';
import { fuzzySimilarity } from './fuzzy';

export type RetrievalCandidate = {
  diagnosisId: string;
  diagnosis: string;
  distance: number;
  embeddingSimilarity: number;
  fuzzyScore: number;
  ontologyScore: number;
  rerankScore: number;
  mode: 'vector' | 'fallback';
};

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly cacheService: RedisCacheService,
    private readonly logger: AppLoggerService,
    private readonly metricsService: MetricsService,
    private readonly synonymService: SynonymService,
    private readonly ontologyService: OntologyService,
  ) {}

  async retrieveTopK(
    query: string,
    answerForRerank?: string,
    topK = 5,
  ): Promise<RetrievalCandidate[]> {
    const cached = await this.cacheService.get(
      `retrieval:${query}:${answerForRerank ?? ''}:${topK}`,
    );
    if (cached) {
      this.metricsService.recordCacheHit(true);
      const parsed = this.parseCandidates(cached);
      if (parsed) {
        return parsed;
      }
    } else {
      this.metricsService.recordCacheHit(false);
    }

    try {
      const queryEmbedding = await this.embeddingService.embed(query);
      const vectorLiteral = this.toVectorLiteral(queryEmbedding);
      const rows = await this.prismaService.$queryRawUnsafe<
        Array<{ diagnosisId: string; distance: number }>
      >(
        `
          SELECT "diagnosisId", MIN(vector <-> $1::vector) AS distance
          FROM "DiagnosisEmbedding"
          GROUP BY "diagnosisId"
          ORDER BY distance ASC
          LIMIT $2
        `,
        vectorLiteral,
        topK,
      );

      if (!rows.length) {
        this.metricsService.increment('retrieval.fallback');
        this.logger.warn(
          {
            query,
            topK,
          },
          'retrieval.vector_empty_fallback',
        );
        return this.fallbackTopK(query, answerForRerank, topK);
      }

      const ids = rows.map((row) => row.diagnosisId);
      const diagnoses = await this.prismaService.diagnosis.findMany({
        where: { id: { in: ids } },
        include: { synonyms: true },
      });
      const diagnosisById = new Map(diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]));

      const candidates = rows
        .map((row) => {
          const diagnosis = diagnosisById.get(row.diagnosisId);
          if (!diagnosis) {
            return null;
          }

          const synonymSimilarity = diagnosis.synonyms.reduce((best, synonym) => {
            return Math.max(best, fuzzySimilarity(query, synonym.term));
          }, 0);
          const nameSimilarity = fuzzySimilarity(query, diagnosis.name);
          const fuzzyScore = Math.max(nameSimilarity, synonymSimilarity);
          const embeddingSimilarity = this.toSimilarity(row.distance);
          const ontologyScore = answerForRerank
            ? this.ontologyService.scoreRelationship(
                this.synonymService.resolve(diagnosis.name),
                this.synonymService.resolve(answerForRerank),
              ).score
            : 0;
          const rerankScore =
            embeddingSimilarity * 0.7 + fuzzyScore * 0.2 + ontologyScore * 0.1;

          return {
            diagnosisId: diagnosis.id,
            diagnosis: diagnosis.name,
            distance: Number(row.distance),
            embeddingSimilarity,
            fuzzyScore,
            ontologyScore,
            rerankScore,
            mode: 'vector',
          };
        })
        .filter((candidate): candidate is RetrievalCandidate => candidate !== null)
        .sort((left, right) => right.rerankScore - left.rerankScore)
        .slice(0, topK);

      await this.cacheService.set(
        `retrieval:${query}:${answerForRerank ?? ''}:${topK}`,
        JSON.stringify(candidates),
        120,
      );

      return candidates;
    } catch (error) {
      this.metricsService.increment('retrieval.fallback');
      this.logger.error(
        {
          query,
          topK,
          error,
        },
        'retrieval.vector_failed_fallback',
      );
      return this.fallbackTopK(query, answerForRerank, topK);
    }
  }

  private async fallbackTopK(
    query: string,
    answerForRerank?: string,
    topK = 5,
  ): Promise<RetrievalCandidate[]> {
    const diagnoses = await this.prismaService.diagnosis.findMany({
      include: {
        synonyms: {
          select: {
            term: true,
          },
        },
      },
      take: Math.max(topK * 3, 20),
    });

    return diagnoses
      .map((diagnosis) => {
        const synonyms = diagnosis.synonyms.map((synonym) => synonym.term);
        const embeddingTexts = [diagnosis.name, ...synonyms];
        const embeddingSimilarity = embeddingTexts.reduce((best, text) => {
          return Math.max(best, fuzzySimilarity(query, text));
        }, 0);

        const synonymSimilarity = synonyms.reduce((best, synonym) => {
          return Math.max(best, fuzzySimilarity(query, synonym));
        }, 0);

        const nameSimilarity = fuzzySimilarity(query, diagnosis.name);
        const fuzzyScore = Math.max(nameSimilarity, synonymSimilarity);

        const ontologyScore = answerForRerank
          ? this.ontologyService.scoreRelationship(
              this.synonymService.resolve(diagnosis.name),
              this.synonymService.resolve(answerForRerank),
            ).score
          : 0;

        const rerankScore =
          embeddingSimilarity * 0.7 + fuzzyScore * 0.2 + ontologyScore * 0.1;

        return {
          diagnosisId: diagnosis.id,
          diagnosis: diagnosis.name,
          distance: 1 - embeddingSimilarity,
          embeddingSimilarity,
          fuzzyScore,
          ontologyScore,
          rerankScore,
          mode: 'fallback' as const,
        };
      })
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);
  }

  private toVectorLiteral(values: number[]): string {
    return `[${values.map((value) => Number(value).toFixed(10)).join(',')}]`;
  }

  private toSimilarity(distance: number): number {
    const raw = 1 - Number(distance);
    if (raw < 0) {
      return 0;
    }
    if (raw > 1) {
      return 1;
    }
    return raw;
  }

  private parseCandidates(raw: string): RetrievalCandidate[] | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return null;
      }

      return parsed.filter((candidate): candidate is RetrievalCandidate => {
        return (
          typeof candidate === 'object' &&
          candidate !== null &&
          'diagnosis' in candidate &&
          'diagnosisId' in candidate &&
          'distance' in candidate &&
          'embeddingSimilarity' in candidate &&
          'fuzzyScore' in candidate &&
          'ontologyScore' in candidate &&
          'rerankScore' in candidate
        );
      });
    } catch {
      return null;
    }
  }
}
