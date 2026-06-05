import {
  BadRequestException,
  Body,
  Controller,
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
  TargetedCaseGenerationService,
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

type GenerateCasesBody = {
  count?: number;
  track?: string;
  bodySystem?: string;
  difficulty?: string;
  registryFirst?: boolean;
  diagnosisRegistryIds?: string[];
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
    private readonly diagnosisEditorialBriefService: DiagnosisEditorialBriefService,
    private readonly differentialMappingService: DifferentialMappingService,
    private readonly diagnosisRegistryCandidateService: DiagnosisRegistryCandidateService,
    private readonly diagnosisEditorialOnboardingService: DiagnosisEditorialOnboardingService,
    private readonly diagnosisRegistryLifecyclePolicyService: DiagnosisRegistryLifecyclePolicyService,
    private readonly diagnosisRegistryMergeAnalysisService: DiagnosisRegistryMergeAnalysisService,
    private readonly diagnosisRegistryMergeExecutionService: DiagnosisRegistryMergeExecutionService,
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
  ) {
    return this.diagnosisRegistryCandidateService.listCandidates({
      status: this.parseRegistryCandidateStatus(status),
      limit: limit ? Number(limit) : undefined,
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

  @Post('diagnosis-registry/:diagnosisRegistryId/lifecycle/action')
  @SeniorEditorialAccess()
  async updateDiagnosisRegistryLifecycle(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: { action?: DiagnosisRegistryLifecycleAction },
  ) {
    return this.diagnosisRegistryLifecyclePolicyService.performAction({
      diagnosisRegistryId,
      reviewerUserId: request.user.id,
      action: this.parseLifecycleAction(body.action),
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
    value: DiagnosisRegistryLifecycleAction | undefined,
  ): DiagnosisRegistryLifecycleAction {
    const allowedActions: DiagnosisRegistryLifecycleAction[] = [
      'activate',
      'deactivate',
      'mark_playable',
      'unmark_playable',
      'mark_generatable',
      'unmark_generatable',
    ];

    if (value && allowedActions.includes(value)) {
      return value;
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
