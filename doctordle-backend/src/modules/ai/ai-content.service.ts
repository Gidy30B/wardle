import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { ExplanationService } from './explanation.service';
import { HintService } from './hint.service';

export type HintResolution =
  | {
      status: 'ready';
      hint: string;
    }
  | {
      status: 'processing';
    };

export type ExplanationResolution =
  | {
      status: 'ready';
      content: string;
    }
  | {
      status: 'processing';
    };

@Injectable()
export class AIContentService {
  private readonly logger = new Logger(AIContentService.name);

  constructor(
    private readonly hintService: HintService,
    private readonly explanationService: ExplanationService,
    private readonly queueService: QueueService,
  ) {}

  async getHint(caseId: string): Promise<HintResolution> {
    const hint = await this.hintService.getHint(caseId);

    if (hint) {
      return {
        status: 'ready',
        hint,
      };
    }

    await this.queueService.enqueueHint(caseId);

    return {
      status: 'processing',
    };
  }

  async scheduleCaseContent(
    caseId: string,
    metadata: { source: string; userId?: string; sessionId?: string },
  ): Promise<void> {
    const [hintResult, explanationResult] = await Promise.allSettled([
      this.queueService.enqueueHint(caseId),
      metadata.userId
        ? this.queueService.enqueueExplanation({
            caseId,
            userId: metadata.userId,
          })
        : Promise.resolve(),
    ]);

    if (hintResult.status === 'rejected') {
      this.logger.error(
        JSON.stringify({
          event: 'ai.content.hint.enqueue_failed',
          caseId,
          source: metadata.source,
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          error:
            hintResult.reason instanceof Error
              ? hintResult.reason.message
              : String(hintResult.reason),
        }),
      );
    }

    if (explanationResult.status === 'rejected') {
      this.logger.error(
        JSON.stringify({
          event: 'ai.content.explanation.enqueue_failed',
          caseId,
          source: metadata.source,
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          error:
            explanationResult.reason instanceof Error
              ? explanationResult.reason.message
              : String(explanationResult.reason),
        }),
      );
    }
  }

  async getExplanation(
    caseId: string,
    userId: string,
  ): Promise<ExplanationResolution> {
    const explanation = await this.explanationService.getExplanation(caseId);

    if (explanation) {
      return {
        status: 'ready',
        content: explanation,
      };
    }

    await this.queueService
      .enqueueExplanation({
        caseId,
        userId,
      })
      .catch((error) => {
      this.logger.error(
        JSON.stringify({
          event: 'ai.content.explanation.enqueue_failed',
          caseId,
          userId,
          source: 'explanation_requested',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      });

    return {
      status: 'processing',
    };
  }
}
