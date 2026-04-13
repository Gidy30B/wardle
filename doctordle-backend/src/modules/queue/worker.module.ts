import { Module } from '@nestjs/common';
import { AiWorkerModule } from './ai-worker.module';
import { QueueWorkerModule } from './queue-worker.module';

@Module({
  imports: [QueueWorkerModule, AiWorkerModule],
})
export class WorkerModule {}
