import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { EditorialObservabilityModule } from '../editorial/editorial-observability.module.js';
import { CaseRevisionService } from './case-revision.service.js';
import { CaseValidationOrchestrator } from './case-validation.orchestrator.js';
import { CaseValidationService } from './case-validation.service.js';

@Module({
  imports: [DatabaseModule, EditorialObservabilityModule],
  providers: [
    DiagnosisRegistryLinkService,
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
