import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '../../../core/config/env.validation';
import {
  NOTIFICATION_CREATE_JOB_NAME,
  NOTIFICATION_QUEUE_NAME,
} from '../../queue/queue.constants';
import type { NotificationCreateJobPayload } from '../../queue/queue.service';
import { NotificationsService } from '../notifications.service';
import { NotificationRealtimePublisher } from '../notification-realtime.publisher';
import { isNotificationCategory } from '../notification.types';

@Injectable()
export class NotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly connection: IORedis;
  private worker?: Worker<NotificationCreateJobPayload>;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly realtimePublisher: NotificationRealtimePublisher,
  ) {
    this.connection = new IORedis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  onModuleInit() {
    this.worker = new Worker<NotificationCreateJobPayload>(
      NOTIFICATION_QUEUE_NAME,
      async (job) => this.process(job),
      {
        connection: this.connection,
        concurrency: 10,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Notification job ${job?.id ?? 'unknown'} failed: ${error.message}`,
        error.stack,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Notification worker error: ${error.message}`, error.stack);
    });

    this.logger.log(`Listening on ${NOTIFICATION_QUEUE_NAME} queue`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection.quit();
  }

  private async process(job: Job<NotificationCreateJobPayload>) {
    if (job.name !== NOTIFICATION_CREATE_JOB_NAME) {
      this.logger.warn(`Skipping unknown notification job ${job.name}`);
      return;
    }

    const payload = job.data;

    if (!isNotificationCategory(payload.category)) {
      throw new Error(`Invalid notification category: ${payload.category}`);
    }

    const result = await this.notificationsService.createIfEnabled({
      userId: payload.userId,
      type: payload.type,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: payload.priority,
      idempotencyKey: payload.idempotencyKey,
    });

    if (!result.created) {
      this.logger.debug(
        `Notification skipped or already existed (${payload.idempotencyKey})`,
      );
      return;
    }

    const realtimePayload = await this.notificationsService.buildRealtimePayload(
      result.notification,
    );

    await this.realtimePublisher.publishCreated(payload.userId, realtimePayload);
  }
}
