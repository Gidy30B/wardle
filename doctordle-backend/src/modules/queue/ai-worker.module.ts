import { Module } from '@nestjs/common';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { DatabaseModule } from '../../core/db/database.module';
import { PrismaService } from '../../core/db/prisma.service';
import { RedisModule } from '../../core/redis/redis.module';
import { ExplanationService } from '../ai/explanation.service';
import { HintService } from '../ai/hint.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { QueueModule } from './queue.module';
import { AiProcessor } from './processors/ai.processor';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    RealtimeModule,
    NotificationsModule,
    RedisModule,
  ],
  providers: [
    AiProcessor,
    HintService,
    ExplanationService,
    PrismaService,
    RedisCacheService,
  ],
})
export class AiWorkerModule {}
