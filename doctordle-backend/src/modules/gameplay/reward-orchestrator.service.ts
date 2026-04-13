import { Injectable } from '@nestjs/common';
import { EventBusService } from '../../core/events/event-bus.service';
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
export class RewardOrchestrator {
  constructor(private readonly eventBus: EventBusService) {}

  emitAttemptSubmitted(payload: AttemptSubmittedEvent): Promise<void> {
    return this.eventBus.emit(GameplayEventName.AttemptSubmitted, payload);
  }

  emitAttemptEvaluated(payload: AttemptEvaluatedEvent): Promise<void> {
    return this.eventBus.emit(GameplayEventName.AttemptEvaluated, payload);
  }

  emitAttemptRecorded(payload: AttemptRecordedEvent): Promise<void> {
    return this.eventBus.emit(GameplayEventName.AttemptRecorded, payload);
  }

  emitAttemptRecordFailed(payload: AttemptRecordFailedEvent): Promise<void> {
    return this.eventBus.emit(GameplayEventName.AttemptRecordFailed, payload);
  }

  emitSessionCompleted(payload: SessionCompletedEvent): Promise<void> {
    return this.eventBus.emit(GameplayEventName.SessionCompleted, payload);
  }

  emitRewardRequested(payload: RewardRequestedEvent): Promise<void> {
    return this.eventBus.emit(GameplayEventName.RewardRequested, payload);
  }

  emitRewardApplied(payload: RewardAppliedEvent): Promise<void> {
    return this.eventBus.emit(GameplayEventName.RewardApplied, payload);
  }
}
