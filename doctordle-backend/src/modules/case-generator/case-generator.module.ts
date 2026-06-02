import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module.js';
import { CaseValidationModule } from '../case-validation/case-validation.module.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { EditorialIntentProjectionService } from '../editorial/editorial-intent-projection.service.js';
import { GenerationContextBuilder } from '../editorial/generation-context-builder.service.js';
import { EducationKnowledgeRulesService } from '../education/education-knowledge-rules.service.js';
import { DiagnosisCurriculumProviderService } from '../education/diagnosis-curriculum-provider.service.js';
import { DiagnosisEditorialBriefService } from '../education/diagnosis-editorial-brief.service.js';
import { EducationTeachingRulesService } from '../education/education-teaching-rules.service.js';
import { DiagnosisGraphModule } from '../diagnosis-graph/diagnosis-graph.module.js';
import { CaseGeneratorService } from './case-generator.service.js';
import { CaseTeachingAlignmentService } from './case-teaching-alignment.service.js';
import { DiagnosisSelectionService } from './diagnosis-selection.service.js';
import { GenerationDeduplicationService } from './generation-deduplication.service.js';
import { GenerationPlannerService } from './generation-planner.service.js';

@Module({
  imports: [DatabaseModule, CaseValidationModule, DiagnosisGraphModule],
  providers: [
    CaseGeneratorService,
    CaseTeachingAlignmentService,
    EditorialIntentProjectionService,
    EducationKnowledgeRulesService,
    EducationTeachingRulesService,
    DiagnosisCurriculumProviderService,
    DiagnosisEditorialBriefService,
    GenerationContextBuilder,
    DiagnosisRegistryLinkService,
    DiagnosisSelectionService,
    GenerationDeduplicationService,
    GenerationPlannerService,
  ],
  exports: [CaseGeneratorService],
})
export class CaseGeneratorModule {}
