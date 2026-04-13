import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../../core/events/event-bus.service';
import { AppLoggerService } from '../../core/logger/app-logger.service';
import {
  AttemptEvaluatedEvent,
  AttemptRecordFailedEvent,
  AttemptRecordedEvent,
  AttemptSubmittedEvent,
  GameplayEventName,
  RewardAppliedEvent,
  RewardRequestedEvent,
  SessionCompletedEvent,
} from './gameplay.events';

@Injectable()
export class GameplayEventLogger implements OnModuleInit, OnModuleDestroy {
  private readonly unsubscribeHandlers: Array<() => void> = [];

  constructor(
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {}

  onModuleInit(): void {
    this.unsubscribeHandlers.push(
      this.eventBus.subscribe<AttemptSubmittedEvent>(
        GameplayEventName.AttemptSubmitted,
        (event) => {
          this.logInfo(GameplayEventName.AttemptSubmitted, event.payload);
        },
      ),
      this.eventBus.subscribe<AttemptEvaluatedEvent>(
        GameplayEventName.AttemptEvaluated,
        (event) => {
          this.logInfo(GameplayEventName.AttemptEvaluated, event.payload);
        },
      ),
      this.eventBus.subscribe<AttemptRecordedEvent>(
        GameplayEventName.AttemptRecorded,
        (event) => {
          this.logInfo(GameplayEventName.AttemptRecorded, event.payload);
        },
      ),
      this.eventBus.subscribe<AttemptRecordFailedEvent>(
        GameplayEventName.AttemptRecordFailed,
        (event) => {
          const payload = event.payload;

          this.logger.error(
            {
              event: GameplayEventName.AttemptRecordFailed,
              correlationId: event.correlationId,
              ...payload,
              error: this.serializeError(payload.error),
            },
            GameplayEventName.AttemptRecordFailed,
          );
        },
      ),
      this.eventBus.subscribe<SessionCompletedEvent>(
        GameplayEventName.SessionCompleted,
        (event) => {
          this.logInfo(GameplayEventName.SessionCompleted, event.payload);
        },
      ),
      this.eventBus.subscribe<RewardRequestedEvent>(
        GameplayEventName.RewardRequested,
        (event) => {
          this.logInfo(GameplayEventName.RewardRequested, event.payload);
        },
      ),
      this.eventBus.subscribe<RewardAppliedEvent>(
        GameplayEventName.RewardApplied,
        (event) => {
          this.logInfo(GameplayEventName.RewardApplied, event.payload);
        },
      ),
    );
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribeHandlers.splice(0)) {
      unsubscribe();
    }
  }

  private logInfo(
    event: string,
    meta: { sessionId?: string; userId?: string; [key: string]: unknown },
  ): void {
    this.logger.info(
      {
        event,
        correlationId: meta.sessionId ?? null,
        ...meta,
      },
      event,
    );
  }

  private serializeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
