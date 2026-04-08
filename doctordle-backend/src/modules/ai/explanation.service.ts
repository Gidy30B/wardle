import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';

@Injectable()
export class ExplanationService {
  private readonly logger = new Logger(ExplanationService.name);
  private readonly cacheTtlSeconds = 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getExplanation(caseId: string): Promise<string> {
    const cacheKey = this.getCacheKey(caseId);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const existing = await this.prisma.explanationContent.findUnique({
      where: { caseId },
      select: { content: true },
    });

    if (existing?.content) {
      await this.cache.set(cacheKey, existing.content, this.cacheTtlSeconds);
      return existing.content;
    }

    const generated = await this.generateExplanation(caseId);

    await this.prisma.explanationContent.upsert({
      where: { caseId },
      create: {
        caseId,
        content: generated,
      },
      update: {
        content: generated,
      },
    });

    await this.cache.set(cacheKey, generated, this.cacheTtlSeconds);

    this.logger.log(
      JSON.stringify({
        event: 'ai.explanation.generated',
        caseId,
      }),
    );

    return generated;
  }

  private getCacheKey(caseId: string): string {
    return `ai:explanation:${caseId}`;
  }

  private async generateExplanation(caseId: string): Promise<string> {
    return `Mock explanation for case ${caseId}`;
  }
}
