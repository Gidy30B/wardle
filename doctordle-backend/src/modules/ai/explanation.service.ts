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

  async getExplanation(caseId: string): Promise<string | null> {
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

    return null;
  }

  async materializeExplanation(caseId: string): Promise<string> {
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

    const generated = await this.generateExplanation(caseId).catch(async (error) => {
      const fallback = await this.generateFallbackExplanation(caseId);
      this.logger.warn(
        JSON.stringify({
          event: 'ai.explanation.fallback_used',
          caseId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return fallback;
    });

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

  private async generateFallbackExplanation(caseId: string): Promise<string> {
    const foundCase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        difficulty: true,
        history: true,
        symptoms: true,
        diagnosis: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!foundCase) {
      return `Case explanation unavailable. The most likely diagnosis for case ${caseId} should be reviewed once AI content generation recovers.`;
    }

    const symptoms = Array.isArray(foundCase.symptoms)
      ? foundCase.symptoms.join(', ')
      : 'No symptoms available';

    return [
      `The most likely diagnosis is ${foundCase.diagnosis.name}.`,
      `Difficulty: ${foundCase.difficulty}.`,
      `History: ${foundCase.history}`,
      `Key symptoms: ${symptoms}.`,
    ].join(' ');
  }
}
