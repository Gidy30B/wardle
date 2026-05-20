import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { GameplayModule } from '../gameplay/gameplay.module';
import { StatsController } from './stats.controller';
import { StatsEngineService } from './stats-engine.service';

@Module({
  imports: [DatabaseModule, GameplayModule],
  controllers: [StatsController],
  providers: [StatsEngineService],
  exports: [StatsEngineService],
})
export class StatsModule {}
