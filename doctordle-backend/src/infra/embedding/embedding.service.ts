import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { getEnv } from '../../core/config/env.validation';

export const EMBEDDING_DIMENSION = 1536;

@Injectable()
export class EmbeddingService {
  private readonly env = getEnv();
  private readonly openaiClient?: OpenAI;
  private readonly embeddingModel = this.env.EMBEDDING_MODEL;

  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly logger: AppLoggerService,
    private readonly metricsService: MetricsService,
  ) {
    if (this.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });
    }
  }

  async embed(text: string): Promise<number[]> {
    const normalizedText = this.normalize(text);
    const cacheKey = `embed:${normalizedText}`;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      this.metricsService.recordCacheHit(true);
      try {
        const parsed = this.parseEmbedding(cached);
        if (parsed) {
          return this.validateEmbedding(parsed);
        }
      } catch (error) {
        this.logger.warn(
          {
            cacheKey,
            error,
          },
          'embedding.cache_invalid',
        );
        await this.cacheService.delete(cacheKey);
      }
    } else {
      this.metricsService.recordCacheHit(false);
    }

    const embedding = await this.withTimeout(
      this.embedWithProvider(normalizedText),
      500,
    ).catch((error) => {
      this.logger.warn(
        {
          error,
          model: this.embeddingModel,
        },
        'embedding.provider_failed_mock_fallback',
      );
      return this.mockEmbedding(normalizedText);
    });

    const validated = this.validateEmbedding(embedding);

    await this.cacheService.set(cacheKey, JSON.stringify(validated), 3600);
    return validated;
  }

  private async embedWithProvider(text: string): Promise<number[]> {
    if (!this.openaiClient) {
      this.metricsService.increment('embedding.mock.used');
      return this.mockEmbedding(text);
    }

    const response = await this.openaiClient.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    const vector = response.data?.[0]?.embedding;

    if (!vector) {
      throw new Error('Embedding provider returned empty embedding payload');
    }

    return this.validateEmbedding(vector);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error(`Embedding request timed out at ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  }

  private parseEmbedding(raw: string): number[] | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.every((value) => typeof value === 'number')
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private normalize(text: string): string {
    return text.toLowerCase().trim().replace(/[^\w\s]/g, '');
  }

  private mockEmbedding(text: string): number[] {
    return Array.from({ length: EMBEDDING_DIMENSION }, (_value, index) =>
      Math.sin(index + text.length),
    );
  }

  private validateEmbedding(vector: number[]): number[] {
    if (vector.length !== EMBEDDING_DIMENSION) {
      this.metricsService.increment('embedding.dimension_mismatch');
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, received ${vector.length}`,
      );
    }

    if (!vector.every((value) => Number.isFinite(value))) {
      throw new Error('Embedding vector contains non-finite values');
    }

    return vector;
  }
}