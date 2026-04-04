import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MetricsService } from '../../../core/logger/metrics.service';

const llmResponseSchema = z.object({
  score: z.number().min(0).max(1),
  label: z.enum(['correct', 'close', 'wrong']),
});

type LlmDecision = z.infer<typeof llmResponseSchema>;

@Injectable()
export class LlmFallbackService {
  private readonly localCache = new Map<string, LlmDecision>();

  constructor(private readonly metricsService: MetricsService) {}

  async evaluate(guess: string, answer: string): Promise<LlmDecision | null> {
    const cacheKey = `llm:${guess}:${answer}`;
    const cached = this.localCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const start = performance.now();
    const timeoutMs = 800;
    const response = await Promise.race([
      this.mockLlmDecision(),
      this.timeout(timeoutMs),
    ]);

    this.metricsService.recordLayerLatency('llm', performance.now() - start);

    if (!response) {
      return null;
    }

    const parsed = llmResponseSchema.safeParse(response);
    if (!parsed.success) {
      return null;
    }

    this.metricsService.recordLlmUsage();
    this.localCache.set(cacheKey, parsed.data);
    return parsed.data;
  }

  private async mockLlmDecision(): Promise<unknown> {
    return null;
  }

  private async timeout(timeoutMs: number): Promise<null> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
  }
}
