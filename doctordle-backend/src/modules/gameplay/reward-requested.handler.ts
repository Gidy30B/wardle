import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../../core/events/event-bus.service';
import { QueueService } from '../queue/queue.service';
import { GameplayEventName, SessionCompletedEvent } from './gameplay.events';

@Injectable()
export class SessionCompletedHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: EventBusService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe<SessionCompletedEvent>(
      GameplayEventName.SessionCompleted,
      async (event) => {
        const payload = event.payload;

        await this.queueService.enqueueGameCompleted({
          sessionId: payload.sessionId,
          userId: payload.userId,
        });
      },
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}
