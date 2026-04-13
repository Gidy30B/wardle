import { Module } from '@nestjs/common';
import { ClerkJwtService } from '../../auth/clerk-jwt.service';
import { DatabaseModule } from '../../core/db/database.module';
import { RedisModule } from '../../core/redis/redis.module';
import { GameGateway } from './game.gateway';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [GameGateway, ClerkJwtService],
  exports: [GameGateway],
})
export class RealtimeModule {}
