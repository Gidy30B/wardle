import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { AiModule } from '../ai/ai.module';
import { EditorialObservabilityModule } from '../editorial/editorial-observability.module.js';
import { CasesController } from './cases.controller';
import { DevController } from './dev.controller';
import { DevOnlyGuard } from './guards/dev-only.guard';
import { CasesService } from './cases.service.js';

@Module({
  imports: [AiModule, DatabaseModule, EditorialObservabilityModule],
  controllers: [CasesController, DevController],
  providers: [CasesService, InternalApiGuard, DevOnlyGuard],
  exports: [CasesService],
})
export class CasesModule {}
