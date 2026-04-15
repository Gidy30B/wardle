import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module.js';
import { EditorialObservabilityModule } from '../editorial/editorial-observability.module.js';
import { CaseRevisionService } from './case-revision.service.js';
import { CaseValidationOrchestrator } from './case-validation.orchestrator.js';
import { CaseValidationService } from './case-validation.service.js';

@Module({
  imports: [DatabaseModule, EditorialObservabilityModule],
  providers: [
    CaseRevisionService,
    CaseValidationService,
    CaseValidationOrchestrator,
  ],
  exports: [
    CaseRevisionService,
    CaseValidationService,
    CaseValidationOrchestrator,
  ],
})
export class CaseValidationModule {}
