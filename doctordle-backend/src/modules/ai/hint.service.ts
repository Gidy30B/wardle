import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';

@Injectable()
export class HintService {
  private readonly logger = new Logger(HintService.name);
  private readonly cacheTtlSeconds = 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getHint(caseId: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(caseId);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const existing = await this.prisma.hintContent.findUnique({
      where: { caseId },
      select: { content: true },
    });

    if (existing?.content) {
      await this.cache.set(cacheKey, existing.content, this.cacheTtlSeconds);
      return existing.content;
    }

    return null;
  }

  async materializeHint(caseId: string): Promise<string> {
    const cacheKey = this.getCacheKey(caseId);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const existing = await this.prisma.hintContent.findUnique({
      where: { caseId },
      select: { content: true },
    });

    if (existing?.content) {
      await this.cache.set(cacheKey, existing.content, this.cacheTtlSeconds);
      return existing.content;
    }

    const generated = await this.generateHint(caseId);

    await this.prisma.hintContent.upsert({
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
        event: 'ai.hint.generated',
        caseId,
      }),
    );

    return generated;
  }

  private getCacheKey(caseId: string): string {
    return `ai:hint:${caseId}`;
  }

  private async generateHint(caseId: string): Promise<string> {
    return `Mock hint for case ${caseId}`;
  }
}
