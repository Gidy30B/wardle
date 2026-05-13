import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiWorkerModule } from './ai-worker.module';
import { QueueWorkerModule } from './queue-worker.module';
import { NotificationWorkerModule } from '../notifications/notification-worker.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueWorkerModule,
    AiWorkerModule,
    NotificationWorkerModule,
  ],
})
export class WorkerModule {}
