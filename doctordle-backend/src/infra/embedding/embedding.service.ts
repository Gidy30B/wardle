import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { MetricsService } from '../../core/logger/metrics.service';
import { getEnv } from '../../core/config/env.validation';

@Injectable()
export class EmbeddingService {
  private readonly env = getEnv();
  private readonly openaiClient?: OpenAI;
  private readonly embeddingModel = this.env.EMBEDDING_MODEL;

  constructor(
    private readonly cacheService: RedisCacheService,
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
      const parsed = this.parseEmbedding(cached);
      if (parsed) {
        return parsed;
      }
    } else {
      this.metricsService.recordCacheHit(false);
    }

    const embedding = await this.withTimeout(
      this.embedWithProvider(normalizedText),
      500,
    ).catch(() => this.mockEmbedding(normalizedText));

    await this.cacheService.set(cacheKey, JSON.stringify(embedding), 3600);
    return embedding;
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

    return vector;
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
    return Array.from({ length: 384 }, (_value, index) =>
      Math.sin(index + text.length),
    );
  }
}