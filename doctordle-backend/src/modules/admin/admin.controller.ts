import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DifferentialResolutionStatus } from '@prisma/client';
import { DiagnosisRegistryCandidateStatus } from '@prisma/client';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import {
  EditorialAccess,
  SeniorEditorialAccess,
} from '../../auth/editorial-permission.decorator';
import { canPublishEditorial } from '../../auth/roles';
import { CaseGeneratorService } from '../case-generator/case-generator.service';
import { AdminGuard } from './admin.guard';
import { CaseReviewService } from './case-review.service';
import { CaseInventoryHealthService } from './case-inventory-health.service';
import { DiagnosisEditorialWorkspaceService } from './diagnosis-editorial-workspace.service';
import {
  DiagnosisEditorialOnboardingService,
  type OnboardingStatusAction,
} from './diagnosis-editorial-onboarding.service';
import { DiagnosisWorkspaceQualityService } from './diagnosis-workspace-quality.service';
import { TeachingUnitCoverageService } from './teaching-unit-coverage.service';
import { EditorialReviewInboxService } from './editorial-review-inbox.service';
import {
  EditorialCoverageDashboardService,
  type EditorialCoverageQuery,
} from './editorial-coverage-dashboard.service';
import {
  CurriculumPlanningService,
  type CurriculumPlannerQuery,
} from './curriculum-planning.service';
import {
  DiagnosisTeachingRelationshipService,
  type TeachingRelationshipReviewAction,
} from './diagnosis-teaching-relationship.service';
import {
  EvidenceGraphService,
  type EvidenceGraphReviewAction,
} from './evidence-graph.service';
import {
  EvidenceCoverageService,
  type EvidenceCoverageQuery,
} from './evidence-coverage.service';
import {
  ReasoningPathService,
  type ReasoningPathReviewAction,
} from './reasoning-path.service';
import { ReasoningDraftValidationService } from './reasoning-draft-validation.service';
import {
  TargetedCaseGenerationService,
  type ClueRevisionProposalPayload,
  type TargetedDiscriminatorCasePayload,
  type TargetedCaseGenerationPayload,
} from './targeted-case-generation.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';
import { DiagnosisEditorialBriefService } from '../education/diagnosis-editorial-brief.service';
import {
  DifferentialMappingService,
  type ResolveDifferentialMappingAction,
} from '../diagnosis-graph/differential-mapping.service';
import {
  DiagnosisRegistryCandidateService,
  type ReviewRegistryCandidateAction,
} from '../diagnosis-registry/diagnosis-registry-candidate.service';
import {
  DiagnosisRegistryLifecyclePolicyService,
  type DiagnosisRegistryLifecycleAction,
} from '../diagnosis-registry/diagnosis-registry-lifecycle-policy.service';
import { DiagnosisRegistryLifecycleTelemetryService } from '../diagnosis-registry/diagnosis-registry-lifecycle-telemetry.service';
import {
  DiagnosisRegistryAiMetadataSuggestionService,
  type GenerateAiRegistryMetadataInput,
} from '../diagnosis-registry/diagnosis-registry-ai-metadata-suggestion.service';
import { DiagnosisRegistryMetadataSuggestionService } from '../diagnosis-registry/diagnosis-registry-metadata-suggestion.service';
import { DiagnosisRegistryMergeAnalysisService } from '../diagnosis-registry/diagnosis-registry-merge-analysis.service';
import { DiagnosisRegistryMergeExecutionService } from '../diagnosis-registry/diagnosis-registry-merge-execution.service';
import { CreateAndLinkDiagnosisDto } from './dto/create-and-link-diagnosis.dto';
import { CreateDiagnosisAliasDto } from './dto/create-diagnosis-alias.dto';
import { CreateDiagnosisRegistryDto } from './dto/create-diagnosis-registry.dto';
import { LinkCaseDiagnosisDto } from './dto/link-case-diagnosis.dto';
import { ListEditorialCasesDto } from './dto/list-editorial-cases.dto';
import { SearchDiagnosisRegistryDto } from './dto/search-diagnosis-registry.dto';
import { SubmitCaseReviewDto } from './dto/submit-case-review.dto';
import { UpdateCaseDiagnosisDto } from './dto/update-case-diagnosis.dto';
import { UpdateDiagnosisRegistryMetadataDto } from './dto/update-diagnosis-registry-metadata.dto';

type GenerateCasesBody = {
  count?: number;
  track?: string;
  bodySystem?: string;
  difficulty?: string;
  registryFirst?: boolean;
  diagnosisRegistryIds?: string[];
};

type RepairUnsupportedClaimBody = {
  artifactType?: string;
  artifactId?: string;
  claimId?: string;
};

type AiDraftDecisionBody = {
  note?: string | null;
};

type CaseClueRevisionDraftUpdateBody = {
  revisedClue?: string | null;
  addedClue?: string | null;
  rationale?: string | null;
  expectedEffect?: string | null;
  decisionNote?: string | null;
};

type CaseLearningGoalCoverageBody = {
  caseId?: string;
  learningGoalId?: string;
  learningGoal?: string;
  coverageStrength?: number;
  coveredDiscriminators?: string[];
  missingDiscriminators?: string[];
  coveredMimics?: string[];
  missingMimics?: string[];
  evidenceSource?: string;
};

type CaseEscalationAnnotationBody = {
  caseId?: string;
  escalationType?: string;
  covered?: boolean;
  evidenceStrength?: number;
  reasoningPathId?: string | null;
  notes?: string | null;
};

type CaseClueDiscriminatorAnnotationBody = {
  clueOrder?: number;
  clueIndex?: number | null;
  eliminatedDiagnosisId?: string | null;
  eliminatedDiagnosisName?: string;
  discriminator?: string;
  reasoning?: string | null;
  eliminationStrength?: 'weak' | 'moderate' | 'strong';
  educationalValue?: 'low' | 'medium' | 'high';
};

type DiagnosisRegistryLifecycleActionBody = {
  action?: DiagnosisRegistryLifecycleAction | 'ACTIVATE_FOR_DICTIONARY';
  isGeneratable?: boolean;
};

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly caseGenerator: CaseGeneratorService,
    private readonly caseReviewService: CaseReviewService,
    private readonly caseInventoryHealthService: CaseInventoryHealthService,
    private readonly diagnosisEditorialWorkspaceService: DiagnosisEditorialWorkspaceService,
    private readonly diagnosisWorkspaceQualityService: DiagnosisWorkspaceQualityService,
    private readonly teachingUnitCoverageService: TeachingUnitCoverageService,
    private readonly editorialReviewInboxService: EditorialReviewInboxService,
    private readonly targetedCaseGenerationService: TargetedCaseGenerationService,
    private readonly teachingRulesAdminService: TeachingRulesAdminService,
    private readonly editorialCoverageDashboardService: EditorialCoverageDashboardService,
    private readonly curriculumPlanningService: CurriculumPlanningService,
    private readonly diagnosisTeachingRelationshipService: DiagnosisTeachingRelationshipService,
    private readonly evidenceGraphService: EvidenceGraphService,
    private readonly evidenceCoverageService: EvidenceCoverageService,
    private readonly reasoningPathService: ReasoningPathService,
    private readonly diagnosisEditorialBriefService: DiagnosisEditorialBriefService,
    private readonly differentialMappingService: DifferentialMappingService,
    private readonly diagnosisRegistryCandidateService: DiagnosisRegistryCandidateService,
    private readonly diagnosisEditorialOnboardingService: DiagnosisEditorialOnboardingService,
    private readonly diagnosisRegistryLifecyclePolicyService: DiagnosisRegistryLifecyclePolicyService,
    private readonly diagnosisRegistryLifecycleTelemetryService: DiagnosisRegistryLifecycleTelemetryService,
    private readonly diagnosisRegistryAiMetadataSuggestionService: DiagnosisRegistryAiMetadataSuggestionService,
    private readonly diagnosisRegistryMetadataSuggestionService: DiagnosisRegistryMetadataSuggestionService,
    private readonly diagnosisRegistryMergeAnalysisService: DiagnosisRegistryMergeAnalysisService,
    private readonly diagnosisRegistryMergeExecutionService: DiagnosisRegistryMergeExecutionService,
    private readonly reasoningDraftValidationService?: ReasoningDraftValidationService,
  ) {}

  @Get('cases')
  @EditorialAccess()
  async listEditorialCases(@Query() query: ListEditorialCasesDto) {
    return this.caseReviewService.listEditorialCases(query);
  }

  @Get('summary/editorial-statuses')
  @EditorialAccess()
  async getEditorialStatusSummary() {
    return this.caseReviewService.getEditorialStatusSummary();
  }

  @Get('summary/validation-outcomes')
  @EditorialAccess()
  async getValidationOutcomeSummary() {
    return this.caseReviewService.getValidationOutcomeSummary();
  }

  @Get('summary/publish-results')
  @EditorialAccess()
  async getPublishAssignmentSummary() {
    return this.caseReviewService.getPublishAssignmentSummary();
  }

  @Get('cases/inventory-health')
  @EditorialAccess()
  async getCaseInventoryHealth() {
    return this.caseInventoryHealthService.getInventoryHealth();
  }

  @Get('editorial/inbox')
  @EditorialAccess()
  async getEditorialReviewInbox(
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('specialty') specialty?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.editorialReviewInboxService.getInbox({
      type,
      severity,
      status,
      specialty,
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
    });
  }

  @Get('editorial/coverage/overview')
  @EditorialAccess()
  async getEditorialCoverageOverview(
    @Query('specialty') specialty?: string,
    @Query('lifecycleState') lifecycleState?: string,
    @Query('onboardingState') onboardingState?: string,
    @Query('coverageWeakness') coverageWeakness?: string,
    @Query('playableOnly') playableOnly?: string,
  ) {
    return this.editorialCoverageDashboardService.getOverview(
      this.parseCoverageQuery({
        specialty,
        lifecycleState,
        onboardingState,
        coverageWeakness,
        playableOnly,
      }),
    );
  }

  @Get('editorial/coverage/diagnoses')
  @EditorialAccess()
  async getEditorialCoverageDiagnoses(
    @Query('specialty') specialty?: string,
    @Query('lifecycleState') lifecycleState?: string,
    @Query('onboardingState') onboardingState?: string,
    @Query('coverageWeakness') coverageWeakness?: string,
    @Query('playableOnly') playableOnly?: string,
  ) {
    return this.editorialCoverageDashboardService.getDiagnoses(
      this.parseCoverageQuery({
        specialty,
        lifecycleState,
        onboardingState,
        coverageWeakness,
        playableOnly,
      }),
    );
  }

  @Get('editorial/coverage/specialties')
  @EditorialAccess()
  async getEditorialCoverageSpecialties(
    @Query('specialty') specialty?: string,
    @Query('lifecycleState') lifecycleState?: string,
    @Query('onboardingState') onboardingState?: string,
    @Query('coverageWeakness') coverageWeakness?: string,
    @Query('playableOnly') playableOnly?: string,
  ) {
    return this.editorialCoverageDashboardService.getSpecialties(
      this.parseCoverageQuery({
        specialty,
        lifecycleState,
        onboardingState,
        coverageWeakness,
        playableOnly,
      }),
    );
  }

  @Get('editorial/planner/overview')
  @EditorialAccess()
  async getCurriculumPlannerOverview(
    @Query('specialty') specialty?: string,
    @Query('onboardingStatus') onboardingStatus?: string,
    @Query('onboardingState') onboardingState?: string,
    @Query('lifecycleReadiness') lifecycleReadiness?: string,
    @Query('lifecycleState') lifecycleState?: string,
    @Query('priorityTier') priorityTier?: string,
    @Query('track') track?: string,
    @Query('playableOnly') playableOnly?: string,
  ) {
    return this.curriculumPlanningService.getOverview(
      this.parsePlannerQuery({
        specialty,
        onboardingStatus,
        onboardingState,
        lifecycleReadiness,
        lifecycleState,
        priorityTier,
        track,
        playableOnly,
      }),
    );
  }

  @Get('editorial/planner/diagnoses')
  @EditorialAccess()
  async getCurriculumPlannerDiagnoses(
    @Query('specialty') specialty?: string,
    @Query('onboardingStatus') onboardingStatus?: string,
    @Query('onboardingState') onboardingState?: string,
    @Query('lifecycleReadiness') lifecycleReadiness?: string,
    @Query('lifecycleState') lifecycleState?: string,
    @Query('priorityTier') priorityTier?: string,
    @Query('track') track?: string,
    @Query('playableOnly') playableOnly?: string,
  ) {
    return this.curriculumPlanningService.getDiagnoses(
      this.parsePlannerQuery({
        specialty,
        onboardingStatus,
        onboardingState,
        lifecycleReadiness,
        lifecycleState,
        priorityTier,
        track,
        playableOnly,
      }),
    );
  }

  @Get('editorial/planner/tracks')
  @EditorialAccess()
  async getCurriculumPlannerTracks(
    @Query('specialty') specialty?: string,
    @Query('onboardingStatus') onboardingStatus?: string,
    @Query('onboardingState') onboardingState?: string,
    @Query('lifecycleReadiness') lifecycleReadiness?: string,
    @Query('lifecycleState') lifecycleState?: string,
    @Query('priorityTier') priorityTier?: string,
    @Query('track') track?: string,
    @Query('playableOnly') playableOnly?: string,
  ) {
    return this.curriculumPlanningService.getTracks(
      this.parsePlannerQuery({
        specialty,
        onboardingStatus,
        onboardingState,
        lifecycleReadiness,
        lifecycleState,
        priorityTier,
        track,
        playableOnly,
      }),
    );
  }

  @Get('differential-mappings/unresolved')
  @EditorialAccess()
  async listUnresolvedDifferentialMappings(
    @Query('sourceType') sourceType?: string,
    @Query('diagnosisRegistryId') diagnosisRegistryId?: string,
    @Query('status') status?: string,
  ) {
    return this.differentialMappingService.listUnresolved({
      sourceType: this.parseDifferentialSourceType(sourceType),
      diagnosisRegistryId: diagnosisRegistryId || undefined,
      status: this.parseDifferentialStatus(status),
    });
  }

  @Get('diagnosis-teaching-relationships')
  @EditorialAccess()
  async listDiagnosisTeachingRelationships(
    @Query('diagnosisRegistryId') diagnosisRegistryId?: string,
    @Query('sourceDiagnosisRegistryId') sourceDiagnosisRegistryId?: string,
    @Query('targetDiagnosisRegistryId') targetDiagnosisRegistryId?: string,
    @Query('status') status?: string,
    @Query('purpose') purpose?: string,
    @Query('relationshipType') relationshipType?: string,
  ) {
    return this.diagnosisTeachingRelationshipService.listRelationships({
      diagnosisRegistryId,
      sourceDiagnosisRegistryId,
      targetDiagnosisRegistryId,
      status,
      purpose,
      relationshipType,
    });
  }

  @Get('evidence-graph/nodes')
  @EditorialAccess()
  async listEvidenceGraphNodes(
    @Query('q') q?: string,
    @Query('evidenceType') evidenceType?: string,
    @Query('status') status?: string,
  ) {
    return this.evidenceGraphService.listNodes({ q, evidenceType, status });
  }

  @Get('evidence-graph/relationships')
  @EditorialAccess()
  async listEvidenceGraphRelationships(
    @Query('diagnosisRegistryId') diagnosisRegistryId?: string,
    @Query('evidenceNodeId') evidenceNodeId?: string,
    @Query('evidenceType') evidenceType?: string,
    @Query('relationshipType') relationshipType?: string,
    @Query('status') status?: string,
    @Query('minDiscriminatorWeight') minDiscriminatorWeight?: string,
  ) {
    return this.evidenceGraphService.listRelationships({
      diagnosisRegistryId,
      evidenceNodeId,
      evidenceType,
      relationshipType,
      status,
      minDiscriminatorWeight: minDiscriminatorWeight
        ? Number(minDiscriminatorWeight)
        : undefined,
    });
  }

  @Post('evidence-graph/candidates/generate')
  @EditorialAccess()
  async generateEvidenceGraphCandidates(
    @Body() body: { diagnosisRegistryId?: string } = {},
  ) {
    return this.evidenceGraphService.generateCandidates({
      diagnosisRegistryId: body.diagnosisRegistryId,
    });
  }

  @Post('evidence-graph/relationships/:id/review')
  @SeniorEditorialAccess()
  async reviewEvidenceGraphRelationship(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: { action?: EvidenceGraphReviewAction },
  ) {
    return this.evidenceGraphService.reviewRelationship(
      id,
      request.user.id,
      body,
    );
  }

  @Get('evidence-coverage/overview')
  @EditorialAccess()
  async getEvidenceCoverageOverview(
    @Query('specialty') specialty?: string,
    @Query('evidenceWeakness') evidenceWeakness?: string,
    @Query('readinessTier') readinessTier?: string,
    @Query('playableOnly') playableOnly?: string,
    @Query('onboardingStatus') onboardingStatus?: string,
  ) {
    return this.evidenceCoverageService.getOverview(
      this.parseEvidenceCoverageQuery({
        specialty,
        evidenceWeakness,
        readinessTier,
        playableOnly,
        onboardingStatus,
      }),
    );
  }

  @Get('evidence-coverage/diagnoses')
  @EditorialAccess()
  async getEvidenceCoverageDiagnoses(
    @Query('specialty') specialty?: string,
    @Query('evidenceWeakness') evidenceWeakness?: string,
    @Query('readinessTier') readinessTier?: string,
    @Query('playableOnly') playableOnly?: string,
    @Query('onboardingStatus') onboardingStatus?: string,
  ) {
    return this.evidenceCoverageService.getDiagnoses(
      this.parseEvidenceCoverageQuery({
        specialty,
        evidenceWeakness,
        readinessTier,
        playableOnly,
        onboardingStatus,
      }),
    );
  }

  @Get('evidence-coverage/:diagnosisRegistryId')
  @EditorialAccess()
  async getEvidenceCoverageDiagnosis(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.evidenceCoverageService.getDiagnosis(diagnosisRegistryId);
  }

  @Get('reasoning-paths')
  @EditorialAccess()
  async listReasoningPaths(
    @Query('diagnosisRegistryId') diagnosisRegistryId?: string,
    @Query('generationPurpose') generationPurpose?: string,
    @Query('reasoningGoal') reasoningGoal?: string,
    @Query('status') status?: string,
    @Query('readinessTier') readinessTier?: string,
  ) {
    return this.reasoningPathService.listPaths({
      diagnosisRegistryId,
      generationPurpose,
      reasoningGoal,
      status,
      readinessTier,
    });
  }

  @Post('reasoning-paths/candidates/generate')
  @EditorialAccess()
  async generateReasoningPathCandidates(
    @Body() body: { diagnosisRegistryId?: string } = {},
  ) {
    return this.reasoningPathService.generateCandidates({
      diagnosisRegistryId: body.diagnosisRegistryId,
    });
  }

  @Get('reasoning-paths/:id/generation-context')
  @EditorialAccess()
  async getReasoningPathGenerationContext(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.reasoningPathService.buildGenerationContext(id);
  }

  @Post('reasoning-paths/:id/review')
  @SeniorEditorialAccess()
  async reviewReasoningPath(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: { action?: ReasoningPathReviewAction },
  ) {
    return this.reasoningPathService.reviewPath(id, request.user.id, body);
  }

  @Post('reasoning-draft-validation/run')
  @EditorialAccess()
  async runReasoningDraftValidation(
    @Body()
    body: {
      artifactType?: string;
      artifactId?: string;
    },
  ) {
    if (!body.artifactType || !body.artifactId) {
      throw new BadRequestException('artifactType and artifactId are required');
    }
    return this.reasoningDraftValidationService!.runForArtifact({
      artifactType: body.artifactType,
      artifactId: body.artifactId,
    });
  }

  @Get('reasoning-draft-validation')
  @EditorialAccess()
  async listReasoningDraftValidationRuns(
    @Query('artifactType') artifactType?: string,
    @Query('diagnosisRegistryId') diagnosisRegistryId?: string,
    @Query('trustTier') trustTier?: string,
    @Query('validationStatus') validationStatus?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reasoningDraftValidationService!.listRuns({
      artifactType,
      diagnosisRegistryId,
      trustTier,
      validationStatus,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('diagnosis-teaching-relationships/candidates/generate')
  @EditorialAccess()
  async generateDiagnosisTeachingRelationshipCandidates(
    @Body() body: { diagnosisRegistryId?: string } = {},
  ) {
    return this.diagnosisTeachingRelationshipService.generateCandidates({
      diagnosisRegistryId: body.diagnosisRegistryId,
    });
  }

  @Post('diagnosis-teaching-relationships/:id/review')
  @SeniorEditorialAccess()
  async reviewDiagnosisTeachingRelationship(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      action?: TeachingRelationshipReviewAction;
      note?: string;
    },
  ) {
    return this.diagnosisTeachingRelationshipService.reviewRelationship(
      id,
      request.user.id,
      body,
    );
  }

  @Post('differential-mappings/:mappingId/resolve')
  @SeniorEditorialAccess()
  async resolveDifferentialMapping(
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ResolveDifferentialMappingAction,
  ) {
    return this.differentialMappingService.resolveMapping(
      mappingId,
      request.user.id,
      body,
    );
  }

  @Post('differential-mappings/:mappingId/create-registry-candidate')
  @SeniorEditorialAccess()
  async createRegistryCandidateFromDifferentialMapping(
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
    @Body()
    body: {
      proposedCanonicalName?: string;
      proposedDisplayLabel?: string;
      proposedAliases?: string[];
    } = {},
  ) {
    return this.diagnosisRegistryCandidateService.createFromDifferentialMapping(
      {
        mappingId,
        proposedCanonicalName: body.proposedCanonicalName,
        proposedDisplayLabel: body.proposedDisplayLabel,
        proposedAliases: body.proposedAliases,
      },
    );
  }

  @Get('diagnosis-registry/candidates')
  @EditorialAccess()
  async listDiagnosisRegistryCandidates(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('showResolved') showResolved?: string,
  ) {
    return this.diagnosisRegistryCandidateService.listCandidates({
      status: this.parseRegistryCandidateStatus(status),
      limit: limit ? Number(limit) : undefined,
      showResolved: showResolved === 'true',
    });
  }

  @Get('diagnosis-registry/candidates/summary')
  @EditorialAccess()
  async getDiagnosisRegistryCandidateSummary() {
    return this.diagnosisRegistryCandidateService.getQueueSummary();
  }

  @Get('diagnosis-registry/candidates/:candidateId')
  @EditorialAccess()
  async getDiagnosisRegistryCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
  ) {
    return this.diagnosisRegistryCandidateService.getCandidate(candidateId);
  }

  @Post('diagnosis-registry/candidates/:candidateId/create-registry')
  @SeniorEditorialAccess()
  async createRegistryFromCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.diagnosisRegistryCandidateService.createRegistryFromCandidate(
      candidateId,
      request.user.id,
    );
  }

  @Post('diagnosis-registry/candidates/:candidateId/review')
  @SeniorEditorialAccess()
  async reviewDiagnosisRegistryCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ReviewRegistryCandidateAction,
  ) {
    return this.diagnosisRegistryCandidateService.reviewCandidate(
      candidateId,
      request.user.id,
      body,
    );
  }

  @Post('diagnosis-registry/merge/analyze')
  @SeniorEditorialAccess()
  async analyzeDiagnosisRegistryMerge(
    @Body()
    body: {
      sourceDiagnosisRegistryId?: string;
      targetDiagnosisRegistryId?: string;
    },
  ) {
    return this.diagnosisRegistryMergeAnalysisService.analyzeMerge(
      this.requireUuidLike(
        body.sourceDiagnosisRegistryId,
        'sourceDiagnosisRegistryId',
      ),
      this.requireUuidLike(
        body.targetDiagnosisRegistryId,
        'targetDiagnosisRegistryId',
      ),
    );
  }

  @Post('diagnosis-registry/merge/execute')
  @SeniorEditorialAccess()
  async executeDiagnosisRegistryMerge(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      sourceDiagnosisRegistryId?: string;
      targetDiagnosisRegistryId?: string;
      reason?: string;
      expectedAnalysisHash?: string;
    },
  ) {
    return this.diagnosisRegistryMergeExecutionService.executeMerge({
      sourceDiagnosisRegistryId: this.requireUuidLike(
        body.sourceDiagnosisRegistryId,
        'sourceDiagnosisRegistryId',
      ),
      targetDiagnosisRegistryId: this.requireUuidLike(
        body.targetDiagnosisRegistryId,
        'targetDiagnosisRegistryId',
      ),
      performedByUserId: request.user.id,
      reason: body.reason,
      expectedAnalysisHash: body.expectedAnalysisHash,
    });
  }

  @Post('diagnosis-registry/merge/complete-duplicate-keeper')
  @SeniorEditorialAccess()
  async completeDuplicateKeeper(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      keeperRegistryId?: string;
      sourceDraftRegistryId?: string;
      metadata?: Record<string, unknown>;
      aliases?: Array<{
        term?: string;
        acceptedForMatch?: boolean;
        kind?: string;
      }>;
      reason?: string;
    },
  ) {
    return this.diagnosisRegistryMergeExecutionService.completeDuplicateKeeper({
      keeperRegistryId: this.requireUuidLike(
        body.keeperRegistryId,
        'keeperRegistryId',
      ),
      sourceDraftRegistryId: this.requireUuidLike(
        body.sourceDraftRegistryId,
        'sourceDraftRegistryId',
      ),
      performedByUserId: request.user.id,
      metadata: body.metadata ?? {},
      aliases: (body.aliases ?? [])
        .filter((alias) => typeof alias.term === 'string' && alias.term.trim())
        .map((alias) => ({
          term: alias.term!.trim(),
          acceptedForMatch: alias.acceptedForMatch,
          kind: alias.kind as never,
        })),
      reason: body.reason,
    });
  }

  @Get('diagnosis-registry/:diagnosisRegistryId/merge-related')
  @EditorialAccess()
  async getDiagnosisRegistryMergeRelated(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisRegistryMergeAnalysisService.getMergeRelated(
      diagnosisRegistryId,
    );
  }

  @Get('diagnosis-registry/:diagnosisRegistryId/teaching-relationships')
  @EditorialAccess()
  async getDiagnosisRegistryTeachingRelationships(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisTeachingRelationshipService.listForDiagnosis(
      diagnosisRegistryId,
    );
  }

  @Get('diagnosis-registry/:diagnosisRegistryId/evidence-graph')
  @EditorialAccess()
  async getDiagnosisRegistryEvidenceGraph(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.evidenceGraphService.getForDiagnosis(diagnosisRegistryId);
  }

  @Get('diagnosis-registry/:diagnosisRegistryId/lifecycle')
  @EditorialAccess()
  async getDiagnosisRegistryLifecycle(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisRegistryLifecyclePolicyService.getLifecycle(
      diagnosisRegistryId,
    );
  }

  @Get('diagnosis-registry/lifecycle/telemetry')
  @SeniorEditorialAccess()
  async getDiagnosisRegistryLifecycleTelemetry() {
    return this.diagnosisRegistryLifecycleTelemetryService.getTelemetry();
  }

  @Post('diagnosis-registry/lifecycle/normalize')
  @SeniorEditorialAccess()
  async normalizeDiagnosisRegistryLifecycleFlags() {
    return this.diagnosisRegistryLifecycleTelemetryService.normalizeAll();
  }

  @Post('diagnosis-registry/:diagnosisRegistryId/lifecycle/normalize')
  @SeniorEditorialAccess()
  async normalizeDiagnosisRegistryLifecycleFlagsForRow(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisRegistryLifecycleTelemetryService.normalizeOne(
      diagnosisRegistryId,
    );
  }

  @Get('diagnosis-registry/:diagnosisRegistryId/metadata-suggestions')
  @EditorialAccess()
  async getDiagnosisRegistryMetadataSuggestions(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisRegistryMetadataSuggestionService.suggestRegistryMetadata(
      diagnosisRegistryId,
    );
  }

  @Post('diagnosis-registry/:diagnosisRegistryId/metadata-suggestions/generate-ai')
  @SeniorEditorialAccess()
  async generateAiDiagnosisRegistryMetadataSuggestions(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: GenerateAiRegistryMetadataInput,
  ) {
    return this.diagnosisRegistryAiMetadataSuggestionService.generateAiMetadataSuggestion(
      diagnosisRegistryId,
      body,
    );
  }

  @Patch('diagnosis-registry/:diagnosisRegistryId/metadata')
  @SeniorEditorialAccess()
  async updateDiagnosisRegistryMetadata(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: UpdateDiagnosisRegistryMetadataDto,
  ) {
    return this.caseReviewService.updateDiagnosisRegistryMetadata(
      diagnosisRegistryId,
      body,
    );
  }

  @Post('diagnosis-registry/:diagnosisRegistryId/lifecycle/action')
  @SeniorEditorialAccess()
  async updateDiagnosisRegistryLifecycle(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: DiagnosisRegistryLifecycleActionBody,
  ) {
    return this.diagnosisRegistryLifecyclePolicyService.performAction({
      diagnosisRegistryId,
      reviewerUserId: request.user.id,
      action: this.parseLifecycleAction(body.action),
      isGeneratable: body.isGeneratable,
    });
  }

  @Get('diagnosis-registry/onboarding/summary')
  @EditorialAccess()
  async getDiagnosisRegistryOnboardingSummary() {
    return this.diagnosisEditorialOnboardingService.getSummary();
  }

  @Get('diagnosis-registry/:diagnosisRegistryId/onboarding')
  @EditorialAccess()
  async getDiagnosisRegistryOnboarding(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisEditorialOnboardingService.getOnboarding(
      diagnosisRegistryId,
    );
  }

  @Post('diagnosis-registry/:diagnosisRegistryId/onboarding/update-status')
  @SeniorEditorialAccess()
  async updateDiagnosisRegistryOnboardingStatus(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: { action?: OnboardingStatusAction },
  ) {
    return this.diagnosisEditorialOnboardingService.updateStatus(
      diagnosisRegistryId,
      body.action as OnboardingStatusAction,
    );
  }

  @Get('cases/:caseId')
  @EditorialAccess()
  async getEditorialCaseDetail(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.getCaseDetail(caseId);
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/full')
  @EditorialAccess()
  async getFullDiagnosisEditorialWorkspace(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisEditorialWorkspaceService.getFullWorkspace(
      diagnosisRegistryId,
    );
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId')
  @EditorialAccess()
  async getDiagnosisWorkspaceQualitySummary(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisWorkspaceQualityService.getSummary(
      diagnosisRegistryId,
    );
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/teaching-units')
  @EditorialAccess()
  async getDiagnosisTeachingUnitCoverage(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.teachingUnitCoverageService.getCoverage(diagnosisRegistryId);
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/teaching-rules')
  @EditorialAccess()
  async listDiagnosisTeachingRules(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.teachingRulesAdminService.listRules(diagnosisRegistryId);
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/editorial-brief')
  @EditorialAccess()
  async getDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisEditorialBriefService.getBrief(diagnosisRegistryId);
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/editorial-brief/generate')
  @EditorialAccess()
  async generateDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisEditorialBriefService.generateBrief(
      diagnosisRegistryId,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/editorial-brief')
  @EditorialAccess()
  async createDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
    ]);
    return this.diagnosisEditorialBriefService.createBrief(
      diagnosisRegistryId,
      body,
    );
  }

  @Patch('diagnosis-workspace/:diagnosisRegistryId/editorial-brief')
  @EditorialAccess()
  async updateDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
    ]);
    return this.diagnosisEditorialBriefService.updateBrief(
      diagnosisRegistryId,
      body,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/editorial-brief/review')
  @SeniorEditorialAccess()
  async reviewDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: { action?: unknown },
  ) {
    return this.diagnosisEditorialBriefService.reviewBrief(
      diagnosisRegistryId,
      body?.action,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/teaching-rules')
  @EditorialAccess()
  async createDiagnosisTeachingRule(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
      'REJECTED',
    ]);
    return this.teachingRulesAdminService.createRule(diagnosisRegistryId, body);
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/teaching-rules/generate')
  @EditorialAccess()
  async generateDiagnosisTeachingRules(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.teachingRulesAdminService.generateCandidateRules(
      diagnosisRegistryId,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/teaching-rules/seed-legacy')
  @EditorialAccess()
  async seedLegacyDiagnosisTeachingRules(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.teachingRulesAdminService.seedLegacyRulesForDiagnosis(
      diagnosisRegistryId,
    );
  }

  @Patch('teaching-rules/:ruleId')
  @EditorialAccess()
  async updateTeachingRule(
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
      'REJECTED',
    ]);
    return this.teachingRulesAdminService.updateRule(ruleId, body);
  }

  @Post('teaching-rules/:ruleId/review')
  @SeniorEditorialAccess()
  async reviewTeachingRule(
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
    @Body() body: { action?: unknown },
  ) {
    return this.teachingRulesAdminService.reviewRule(ruleId, body?.action);
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/generate-case')
  @EditorialAccess()
  async generateTargetedCase(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: TargetedCaseGenerationPayload,
  ) {
    this.validateTargetedCasePayload(body);

    return this.targetedCaseGenerationService.generate({
      diagnosisRegistryId,
      payload: body,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/draft-actions/generate-case-from-goal')
  @EditorialAccess()
  async generateCaseFromUncoveredGoal(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: TargetedCaseGenerationPayload,
  ) {
    this.validateTargetedCasePayload(body);

    const result = await this.targetedCaseGenerationService.generate({
      diagnosisRegistryId,
      payload: body,
    });

    return {
      action: 'generate_case_from_uncovered_goal',
      publicationStatus: 'draft',
      result,
    };
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/draft-actions/generate-discriminator-case')
  @EditorialAccess()
  async generateTargetedDiscriminatorCaseDraft(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: TargetedDiscriminatorCasePayload,
  ) {
    this.validateTargetedDiscriminatorPayload(body);

    return this.targetedCaseGenerationService.generateTargetedDiscriminatorCase({
      diagnosisRegistryId,
      payload: body,
      userId: request.user.id,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/draft-actions/generate-clue-revision')
  @EditorialAccess()
  async generateClueRevisionProposalDraft(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ClueRevisionProposalPayload,
  ) {
    this.validateClueRevisionPayload(body);

    return this.targetedCaseGenerationService.generateClueRevisionProposal({
      diagnosisRegistryId,
      payload: body,
      userId: request.user.id,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/draft-actions/repair-unsupported-claim')
  @EditorialAccess()
  async repairUnsupportedClaim(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: RepairUnsupportedClaimBody,
  ) {
    if (!body?.claimId) {
      throw new BadRequestException('claimId is required');
    }

    return this.diagnosisEditorialWorkspaceService.repairUnsupportedClaim({
      diagnosisRegistryId,
      claimId: body.claimId,
      userId: request.user.id,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/claims/:claimId/repair')
  @EditorialAccess()
  async repairUnsupportedClaimById(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('claimId') claimId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.diagnosisEditorialWorkspaceService.repairUnsupportedClaim({
      diagnosisRegistryId,
      claimId,
      userId: request.user.id,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/accept')
  @EditorialAccess()
  async acceptAiDraftRevision(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId,
      decision: 'accept',
      userId: request.user.id,
      note: body.note,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/reject')
  @EditorialAccess()
  async rejectAiDraftRevision(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId,
      decision: 'reject',
      userId: request.user.id,
      note: body.note,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/request-changes')
  @EditorialAccess()
  async requestAiDraftRevisionChanges(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId,
      decision: 'request_changes',
      userId: request.user.id,
      note: body.note,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/supersede')
  @EditorialAccess()
  async supersedeAiDraftRevision(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId,
      decision: 'supersede',
      userId: request.user.id,
      note: body.note,
    });
  }

  @Patch('case-clue-revision-drafts/:draftId')
  @EditorialAccess()
  async updateCaseClueRevisionDraft(
    @Param('draftId', new ParseUUIDPipe()) draftId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CaseClueRevisionDraftUpdateBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.updateClueRevisionDraft({
      draftId,
      payload: body,
      reviewerUserId: request.user.id,
    });
  }

  @Post('case-clue-revision-drafts/:draftId/approve')
  @EditorialAccess()
  async approveCaseClueRevisionDraft(
    @Param('draftId', new ParseUUIDPipe()) draftId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.approveClueRevisionDraft({
      draftId,
      reviewerUserId: request.user.id,
      note: body.note,
    });
  }

  @Post('case-clue-revision-drafts/:draftId/reject')
  @EditorialAccess()
  async rejectCaseClueRevisionDraft(
    @Param('draftId', new ParseUUIDPipe()) draftId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.rejectClueRevisionDraft({
      draftId,
      reviewerUserId: request.user.id,
      note: body.note,
    });
  }

  @Post('case-clue-revision-drafts/:draftId/request-changes')
  @EditorialAccess()
  async requestChangesForCaseClueRevisionDraft(
    @Param('draftId', new ParseUUIDPipe()) draftId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.requestChangesForClueRevisionDraft({
      draftId,
      reviewerUserId: request.user.id,
      note: body.note,
    });
  }

  @Post('case-clue-revision-drafts/:draftId/supersede')
  @EditorialAccess()
  async supersedeCaseClueRevisionDraft(
    @Param('draftId', new ParseUUIDPipe()) draftId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AiDraftDecisionBody = {},
  ) {
    return this.diagnosisEditorialWorkspaceService.supersedeClueRevisionDraft({
      draftId,
      reviewerUserId: request.user.id,
      note: body.note,
    });
  }

  @Post('case-clue-revision-drafts/:draftId/apply')
  @EditorialAccess()
  async applyCaseClueRevisionDraft(
    @Param('draftId', new ParseUUIDPipe()) draftId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.diagnosisEditorialWorkspaceService.applyApprovedClueRevisionDraft({
      draftId,
      reviewerUserId: request.user.id,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/case-learning-goal-coverage')
  @EditorialAccess()
  async createCaseLearningGoalCoverage(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CaseLearningGoalCoverageBody,
  ) {
    const payload = this.validateCaseLearningGoalCoverageBody(body);
    return this.diagnosisEditorialWorkspaceService.upsertCaseLearningGoalCoverage({
      diagnosisRegistryId,
      payload,
      userId: request.user.id,
    });
  }

  @Patch('diagnosis-workspace/:diagnosisRegistryId/case-learning-goal-coverage/:coverageId')
  @EditorialAccess()
  async updateCaseLearningGoalCoverage(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('coverageId', new ParseUUIDPipe()) coverageId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CaseLearningGoalCoverageBody,
  ) {
    const payload = this.validateCaseLearningGoalCoverageBody(body);
    return this.diagnosisEditorialWorkspaceService.upsertCaseLearningGoalCoverage({
      diagnosisRegistryId,
      coverageId,
      payload,
      userId: request.user.id,
    });
  }

  @Delete('diagnosis-workspace/:diagnosisRegistryId/case-learning-goal-coverage/:coverageId')
  @EditorialAccess()
  async deleteCaseLearningGoalCoverage(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('coverageId', new ParseUUIDPipe()) coverageId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.diagnosisEditorialWorkspaceService.deleteCaseLearningGoalCoverage({
      diagnosisRegistryId,
      coverageId,
      userId: request.user.id,
    });
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/case-escalation-annotations')
  @EditorialAccess()
  async createCaseEscalationAnnotation(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CaseEscalationAnnotationBody,
  ) {
    const payload = this.validateCaseEscalationAnnotationBody(body);
    return this.diagnosisEditorialWorkspaceService.upsertCaseEscalationAnnotation({
      diagnosisRegistryId,
      payload,
      userId: request.user.id,
    });
  }

  @Patch('diagnosis-workspace/:diagnosisRegistryId/case-escalation-annotations/:annotationId')
  @EditorialAccess()
  async updateCaseEscalationAnnotation(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('annotationId', new ParseUUIDPipe()) annotationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CaseEscalationAnnotationBody,
  ) {
    const payload = this.validateCaseEscalationAnnotationBody(body);
    return this.diagnosisEditorialWorkspaceService.upsertCaseEscalationAnnotation({
      diagnosisRegistryId,
      annotationId,
      payload,
      userId: request.user.id,
    });
  }

  @Delete('diagnosis-workspace/:diagnosisRegistryId/case-escalation-annotations/:annotationId')
  @EditorialAccess()
  async deleteCaseEscalationAnnotation(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('annotationId', new ParseUUIDPipe()) annotationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.diagnosisEditorialWorkspaceService.deleteCaseEscalationAnnotation({
      diagnosisRegistryId,
      annotationId,
      userId: request.user.id,
    });
  }

  @Get('cases/:caseId/discriminator-annotations')
  @EditorialAccess()
  async listCaseDiscriminatorAnnotations(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.diagnosisEditorialWorkspaceService.listDiscriminatorAnnotationsForCase(
      caseId,
    );
  }

  @Post('cases/:caseId/discriminator-annotations')
  @EditorialAccess()
  async createCaseDiscriminatorAnnotation(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CaseClueDiscriminatorAnnotationBody,
  ) {
    return this.diagnosisEditorialWorkspaceService.createDiscriminatorAnnotation(
      caseId,
      body,
      request.user.id,
    );
  }

  @Patch('cases/:caseId/discriminator-annotations/:annotationId')
  @EditorialAccess()
  async updateCaseDiscriminatorAnnotation(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Param('annotationId', new ParseUUIDPipe()) annotationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CaseClueDiscriminatorAnnotationBody,
  ) {
    return this.diagnosisEditorialWorkspaceService.updateDiscriminatorAnnotation(
      caseId,
      annotationId,
      body,
      request.user.id,
    );
  }

  @Delete('cases/:caseId/discriminator-annotations/:annotationId')
  @EditorialAccess()
  async deleteCaseDiscriminatorAnnotation(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Param('annotationId', new ParseUUIDPipe()) annotationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.diagnosisEditorialWorkspaceService.deleteDiscriminatorAnnotation(
      caseId,
      annotationId,
      request.user.id,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/draft-actions/strengthen-differential')
  @EditorialAccess()
  async strengthenDifferentialDraft(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    const result = await this.reasoningPathService.generateCandidates({
      diagnosisRegistryId,
    });

    return {
      action: 'strengthen_differential',
      publicationStatus: 'draft',
      result,
    };
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/draft-actions/suggest-teaching-distinction')
  @EditorialAccess()
  async suggestTeachingDistinctionDraft(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    const result =
      await this.diagnosisTeachingRelationshipService.generateCandidates({
        diagnosisRegistryId,
      });

    return {
      action: 'suggest_teaching_distinction',
      publicationStatus: 'draft',
      result,
    };
  }

  @Get('diagnosis-registry')
  @EditorialAccess()
  async searchDiagnosisRegistry(@Query() query: SearchDiagnosisRegistryDto) {
    return this.caseReviewService.searchDiagnosisRegistry(query);
  }

  @Post('diagnosis-registry')
  async createDiagnosisRegistry(@Body() body: CreateDiagnosisRegistryDto) {
    return this.caseReviewService.createDiagnosisRegistry(body);
  }

  @Post('diagnosis-registry/:diagnosisRegistryId/aliases')
  async addDiagnosisAlias(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: CreateDiagnosisAliasDto,
  ) {
    return this.caseReviewService.addDiagnosisAlias(diagnosisRegistryId, body);
  }

  @Post('cases/:caseId/rerun-validation')
  @EditorialAccess()
  async rerunValidation(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.rerunValidation(caseId, request.user.id);
  }

  @Post('cases/:caseId/start-review')
  @EditorialAccess()
  async startReview(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.startReview(caseId, request.user.id);
  }

  @Post('cases/:caseId/review')
  @SeniorEditorialAccess()
  async submitReview(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: SubmitCaseReviewDto,
  ) {
    return this.caseReviewService.submitReview(caseId, request.user.id, body);
  }

  @Post('cases/:caseId/diagnosis-link')
  @EditorialAccess()
  async linkDiagnosisToCase(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: LinkCaseDiagnosisDto,
  ) {
    return this.caseReviewService.linkDiagnosisToCase(
      caseId,
      request.user.id,
      body,
    );
  }

  @Patch('cases/:caseId/diagnosis')
  @EditorialAccess()
  async updateCaseDiagnosis(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateCaseDiagnosisDto,
  ) {
    return this.caseReviewService.updateCaseDiagnosis(
      caseId,
      request.user.id,
      body,
    );
  }

  @Post('cases/:caseId/create-and-link-diagnosis')
  @EditorialAccess()
  async createAndLinkDiagnosis(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateAndLinkDiagnosisDto,
  ) {
    return this.caseReviewService.createAndLinkDiagnosis(
      caseId,
      request.user.id,
      body,
    );
  }

  @Get('cases/:caseId/revisions')
  @EditorialAccess()
  async listRevisions(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.caseReviewService.listRevisions(caseId);
  }

  @Post('cases/:caseId/revisions/:revisionId/restore')
  @EditorialAccess()
  async restoreRevision(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.restoreRevision(
      caseId,
      revisionId,
      request.user.id,
    );
  }

  @Post('cases/:caseId/ready-to-publish')
  @SeniorEditorialAccess()
  async markReadyToPublish(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.markReadyToPublish(caseId);
  }

  @Post('generate-cases')
  async generateCases(@Body() body: GenerateCasesBody = {}) {
    const diagnosisRegistryIds = this.validateDiagnosisRegistryIds(
      body.diagnosisRegistryIds,
    );
    const count = body.count ?? diagnosisRegistryIds?.length ?? 10;
    if (count > 50) {
      throw new BadRequestException('Max 50 per request');
    }

    return this.caseGenerator.generateBatch({
      count,
      track: body.track,
      bodySystem: body.bodySystem,
      difficulty: body.difficulty,
      registryFirst: body.registryFirst !== false,
      diagnosisRegistryIds,
    });
  }

  private validateDiagnosisRegistryIds(value: unknown): string[] | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException('diagnosisRegistryIds must be an array');
    }

    if (value.length === 0) {
      return undefined;
    }

    if (value.length > 20) {
      throw new BadRequestException(
        'diagnosisRegistryIds supports at most 20 IDs',
      );
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ids = value.map((item) => {
      if (typeof item !== 'string' || !uuidPattern.test(item)) {
        throw new BadRequestException(
          'diagnosisRegistryIds must contain only UUID strings',
        );
      }

      return item;
    });

    return [...new Set(ids)];
  }

  private requireUuidLike(value: unknown, fieldName: string): string {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (typeof value !== 'string' || !uuidPattern.test(value)) {
      throw new BadRequestException(`${fieldName} must be a UUID string`);
    }

    return value;
  }

  private validateCaseLearningGoalCoverageBody(
    body: CaseLearningGoalCoverageBody,
  ): Required<
    Pick<
      CaseLearningGoalCoverageBody,
      'caseId' | 'learningGoalId' | 'learningGoal'
    >
  > &
    Omit<CaseLearningGoalCoverageBody, 'caseId' | 'learningGoalId' | 'learningGoal'> {
    if (!body?.caseId || !body.learningGoalId || !body.learningGoal) {
      throw new BadRequestException(
        'caseId, learningGoalId, and learningGoal are required',
      );
    }
    return {
      ...body,
      caseId: body.caseId,
      learningGoalId: body.learningGoalId,
      learningGoal: body.learningGoal,
    };
  }

  private validateCaseEscalationAnnotationBody(
    body: CaseEscalationAnnotationBody,
  ): Required<Pick<CaseEscalationAnnotationBody, 'caseId' | 'escalationType'>> &
    Omit<CaseEscalationAnnotationBody, 'caseId' | 'escalationType'> {
    if (!body?.caseId || !body.escalationType) {
      throw new BadRequestException('caseId and escalationType are required');
    }
    return {
      ...body,
      caseId: body.caseId,
      escalationType: body.escalationType,
    };
  }

  private validateTargetedCasePayload(
    body: TargetedCaseGenerationPayload,
  ): void {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required');
    }

    if (!['EASY', 'MEDIUM', 'HARD'].includes(body.difficulty)) {
      throw new BadRequestException('difficulty must be EASY, MEDIUM, or HARD');
    }

    if (
      body.clueRevealStrategy !== undefined &&
      ![
        'classic',
        'early_anchor',
        'late_discriminator',
        'progressive_narrowing',
      ].includes(body.clueRevealStrategy)
    ) {
      throw new BadRequestException('Invalid clueRevealStrategy');
    }
  }

  private validateTargetedDiscriminatorPayload(
    body: TargetedDiscriminatorCasePayload,
  ): void {
    if (!body || typeof body !== 'object' || !body.target) {
      throw new BadRequestException('target is required');
    }
    this.validateTargetedCasePayload({
      difficulty: body.difficulty ?? 'MEDIUM',
      teachingUnitIds: body.teachingUnitIds ?? [],
      reasoningPathId: body.reasoningPathId,
      clueRevealStrategy: body.clueRevealStrategy,
      discriminatorTarget: body.target,
    });
  }

  private validateClueRevisionPayload(body: ClueRevisionProposalPayload): void {
    if (!body || typeof body !== 'object' || !body.target) {
      throw new BadRequestException('target is required');
    }
    if (
      body.desiredClueOrder !== undefined &&
      (!Number.isInteger(body.desiredClueOrder) || body.desiredClueOrder < 1)
    ) {
      throw new BadRequestException('desiredClueOrder must be a positive integer');
    }
  }

  private parseDifferentialSourceType(value: string | undefined) {
    if (!value) {
      return undefined;
    }
    if (value === 'case' || value === 'education') {
      return value;
    }
    throw new BadRequestException('sourceType must be case or education');
  }

  private parseDifferentialStatus(value: string | undefined) {
    if (!value) {
      return undefined;
    }
    if (
      Object.values(DifferentialResolutionStatus).includes(
        value as DifferentialResolutionStatus,
      )
    ) {
      return value as DifferentialResolutionStatus;
    }
    throw new BadRequestException('Invalid differential mapping status');
  }

  private parseRegistryCandidateStatus(value: string | undefined) {
    if (!value) {
      return undefined;
    }
    if (
      Object.values(DiagnosisRegistryCandidateStatus).includes(
        value as DiagnosisRegistryCandidateStatus,
      )
    ) {
      return value as DiagnosisRegistryCandidateStatus;
    }
    throw new BadRequestException(
      'Invalid diagnosis registry candidate status',
    );
  }

  private parseCoverageQuery(query: {
    specialty?: string;
    lifecycleState?: string;
    onboardingState?: string;
    coverageWeakness?: string;
    playableOnly?: string;
  }): EditorialCoverageQuery {
    return {
      specialty: query.specialty || undefined,
      lifecycleState: query.lifecycleState || undefined,
      onboardingState: query.onboardingState || undefined,
      coverageWeakness: query.coverageWeakness || undefined,
      playableOnly:
        query.playableOnly === 'true' || query.playableOnly === '1',
    };
  }

  private parsePlannerQuery(query: {
    specialty?: string;
    onboardingStatus?: string;
    onboardingState?: string;
    lifecycleReadiness?: string;
    lifecycleState?: string;
    priorityTier?: string;
    track?: string;
    playableOnly?: string;
  }): CurriculumPlannerQuery {
    return {
      specialty: query.specialty || undefined,
      onboardingStatus: query.onboardingStatus || undefined,
      onboardingState: query.onboardingState || undefined,
      lifecycleReadiness: query.lifecycleReadiness || undefined,
      lifecycleState: query.lifecycleState || undefined,
      priorityTier: query.priorityTier || undefined,
      track: query.track || undefined,
      playableOnly:
        query.playableOnly === 'true' || query.playableOnly === '1',
    };
  }

  private parseEvidenceCoverageQuery(query: {
    specialty?: string;
    evidenceWeakness?: string;
    readinessTier?: string;
    playableOnly?: string;
    onboardingStatus?: string;
  }): EvidenceCoverageQuery {
    return {
      specialty: query.specialty || undefined,
      evidenceWeakness: query.evidenceWeakness || undefined,
      readinessTier: query.readinessTier || undefined,
      onboardingStatus: query.onboardingStatus || undefined,
      playableOnly:
        query.playableOnly === 'true' || query.playableOnly === '1',
    };
  }

  private parseLifecycleAction(
    value:
      | DiagnosisRegistryLifecycleAction
      | 'ACTIVATE_FOR_DICTIONARY'
      | undefined,
  ): DiagnosisRegistryLifecycleAction {
    const allowedActions: DiagnosisRegistryLifecycleAction[] = [
      'activate',
      'activate_for_dictionary',
      'deactivate',
      'mark_playable',
      'unmark_playable',
      'mark_generatable',
      'unmark_generatable',
    ];

    const normalizedValue =
      value === 'ACTIVATE_FOR_DICTIONARY'
        ? 'activate_for_dictionary'
        : value;

    if (
      normalizedValue &&
      allowedActions.includes(normalizedValue as DiagnosisRegistryLifecycleAction)
    ) {
      return normalizedValue as DiagnosisRegistryLifecycleAction;
    }

    throw new BadRequestException('Invalid diagnosis registry lifecycle action');
  }

  private assertDraftLevelStatus(
    body: Record<string, unknown>,
    role: string | null | undefined,
    seniorOnlyStatuses: string[],
  ) {
    const status = typeof body.status === 'string' ? body.status : null;
    if (
      status &&
      seniorOnlyStatuses.includes(status) &&
      !canPublishEditorial(role)
    ) {
      throw new ForbiddenException('Requires senior editor');
    }
  }
}
