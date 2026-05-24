import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import {
  getRedisConnectionOptions,
  getRedisUrl,
} from './redis.config';

type RedisMessageHandler = (data: any) => void;

@Injectable()
export class RedisPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);
  private readonly publisher: Redis;
  private subscriber?: Redis;
  private readonly handlers = new Map<string, Set<RedisMessageHandler>>();

  constructor() {
    this.publisher = new Redis(getRedisUrl(), getRedisConnectionOptions());
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe(
    channel: string,
    handler: RedisMessageHandler,
  ): Promise<void> {
    const subscriber = this.getSubscriber();
    const existingHandlers = this.handlers.get(channel) ?? new Set<RedisMessageHandler>();
    existingHandlers.add(handler);
    this.handlers.set(channel, existingHandlers);

    await subscriber.subscribe(channel);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.publisher.quit().catch(() => undefined),
      this.subscriber?.quit().catch(() => undefined),
    ]);
  }

  private getSubscriber(): Redis {
    if (this.subscriber) {
      return this.subscriber;
    }

    this.subscriber = new Redis(getRedisUrl(), getRedisConnectionOptions());
    this.subscriber.on('message', (channel, message) => {
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers || channelHandlers.size === 0) {
        return;
      }

      try {
        const parsed = JSON.parse(message);
        channelHandlers.forEach((handler) => {
          handler(parsed);
        });
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'redis.pubsub.message_parse_failed',
            channel,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    });

    return this.subscriber;
  }
}
