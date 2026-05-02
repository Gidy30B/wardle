import { Module } from '@nestjs/common';
import { AiWorkerModule } from './ai-worker.module';
import { QueueWorkerModule } from './queue-worker.module';
import { NotificationWorkerModule } from '../notifications/notification-worker.module';

@Module({
  imports: [QueueWorkerModule, AiWorkerModule, NotificationWorkerModule],
})
export class WorkerModule {}
