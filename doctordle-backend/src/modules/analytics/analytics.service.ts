import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';

type AnalyticsResponse<T> = {
  data: T;
  meta: {
    generatedAt: number;
    count: number;
  };
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async getTopWrongGuesses(limit = 10): Promise<AnalyticsResponse<Array<{ guess: string; count: number }>>> {
    return this.runQuery('top-wrong', async () => {
      const rows = await this.prisma.$queryRaw<Array<{ guess: string; count: bigint }>>(
        Prisma.sql`
          SELECT guess, COUNT(*) as count
          FROM "Attempt"
          WHERE result = 'wrong'
          GROUP BY guess
          ORDER BY count DESC
          LIMIT ${Math.max(1, limit)}
        `,
      );

      return rows.map((row) => ({
        guess: row.guess,
        count: Number(row.count),
      }));
    });
  }

  async getAccuracyPerCase(): Promise<AnalyticsResponse<Array<{ caseId: string; accuracy: number; attempts: number }>>> {
    return this.runQuery('accuracy', async () => {
      const rows = await this.prisma.$queryRaw<
        Array<{ caseId: string; accuracy: number | string | null; attempts: bigint }>
      >(
        Prisma.sql`
          SELECT
            "caseId" as "caseId",
            AVG(CASE WHEN result = 'correct' THEN 1 ELSE 0 END) as accuracy,
            COUNT(*) as attempts
          FROM "Attempt"
          GROUP BY "caseId"
        `,
      );

      return rows.map((row) => ({
        caseId: row.caseId,
        accuracy: Number(row.accuracy ?? 0),
        attempts: Number(row.attempts),
      }));
    });
  }

  async getSignalStats(): Promise<AnalyticsResponse<Array<{ embeddingAvg: number; fuzzyAvg: number; ontologyAvg: number }>>> {
    return this.runQuery('signals', async () => {
      const rows = await this.prisma.$queryRaw<
        Array<{
          embedding_avg: number | string | null;
          fuzzy_avg: number | string | null;
          ontology_avg: number | string | null;
        }>
      >(
        Prisma.sql`
          SELECT
            AVG((signals->>'embedding')::float) as embedding_avg,
            AVG((signals->>'fuzzy')::float) as fuzzy_avg,
            AVG((signals->'ontology'->>'score')::float) as ontology_avg
          FROM "Attempt"
        `,
      );

      return rows.map((row) => ({
        embeddingAvg: Number(row.embedding_avg ?? 0),
        fuzzyAvg: Number(row.fuzzy_avg ?? 0),
        ontologyAvg: Number(row.ontology_avg ?? 0),
      }));
    });
  }

  async getFallbackRate(): Promise<AnalyticsResponse<Array<{ fallbackRate: number }>>> {
    return this.runQuery('fallback-rate', async () => {
      const rows = await this.prisma.$queryRaw<Array<{ fallback_rate: number | string | null }>>(
        Prisma.sql`
          SELECT
            COALESCE(
              COUNT(*) FILTER (WHERE (signals->>'retrievalMode') = 'fallback')::float
              / NULLIF(COUNT(*), 0),
              0
            ) as fallback_rate
          FROM "Attempt"
        `,
      );

      return rows.map((row) => ({
        fallbackRate: Number(row.fallback_rate ?? 0),
      }));
    });
  }

  async getAttemptsOverTime(): Promise<
    AnalyticsResponse<Array<{ time: string; attempts: number }>>
  > {
    return this.runQuery('attempts-over-time', async () => {
      const rows = await this.prisma.$queryRaw<Array<{ time: Date; attempts: bigint }>>(
        Prisma.sql`
          SELECT
            DATE_TRUNC('hour', "createdAt") as time,
            COUNT(*) as attempts
          FROM "Attempt"
          GROUP BY time
          ORDER BY time ASC
        `,
      );

      return rows.map((row) => ({
        time: row.time.toISOString(),
        attempts: Number(row.attempts),
      }));
    });
  }

  async getDashboard(): Promise<{
    topWrong: AnalyticsResponse<Array<{ guess: string; count: number }>>;
    accuracy: AnalyticsResponse<Array<{ caseId: string; accuracy: number; attempts: number }>>;
    signals: AnalyticsResponse<Array<{ embeddingAvg: number; fuzzyAvg: number; ontologyAvg: number }>>;
    fallback: AnalyticsResponse<Array<{ fallbackRate: number }>>;
    attemptsOverTime: AnalyticsResponse<Array<{ time: string; attempts: number }>>;
  }> {
    const [topWrong, accuracy, signals, fallback, attemptsOverTime] =
      await Promise.all([
        this.getTopWrongGuesses(),
        this.getAccuracyPerCase(),
        this.getSignalStats(),
        this.getFallbackRate(),
        this.getAttemptsOverTime(),
      ]);

    return {
      topWrong,
      accuracy,
      signals,
      fallback,
      attemptsOverTime,
    };
  }

  private async runQuery<T>(
    queryName: string,
    run: () => Promise<T>,
  ): Promise<AnalyticsResponse<T>> {
    const start = performance.now();

    try {
      const data = await run();
      const latency = performance.now() - start;
      this.metrics.observe('analytics.query.latency', latency);
      this.logger.info(
        {
          queryName,
          latency,
        },
        'analytics.query.success',
      );

      return {
        data,
        meta: {
          generatedAt: Date.now(),
          count: Array.isArray(data) ? data.length : 1,
        },
      };
    } catch (error) {
      this.metrics.increment('analytics.query.error');
      this.logger.error(
        {
          queryName,
          error,
        },
        'analytics.query.failed',
      );
      throw error;
    }
  }
}
