import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type EventHandler<T = unknown> = (
  event: EventEnvelope<T>,
) => void | Promise<void>;

type LegacyEventHandler<T = unknown> = (payload: T) => void | Promise<void>;

type CompatibleEventHandler<T = unknown> =
  | EventHandler<T>
  | LegacyEventHandler<T>;

export type EventExecutionMode = 'sequential' | 'parallel';

export type EventEnvelope<T = unknown> = {
  eventId: string;
  eventName: string;
  correlationId: string;
  timestamp: string;
  payload: T;
};

type CorrelatablePayload = {
  correlationId?: unknown;
  sessionId?: unknown;
};

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, Set<CompatibleEventHandler>>();
  private readonly executionMode: EventExecutionMode =
    EventBusService.resolveExecutionMode(process.env.EVENT_BUS_EXECUTION_MODE);

  subscribe<T>(eventName: string, handler: EventHandler<T>): () => void;
  subscribe<T>(eventName: string, handler: LegacyEventHandler<T>): () => void;
  subscribe<T>(
    eventName: string,
    handler: CompatibleEventHandler<T>,
  ): () => void {
    const existingHandlers =
      this.handlers.get(eventName) ?? new Set<CompatibleEventHandler>();
    const normalizedHandler = handler as CompatibleEventHandler;

    existingHandlers.add(normalizedHandler);
    this.handlers.set(eventName, existingHandlers);

    return () => {
      const registeredHandlers = this.handlers.get(eventName);
      if (!registeredHandlers) {
        return;
      }

      registeredHandlers.delete(normalizedHandler);

      if (registeredHandlers.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  async emit<T>(eventName: string, payload: T): Promise<void> {
    const handlers = [...(this.handlers.get(eventName) ?? [])];
    if (handlers.length === 0) {
      this.logger.debug({
        event: 'event.no_handlers',
        eventName,
      });
      return;
    }

    const envelope = this.createEnvelope(eventName, payload);

    if (this.executionMode === 'parallel') {
      await Promise.all(
        handlers.map((handler, index) =>
          this.invokeHandlerSafely(
            handler as CompatibleEventHandler<T>,
            envelope,
            index,
          ),
        ),
      );
      return;
    }

    for (const [index, handler] of handlers.entries()) {
      await this.invokeHandlerSafely(
        handler as CompatibleEventHandler<T>,
        envelope,
        index,
      );
    }
  }

  private async invokeHandlerSafely<T>(
    handler: CompatibleEventHandler<T>,
    envelope: EventEnvelope<T>,
    handlerIndex: number,
  ): Promise<void> {
    const handlerName = this.resolveHandlerName(handler, handlerIndex);

    try {
      try {
        await (handler as EventHandler<T>)(envelope);
      } catch {
        await (handler as LegacyEventHandler<T>)(envelope.payload);
      }
    } catch (error) {
      this.logger.error(
        {
          event: 'event.handler_failed',
          eventName: envelope.eventName,
          correlationId: envelope.correlationId,
          handler: handlerName,
          eventId: envelope.eventId,
        },
        this.serializeErrorTrace(error),
      );
    }
  }

  private createEnvelope<T>(eventName: string, payload: T): EventEnvelope<T> {
    const eventId = randomUUID();
    const correlationId = this.resolveCorrelationId(payload, eventId);

    return {
      eventId,
      eventName,
      correlationId,
      timestamp: new Date().toISOString(),
      payload: this.attachCorrelationId(payload, correlationId),
    };
  }

  private resolveCorrelationId<T>(payload: T, fallback: string): string {
    if (payload && typeof payload === 'object') {
      const value = payload as CorrelatablePayload;

      if (
        typeof value.correlationId === 'string' &&
        value.correlationId.trim().length > 0
      ) {
        return value.correlationId;
      }

      if (
        typeof value.sessionId === 'string' &&
        value.sessionId.trim().length > 0
      ) {
        return value.sessionId;
      }
    }

    return fallback;
  }

  private attachCorrelationId<T>(payload: T, correlationId: string): T {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }

    const value = payload as CorrelatablePayload;
    if (
      typeof value.correlationId === 'string' &&
      value.correlationId.trim().length > 0
    ) {
      return payload;
    }

    return {
      ...(payload as Record<string, unknown>),
      correlationId,
    } as T;
  }

  private resolveHandlerName<T>(
    handler: CompatibleEventHandler<T>,
    handlerIndex: number,
  ): string {
    if (handler.name && handler.name.trim().length > 0) {
      return handler.name;
    }

    return 'handler_' + String(handlerIndex + 1);
  }

  private serializeErrorTrace(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return undefined;
  }

  private static resolveExecutionMode(rawValue?: string): EventExecutionMode {
    if (rawValue?.toLowerCase() === 'parallel') {
      return 'parallel';
    }

    return 'sequential';
  }
}
