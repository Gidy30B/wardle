import { Module } from '@nestjs/common';
import { EditorialGuard, SeniorEditorialGuard } from '../../auth/editorial.guard';
import { DatabaseModule } from '../../core/db/database.module';
import { AdminGuard } from '../admin/admin.guard';
import { DiagnosisGraphModule } from '../diagnosis-graph/diagnosis-graph.module';
import { EditorialIntentProjectionService } from '../editorial/editorial-intent-projection.service';
import { GenerationContextBuilder } from '../editorial/generation-context-builder.service';
import { WorkspaceProjectionService } from '../editorial/workspace-projection.service';
import { AdminEducationController } from './admin-education.controller';
import { DiagnosisEducationService } from './diagnosis-education.service';
import { EducationDraftQualityValidator } from './education-draft-quality-validator.service';
import { EducationEditorialPatternsService } from './education-editorial-patterns.service';
import { EducationController } from './education.controller';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';
import { EducationRevisionQualityAnalyzer } from './education-revision-quality-analyzer.service';
import { EditorialLearningEngineService } from './editorial-learning-engine.service';
import { EducationSchemaContractService } from './education-schema-contract.service';
import { EducationSectionQualityClassifier } from './education-section-quality-classifier.service';
import { EducationSectionRegenerationService } from './education-section-regeneration.service';
import { EducationTeachingRulesService } from './education-teaching-rules.service';
import { DiagnosisCurriculumProviderService } from './diagnosis-curriculum-provider.service';
import { DiagnosisTeachingRuleSeedService } from './diagnosis-teaching-rule-seed.service';
import { DiagnosisEditorialBriefService } from './diagnosis-editorial-brief.service';

@Module({
  imports: [DatabaseModule, DiagnosisGraphModule],
  controllers: [EducationController, AdminEducationController],
  providers: [
    DiagnosisEducationService,
    EditorialIntentProjectionService,
    GenerationContextBuilder,
    WorkspaceProjectionService,
    EducationKnowledgeRulesService,
    EducationTeachingRulesService,
    DiagnosisCurriculumProviderService,
    DiagnosisTeachingRuleSeedService,
    DiagnosisEditorialBriefService,
    EducationDraftQualityValidator,
    EducationSchemaContractService,
    EducationEditorialPatternsService,
    EducationRevisionQualityAnalyzer,
    EditorialLearningEngineService,
    EducationSectionQualityClassifier,
    EducationSectionRegenerationService,
    AdminGuard,
    EditorialGuard,
    SeniorEditorialGuard,
  ],
  exports: [DiagnosisEducationService],
})
export class EducationModule {}
