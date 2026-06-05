import { Module } from '@nestjs/common';
import {
  EditorialGuard,
  SeniorEditorialGuard,
} from '../../auth/editorial.guard';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { CaseGeneratorModule } from '../case-generator/case-generator.module';
import { CasesModule } from '../cases/cases.module';
import { DatabaseModule } from '../../core/db/database.module';
import { CaseValidationModule } from '../case-validation/case-validation.module';
import { DiagnosisRegistryEditorialService } from '../diagnosis-registry/diagnosis-registry-editorial.service.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { EditorialObservabilityModule } from '../editorial/editorial-observability.module.js';
import { DiagnosisGraphModule } from '../diagnosis-graph/diagnosis-graph.module.js';
import { CaseReviewService } from './case-review.service';
import { CaseInventoryHealthService } from './case-inventory-health.service';
import { CaseQualityProjectionService } from './case-quality-projection.service';
import { DiagnosisWorkspaceQualityService } from './diagnosis-workspace-quality.service';
import { DiagnosisEditorialWorkspaceService } from './diagnosis-editorial-workspace.service';
import { DiagnosisEditorialOnboardingService } from './diagnosis-editorial-onboarding.service';
import { TeachingUnitCoverageService } from './teaching-unit-coverage.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';
import { TargetedCaseGenerationService } from './targeted-case-generation.service';
import { EditorialReviewInboxService } from './editorial-review-inbox.service';
import { EditorialCoverageDashboardService } from './editorial-coverage-dashboard.service';
import { CurriculumPlanningService } from './curriculum-planning.service';
import { DiagnosisTeachingRelationshipService } from './diagnosis-teaching-relationship.service';
import { EvidenceGraphService } from './evidence-graph.service';
import { EvidenceCoverageService } from './evidence-coverage.service';
import { EducationRevisionQualityAnalyzer } from '../education/education-revision-quality-analyzer.service';
import { EducationDraftQualityValidator } from '../education/education-draft-quality-validator.service';
import { EducationKnowledgeRulesService } from '../education/education-knowledge-rules.service';
import { EducationTeachingRulesService } from '../education/education-teaching-rules.service';
import { DiagnosisCurriculumProviderService } from '../education/diagnosis-curriculum-provider.service';
import { EducationSectionQualityClassifier } from '../education/education-section-quality-classifier.service';
import { EducationEditorialPatternsService } from '../education/education-editorial-patterns.service';
import { EducationSchemaContractService } from '../education/education-schema-contract.service';
import { DiagnosisTeachingRuleSeedService } from '../education/diagnosis-teaching-rule-seed.service';
import { DiagnosisEditorialBriefService } from '../education/diagnosis-editorial-brief.service';
import { AliasValidationService } from '../diagnosis-registry/alias-validation.service';
import { DiagnosisRegistryCandidateService } from '../diagnosis-registry/diagnosis-registry-candidate.service';
import { DiagnosisRegistryLifecyclePolicyService } from '../diagnosis-registry/diagnosis-registry-lifecycle-policy.service';
import { DiagnosisRegistryMergeAnalysisService } from '../diagnosis-registry/diagnosis-registry-merge-analysis.service';
import { DiagnosisRegistryMergeExecutionService } from '../diagnosis-registry/diagnosis-registry-merge-execution.service';

@Module({
  imports: [
    CaseGeneratorModule,
    CasesModule,
    DatabaseModule,
    CaseValidationModule,
    EditorialObservabilityModule,
    DiagnosisGraphModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminGuard,
    EditorialGuard,
    SeniorEditorialGuard,
    CaseReviewService,
    CaseInventoryHealthService,
    CaseQualityProjectionService,
    DiagnosisWorkspaceQualityService,
    DiagnosisEditorialWorkspaceService,
    DiagnosisEditorialOnboardingService,
    TeachingUnitCoverageService,
    TeachingRulesAdminService,
    EditorialReviewInboxService,
    EditorialCoverageDashboardService,
    CurriculumPlanningService,
    DiagnosisTeachingRelationshipService,
    EvidenceGraphService,
    EvidenceCoverageService,
    TargetedCaseGenerationService,
    EducationRevisionQualityAnalyzer,
    EducationDraftQualityValidator,
    EducationKnowledgeRulesService,
    EducationTeachingRulesService,
    DiagnosisCurriculumProviderService,
    DiagnosisTeachingRuleSeedService,
    DiagnosisEditorialBriefService,
    EducationSectionQualityClassifier,
    EducationEditorialPatternsService,
    EducationSchemaContractService,
    DiagnosisRegistryLinkService,
    DiagnosisRegistryEditorialService,
    DiagnosisRegistryCandidateService,
    DiagnosisRegistryLifecyclePolicyService,
    DiagnosisRegistryMergeAnalysisService,
    DiagnosisRegistryMergeExecutionService,
    AliasValidationService,
  ],
})
export class AdminModule {}
