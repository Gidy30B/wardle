import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getEnv } from '../config/env.validation';

type RedisMessageHandler = (data: any) => void;

@Injectable()
export class RedisPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, Set<RedisMessageHandler>>();

  constructor() {
    const redisUrl = getEnv().REDIS_URL;

    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

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
        console.error('Redis message parse error', error);
      }
    });
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe(
    channel: string,
    handler: RedisMessageHandler,
  ): Promise<void> {
    const existingHandlers = this.handlers.get(channel) ?? new Set<RedisMessageHandler>();
    existingHandlers.add(handler);
    this.handlers.set(channel, existingHandlers);

    await this.subscriber.subscribe(channel);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.publisher.quit().catch(() => undefined),
      this.subscriber.quit().catch(() => undefined),
    ]);
  }
}
