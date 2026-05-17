import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module.js';
import { CaseValidationModule } from '../case-validation/case-validation.module.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { CaseGeneratorService } from './case-generator.service.js';
import { DiagnosisSelectionService } from './diagnosis-selection.service.js';
import { GenerationDeduplicationService } from './generation-deduplication.service.js';
import { GenerationPlannerService } from './generation-planner.service.js';

@Module({
  imports: [DatabaseModule, CaseValidationModule],
  providers: [
    CaseGeneratorService,
    DiagnosisRegistryLinkService,
    DiagnosisSelectionService,
    GenerationDeduplicationService,
    GenerationPlannerService,
  ],
  exports: [CaseGeneratorService],
})
export class CaseGeneratorModule {}
