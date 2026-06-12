import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  DifferentialResolutionStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisEducationStatus,
  ValidationOutcome,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { DiagnosisGraphCandidatesService } from '../diagnosis-graph/diagnosis-graph-candidates.service';
import { DifferentialLinkService } from '../diagnosis-graph/differential-link.service';
import {
  EducationRevisionQualityAnalyzer,
  type EducationRevisionAnalysis,
} from '../education/education-revision-quality-analyzer.service';
import { CaseQualityProjectionService } from './case-quality-projection.service';
import {
  DiagnosisWorkspaceQualityService,
  type DiagnosisWorkspaceQualitySummary,
} from './diagnosis-workspace-quality.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';
import {
  TeachingUnitCoverageService,
  type TeachingUnitCoverageMap,
} from './teaching-unit-coverage.service';
import { DiagnosisEditorialBriefService } from '../education/diagnosis-editorial-brief.service';
import { DiagnosisEditorialOnboardingService } from './diagnosis-editorial-onboarding.service';
import { DiagnosisRegistryLifecyclePolicyService } from '../diagnosis-registry/diagnosis-registry-lifecycle-policy.service';
import { EvidenceCoverageService } from './evidence-coverage.service';
import { ReasoningPathService } from './reasoning-path.service';
import { EditorialTriageProjectionService } from './editorial-triage-projection.service';

type LifecycleState = 'complete' | 'warning' | 'blocked' | 'not_started';
type ReadinessSeverity = 'info' | 'warning' | 'blocker';
type TargetTab =
  | 'overview'
  | 'teaching-rules'
  | 'editorial-brief'
  | 'education'
  | 'cases'
  | 'graph';

type CoverageStatus = 'covered' | 'partial' | 'missing' | 'unknown';

type ActionDescriptor = {
  id: string;
  label: string;
  source?: string;
  severity?: ReadinessSeverity;
  permission?: string;
  targetTab: TargetTab;
  enabled: boolean;
  disabledReason: string | null;
  targetEndpoint?: string;
};

type CaseRow = {
  id: string;
  title: string;
  difficulty: string;
  editorialStatus: CaseEditorialStatus | null;
  date: Date;
  explanation: Prisma.JsonValue | null;
  validationRuns: Array<{
    outcome: ValidationOutcome | null;
    summary: Prisma.JsonValue | null;
    findings: Prisma.JsonValue | null;
  }>;
};

type GraphFactRow = {
  id: string;
  type: DiagnosisGraphCandidateType;
  label: string;
  targetDiagnosisRegistryId: string | null;
  updatedAt: Date;
};

type RegistryRow = {
  id: string;
  canonicalName: string;
  displayLabel: string;
  onboardingStatus: string | null;
  onboardingStartedAt: Date | null;
  onboardingCompletedAt: Date | null;
  specialty: string | null;
  category: string | null;
  bodySystem: string | null;
  difficultyBand: string | null;
  aliases: Array<{ term: string }>;
  education: {
    id: string;
    editorialStatus: string;
    version: number;
    updatedAt: Date;
    summary: Prisma.JsonValue | null;
    clinicalPattern: Prisma.JsonValue | null;
    keySymptoms: Prisma.JsonValue | null;
    keySigns: Prisma.JsonValue | null;
    examPearls: Prisma.JsonValue | null;
    scoringSystems: Prisma.JsonValue | null;
    investigations: Prisma.JsonValue | null;
    differentials: Prisma.JsonValue | null;
    management: Prisma.JsonValue | null;
    complications: Prisma.JsonValue | null;
    pitfalls: Prisma.JsonValue | null;
    recallPrompts: Prisma.JsonValue | null;
    references: Prisma.JsonValue | null;
  } | null;
  editorialBrief: {
    id: string;
    status: string;
    version: number;
    summary: string;
    learningGoals: Prisma.JsonValue;
    updatedAt: Date;
  } | null;
  cases: CaseRow[];
  graphFacts: GraphFactRow[];
};

@Injectable()
export class DiagnosisEditorialWorkspaceService {
  private readonly fallbackEditorialTriageProjectionService =
    new EditorialTriageProjectionService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisWorkspaceQualityService: DiagnosisWorkspaceQualityService,
    private readonly teachingUnitCoverageService: TeachingUnitCoverageService,
    private readonly teachingRulesAdminService: TeachingRulesAdminService,
    private readonly diagnosisEditorialBriefService: DiagnosisEditorialBriefService,
    private readonly educationRevisionQualityAnalyzer: EducationRevisionQualityAnalyzer,
    private readonly caseQualityProjectionService: CaseQualityProjectionService,
    private readonly diagnosisGraphCandidatesService: DiagnosisGraphCandidatesService,
    private readonly differentialLinkService?: DifferentialLinkService,
    @Optional()
    private readonly diagnosisEditorialOnboardingService?: DiagnosisEditorialOnboardingService,
    @Optional()
    private readonly diagnosisRegistryLifecyclePolicyService?: DiagnosisRegistryLifecyclePolicyService,
    @Optional()
    private readonly evidenceCoverageService?: EvidenceCoverageService,
    @Optional()
    private readonly reasoningPathService?: ReasoningPathService,
    @Optional()
    private readonly editorialTriageProjectionService?: EditorialTriageProjectionService,
  ) {}

  async getFullWorkspace(diagnosisRegistryId: string) {
    const registry = await this.loadRegistry(diagnosisRegistryId);
    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const [
      summaryResult,
      coverageResult,
      rulesResult,
      briefResult,
      revisionsResult,
      graphCandidatesResult,
      differentialSummaryResult,
      differentialCoverageResult,
      linkedDifferentialsResult,
      teachingRelationshipsResult,
      evidenceGraphResult,
      registryCandidateCountsResult,
      onboardingResult,
      lifecycleGovernanceResult,
      evidenceCoverageResult,
      reasoningPathsResult,
      unsupportedClaimsResult,
      caseLearningGoalCoverageResult,
      caseEscalationAnnotationsResult,
      aiDraftAuditTrailResult,
    ] = await Promise.allSettled([
      this.diagnosisWorkspaceQualityService.getSummary(diagnosisRegistryId),
      this.teachingUnitCoverageService.getCoverage(diagnosisRegistryId),
      this.teachingRulesAdminService.listRules(diagnosisRegistryId),
      this.diagnosisEditorialBriefService.getBrief(diagnosisRegistryId),
      this.educationRevisionQualityAnalyzer.listRevisions(diagnosisRegistryId),
      this.diagnosisGraphCandidatesService.listCandidates({
        diagnosisRegistryId,
      }),
      this.getDifferentialResolutionSummary(diagnosisRegistryId),
      this.differentialLinkService?.getCoverageForDiagnosis(
        diagnosisRegistryId,
      ),
      this.differentialLinkService?.getLinkedDifferentialsForDiagnosis(
        diagnosisRegistryId,
      ),
      this.getTeachingRelationships(diagnosisRegistryId),
      this.getEvidenceGraph(diagnosisRegistryId),
      this.getRegistryCandidateCounts(diagnosisRegistryId),
      this.diagnosisEditorialOnboardingService?.getOnboarding(
        diagnosisRegistryId,
      ),
      this.diagnosisRegistryLifecyclePolicyService?.getLifecycle(
        diagnosisRegistryId,
      ),
      this.evidenceCoverageService?.getDiagnosis(diagnosisRegistryId),
      this.reasoningPathService?.listPaths({ diagnosisRegistryId }),
      this.getUnsupportedClaimsBySection(diagnosisRegistryId),
      this.getPersistedCaseLearningGoalCoverage(diagnosisRegistryId),
      this.getPersistedCaseEscalationAnnotations(diagnosisRegistryId),
      this.getAiDraftAuditTrail(diagnosisRegistryId),
    ]);

    const compositionWarnings = this.compositionWarnings({
      summaryResult,
      coverageResult,
      rulesResult,
      briefResult,
      revisionsResult,
      graphCandidatesResult,
    });
    const summary = this.valueOrNull(summaryResult);
    const coverage = this.valueOrNull(coverageResult);
    const rules = this.valueOrNull(rulesResult) ?? {
      diagnosisRegistryId,
      diagnosisName: this.diagnosisName(registry),
      rules: [],
    };
    const briefResponse = this.valueOrNull(briefResult);
    const revisions = this.valueOrNull(revisionsResult)?.revisions ?? [];
    const graphCandidates = this.valueOrNull(graphCandidatesResult) ?? [];
    const differentialResolutionSummary =
      this.valueOrNull(differentialSummaryResult) ??
      this.emptyDifferentialResolutionSummary();
    const differentialCoverage =
      this.valueOrNull(differentialCoverageResult) ??
      this.emptyDifferentialCoverage();
    const linkedDifferentials =
      this.valueOrNull(linkedDifferentialsResult) ?? [];
    const teachingRelationships =
      this.valueOrNull(teachingRelationshipsResult) ?? [];
    const evidenceGraph =
      this.valueOrNull(evidenceGraphResult) ?? this.emptyEvidenceGraph();
    const registryCandidateCounts =
      this.valueOrNull(registryCandidateCountsResult) ??
      this.emptyRegistryCandidateCounts();
    const onboarding = this.valueOrNull(onboardingResult) ?? null;
    const lifecycleGovernance =
      this.valueOrNull(lifecycleGovernanceResult) ?? null;
    const evidenceCoverage = this.valueOrNull(evidenceCoverageResult) ?? null;
    const reasoningPaths = this.valueOrNull(reasoningPathsResult) ?? [];
    const unsupportedClaimsBySection =
      this.valueOrNull(unsupportedClaimsResult) ?? [];
    const persistedCaseLearningGoalCoverage =
      this.valueOrNull(caseLearningGoalCoverageResult) ?? [];
    const persistedCaseEscalationAnnotations =
      this.valueOrNull(caseEscalationAnnotationsResult) ?? [];
    const aiDraftAuditTrail = this.valueOrNull(aiDraftAuditTrailResult) ?? [];
    const cases = this.buildCases(registry.cases);
    const coverageMatrix = this.buildCoverageMatrix({
      coverage,
      rules: rules.rules,
    });
    const coverageGaps = this.buildCoverageGaps(coverageMatrix);
    const lifecycle = this.buildLifecycle({
      rules: rules.rules,
      summary,
      registry,
      coverageGaps,
    });
    const readinessBreakdown = this.buildReadinessBreakdown({
      summary,
      coverageGaps,
      compositionWarnings,
    });
    const recommendedActions = this.buildRecommendedActions({
      registry,
      summary,
      coverageGaps,
      graphCandidateCount: graphCandidates.length,
    });
    const availableActions = this.buildAvailableActions({
      registry,
      hasEducation: Boolean(registry.education),
    });
    const learningGoalCoverage = this.buildLearningGoalCoverage({
      registry,
      brief: briefResponse?.brief ?? registry.editorialBrief,
      cases,
      coverageGaps,
      teachingRelationships,
      evidenceCoverage,
      reasoningPaths,
      persistedCoverage: persistedCaseLearningGoalCoverage,
    });
    const caseEscalationCoverage = this.buildCaseEscalationCoverage({
      persistedAnnotations: persistedCaseEscalationAnnotations,
      reasoningPaths,
      cases,
    });
    const escalationCoverage = this.buildEscalationCoverage({
      reasoningPaths,
      teachingRelationships,
      evidenceGraph,
      cases,
      evidenceCoverage,
      caseEscalationCoverage,
    });
    const maturityGovernance = this.buildMaturityGovernance({
      registry,
      summary,
      cases,
      coverageGaps,
      differentialCoverage,
      evidenceCoverage,
      lifecycleGovernance,
      escalationCoverage,
      learningGoalCoverage,
    });
    const editorialPrioritization = this.triageProjectionService.project({
      workspaceBlockerCount: summary?.blockers.length ?? 0,
      coverageBlockerCount: coverageGaps.filter(
        (gap) => gap.severity === 'blocker',
      ).length,
      missingGraphGapCount: coverageGaps.filter((gap) => gap.missingGraph)
        .length,
      unsupportedClaimCount: unsupportedClaimsBySection.length,
      unsupportedClaimBlockerCount: unsupportedClaimsBySection.filter(
        (claim) => claim.blocksPublication || claim.severity === 'blocker',
      ).length,
      escalationMissing: !escalationCoverage.coversEscalation,
      totalDifferentials: differentialCoverage.totalDifferentials,
      resolvedDifferentials: differentialCoverage.resolvedLinks,
      discriminatorRuleCount: rules.rules.filter((rule) =>
        ['differential_concept', 'pitfall_concept'].includes(rule.category),
      ).length,
      totalCases: cases.summary.total,
      usableCases: cases.summary.usable,
      evidenceCoverageScore: evidenceCoverage?.coverageScore ?? null,
      lowTrustDraftCount:
        evidenceCoverage?.coverageBreakdown?.lowTrustDraftCount ?? 0,
      blockedDraftCount:
        evidenceCoverage?.coverageBreakdown?.blockedDraftCount ?? 0,
      hallucinationRiskDraftCount:
        evidenceCoverage?.coverageBreakdown?.hallucinationRiskDraftCount ?? 0,
      pendingDraftCount: aiDraftAuditTrail.filter((audit) =>
        ['PENDING_REVIEW', 'REVIEW_REQUIRED'].includes(audit.reviewStatus),
      ).length,
      maturityOverall: maturityGovernance.breakdown.overall,
      lifecyclePlayable: lifecycle.gameplay === 'complete',
      lifecycleActive: lifecycle.curriculum !== 'blocked',
      hasEducation: Boolean(registry.education),
      activeTeachingRuleCount: rules.rules.length,
      graphRelationshipCount: registry.graphFacts.length,
    });

    return {
      diagnosis: {
        id: registry.id,
        displayLabel: registry.displayLabel,
        canonicalName: registry.canonicalName,
        aliases: registry.aliases.map((alias) => alias.term),
        specialty: registry.specialty,
        category: registry.category,
        bodySystem: registry.bodySystem,
        difficultyBand: registry.difficultyBand,
        onboardingStatus: registry.onboardingStatus,
        onboardingStartedAt: registry.onboardingStartedAt
          ? this.toIso(registry.onboardingStartedAt)
          : null,
        onboardingCompletedAt: registry.onboardingCompletedAt
          ? this.toIso(registry.onboardingCompletedAt)
          : null,
      },
      onboarding,
      onboardingStatus: onboarding?.onboardingStatus ?? registry.onboardingStatus,
      onboardingProgress: onboarding?.progress ?? null,
      onboardingRecommendations: onboarding?.recommendedActions ?? [],
      lifecycle,
      lifecycleGovernance,
      workspaceSummary: {
        status:
          summary?.overallWorkspaceStatus ??
          (lifecycle.ready === 'complete' ? 'ready' : 'needs_review'),
        overallScore: summary?.teachingCoverage.overall ?? null,
        graphReadiness: summary?.educationQuality.graphReadiness ?? null,
        educationScore: summary?.educationQuality.score ?? null,
        caseQualitySummary: summary?.caseQuality ?? cases.summary,
        blockers: summary?.blockers ?? [],
        warnings: this.unique([
          ...(summary?.warnings ?? []),
          ...compositionWarnings,
        ]),
        recommendedActions: summary?.recommendedNextActions ?? [],
        unresolvedDifferentialCount:
          differentialResolutionSummary.unresolved +
          differentialResolutionSummary.ambiguous,
        registryCandidateCount: registryCandidateCounts.registryCandidateCount,
        pendingRegistryCandidateCount:
          registryCandidateCounts.pendingRegistryCandidateCount,
        differentialResolutionSummary,
        differentialCoverage,
      },
      readinessBreakdown,
      coverageMatrix,
      coverageGaps,
      teachingRules: {
        summary: this.teachingRuleSummary(rules.rules),
        items: rules.rules,
      },
      editorialBrief: this.buildEditorialBrief(
        briefResponse?.brief ?? registry.editorialBrief,
      ),
      education: this.buildEducation(registry.education, summary, revisions[0]),
      revisions: {
        latest: revisions[0] ?? null,
        items: revisions,
      },
      cases,
      graph: {
        readiness:
          summary?.graphReadiness.status ??
          this.graphReadinessFromRegistry(registry),
        factCount:
          summary?.graphReadiness.factCount ?? registry.graphFacts.length,
        candidateCount:
          summary?.graphReadiness.candidateCount ?? graphCandidates.length,
        reviewableCandidateCount:
          summary?.graphReadiness.reviewableCandidateCount ??
          graphCandidates.filter((candidate) =>
            this.isReviewableCandidateStatus(String(candidate.status)),
          ).length,
        candidates: graphCandidates,
        factsSummary: this.graphFactsSummary(registry.graphFacts),
        teachingRelationships,
      },
      evidenceGraph,
      evidenceCoverage,
      reasoningPaths,
      linkedDifferentials,
      unsupportedClaimsBySection,
      learningGoalCoverage,
      caseLearningGoalCoverage: persistedCaseLearningGoalCoverage,
      caseEscalationCoverage,
      escalationCoverage,
      maturityBreakdown: maturityGovernance.breakdown,
      maturityWeighting: maturityGovernance.weighting,
      maturityExplanation: maturityGovernance.explanation,
      editorialPrioritization,
      aiDraftAuditTrail,
      editorialLearning: {
        available: revisions.length >= 2,
        candidateCounts: {
          teachingRuleCandidates: rules.rules.filter(
            (rule) => rule.status === 'CANDIDATE',
          ).length,
          graphFactCandidates: graphCandidates.filter((candidate) =>
            this.isReviewableCandidateStatus(String(candidate.status)),
          ).length,
          patternImprovementCandidates: 0,
          diagnosisSpecificPearlCandidates: 0,
        },
        recentThemes: this.recentLearningThemes(revisions),
      },
      recommendedActions,
      availableActions,
    };
  }

  private get triageProjectionService() {
    return (
      this.editorialTriageProjectionService ??
      this.fallbackEditorialTriageProjectionService
    );
  }

  async repairUnsupportedClaim(input: {
    diagnosisRegistryId: string;
    claimId: string;
    userId?: string | null;
  }) {
    const claim = await this.findUnsupportedClaim(
      input.diagnosisRegistryId,
      input.claimId,
    );
    if (!claim) {
      throw new NotFoundException('Unsupported claim signal not found');
    }

    const evidenceIds = claim.evidenceIds;
    const proposedClaim = this.proposeClaimRepair(claim.claimText, evidenceIds);
    const confidence = evidenceIds.length ? 0.72 : 0.42;
    const audit = await this.prisma.aiDraftRevisionAudit.create({
      data: {
        diagnosisRegistryId: input.diagnosisRegistryId,
        actionType: 'repair_unsupported_claim',
        sourceIssue: {
          claimId: claim.claimId,
          sectionId: claim.sectionId,
          sectionType: claim.sectionType,
          severity: claim.severity,
          originalClaim: claim.claimText,
        } as Prisma.InputJsonValue,
        inputContext: {
          repairTarget: claim.repairTarget,
          evidenceIds,
          sourceType: claim.sourceType,
          artifactId: claim.artifactId,
        } as Prisma.InputJsonValue,
        generatedOutput: {
          originalClaim: claim.claimText,
          proposedClaim,
          evidenceIds,
          confidence,
        } as Prisma.InputJsonValue,
        affectedArtifactType: claim.sourceType,
        affectedArtifactId: claim.artifactId,
        reviewStatus: 'PENDING_REVIEW',
        createdByUserId: input.userId ?? null,
      },
    });

    return {
      repairId: audit.id,
      auditId: audit.id,
      claimId: claim.claimId,
      targetClaimId: claim.claimId,
      targetSectionId: claim.sectionId,
      targetTab: 'education',
      originalClaim: claim.claimText,
      proposedClaim,
      evidenceIds,
      confidence,
      reviewStatus: audit.reviewStatus,
      revisionId: audit.id,
    };
  }

  async decideAiDraftRevision(input: {
    diagnosisRegistryId: string;
    auditId: string;
    decision: 'accept' | 'reject' | 'request_changes' | 'supersede';
    userId: string;
    note?: string | null;
  }) {
    const audit = await this.prisma.aiDraftRevisionAudit.findFirst({
      where: {
        id: input.auditId,
        diagnosisRegistryId: input.diagnosisRegistryId,
      },
    });
    if (!audit) {
      throw new NotFoundException('AI draft revision audit not found');
    }

    if (input.decision === 'accept') {
      await this.applyAcceptedDraftOutput(audit, input.userId);
    }

    const status = this.reviewStatusForDecision(input.decision);
    return this.prisma.aiDraftRevisionAudit.update({
      where: { id: audit.id },
      data: {
        editorDecision: input.decision,
        reviewStatus: status,
        reviewerUserId: input.userId,
        decisionAt: new Date(),
        reviewNote: input.note ?? null,
      },
    });
  }

  async upsertCaseLearningGoalCoverage(input: {
    diagnosisRegistryId: string;
    coverageId?: string | null;
    payload: {
      caseId: string;
      learningGoalId: string;
      learningGoal: string;
      coverageStrength?: number;
      coveredDiscriminators?: string[];
      missingDiscriminators?: string[];
      coveredMimics?: string[];
      missingMimics?: string[];
      evidenceSource?: string;
    };
    userId: string;
  }) {
    await this.assertCaseBelongsToDiagnosis(
      input.diagnosisRegistryId,
      input.payload.caseId,
    );
    const data = {
      diagnosisRegistryId: input.diagnosisRegistryId,
      caseId: input.payload.caseId,
      learningGoalId: input.payload.learningGoalId,
      learningGoal: input.payload.learningGoal,
      coverageStrength: this.clampPercent(input.payload.coverageStrength ?? 0),
      coveredDiscriminators:
        (input.payload.coveredDiscriminators ?? []) as Prisma.InputJsonValue,
      missingDiscriminators:
        (input.payload.missingDiscriminators ?? []) as Prisma.InputJsonValue,
      coveredMimics: (input.payload.coveredMimics ?? []) as Prisma.InputJsonValue,
      missingMimics: (input.payload.missingMimics ?? []) as Prisma.InputJsonValue,
      evidenceSource: input.payload.evidenceSource ?? 'editorial_annotation',
    };
    const row = input.coverageId
      ? await this.prisma.caseLearningGoalCoverage.update({
          where: { id: input.coverageId },
          data,
          include: { case: { select: { id: true, title: true } } },
        })
      : await this.prisma.caseLearningGoalCoverage.upsert({
          where: {
            caseId_learningGoalId: {
              caseId: input.payload.caseId,
              learningGoalId: input.payload.learningGoalId,
            },
          },
          update: data,
          create: data,
          include: { case: { select: { id: true, title: true } } },
        });
    await this.recordCoverageAudit({
      diagnosisRegistryId: input.diagnosisRegistryId,
      actionType: input.coverageId
        ? 'update_case_learning_goal_coverage'
        : 'create_case_learning_goal_coverage',
      caseId: row.caseId,
      affectedArtifactType: 'CASE_LEARNING_GOAL_COVERAGE',
      affectedArtifactId: row.id,
      payload: row,
      userId: input.userId,
    });
    return this.caseLearningGoalCoverageDto(row);
  }

  async deleteCaseLearningGoalCoverage(input: {
    diagnosisRegistryId: string;
    coverageId: string;
    userId: string;
  }) {
    const row = await this.prisma.caseLearningGoalCoverage.findFirst({
      where: {
        id: input.coverageId,
        diagnosisRegistryId: input.diagnosisRegistryId,
      },
      include: { case: { select: { id: true, title: true } } },
    });
    if (!row) {
      throw new NotFoundException('Case learning-goal coverage row not found');
    }
    await this.prisma.caseLearningGoalCoverage.delete({
      where: { id: row.id },
    });
    await this.recordCoverageAudit({
      diagnosisRegistryId: input.diagnosisRegistryId,
      actionType: 'delete_case_learning_goal_coverage',
      caseId: row.caseId,
      affectedArtifactType: 'CASE_LEARNING_GOAL_COVERAGE',
      affectedArtifactId: row.id,
      payload: row,
      userId: input.userId,
    });
    return { deleted: true, id: row.id };
  }

  async upsertCaseEscalationAnnotation(input: {
    diagnosisRegistryId: string;
    annotationId?: string | null;
    payload: {
      caseId: string;
      escalationType: string;
      covered?: boolean;
      evidenceStrength?: number;
      reasoningPathId?: string | null;
      notes?: string | null;
    };
    userId: string;
  }) {
    await this.assertCaseBelongsToDiagnosis(
      input.diagnosisRegistryId,
      input.payload.caseId,
    );
    const data = {
      diagnosisRegistryId: input.diagnosisRegistryId,
      caseId: input.payload.caseId,
      escalationType: input.payload.escalationType,
      covered: input.payload.covered ?? false,
      evidenceStrength: this.clampPercent(input.payload.evidenceStrength ?? 0),
      reasoningPathId: input.payload.reasoningPathId ?? null,
      notes: input.payload.notes ?? null,
    };
    const row = input.annotationId
      ? await this.prisma.caseEscalationAnnotation.update({
          where: { id: input.annotationId },
          data,
          include: { case: { select: { id: true, title: true } } },
        })
      : await this.prisma.caseEscalationAnnotation.upsert({
          where: {
            caseId_escalationType: {
              caseId: input.payload.caseId,
              escalationType: input.payload.escalationType,
            },
          },
          update: data,
          create: data,
          include: { case: { select: { id: true, title: true } } },
        });
    await this.recordCoverageAudit({
      diagnosisRegistryId: input.diagnosisRegistryId,
      actionType: input.annotationId
        ? 'update_case_escalation_annotation'
        : 'create_case_escalation_annotation',
      caseId: row.caseId,
      affectedArtifactType: 'CASE_ESCALATION_ANNOTATION',
      affectedArtifactId: row.id,
      payload: row,
      userId: input.userId,
    });
    return this.caseEscalationAnnotationDto(row);
  }

  async deleteCaseEscalationAnnotation(input: {
    diagnosisRegistryId: string;
    annotationId: string;
    userId: string;
  }) {
    const row = await this.prisma.caseEscalationAnnotation.findFirst({
      where: {
        id: input.annotationId,
        diagnosisRegistryId: input.diagnosisRegistryId,
      },
      include: { case: { select: { id: true, title: true } } },
    });
    if (!row) {
      throw new NotFoundException('Case escalation annotation not found');
    }
    await this.prisma.caseEscalationAnnotation.delete({
      where: { id: row.id },
    });
    await this.recordCoverageAudit({
      diagnosisRegistryId: input.diagnosisRegistryId,
      actionType: 'delete_case_escalation_annotation',
      caseId: row.caseId,
      affectedArtifactType: 'CASE_ESCALATION_ANNOTATION',
      affectedArtifactId: row.id,
      payload: row,
      userId: input.userId,
    });
    return { deleted: true, id: row.id };
  }

  async loadRegistry(diagnosisRegistryId: string): Promise<RegistryRow | null> {
    return this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        onboardingStatus: true,
        onboardingStartedAt: true,
        onboardingCompletedAt: true,
        specialty: true,
        category: true,
        bodySystem: true,
        difficultyBand: true,
        aliases: {
          where: { active: true },
          select: { term: true },
          orderBy: { term: 'asc' },
        },
        education: {
          select: {
            id: true,
            editorialStatus: true,
            version: true,
            updatedAt: true,
            summary: true,
            clinicalPattern: true,
            keySymptoms: true,
            keySigns: true,
            examPearls: true,
            scoringSystems: true,
            investigations: true,
            differentials: true,
            management: true,
            complications: true,
            pitfalls: true,
            recallPrompts: true,
            references: true,
          },
        },
        editorialBrief: {
          select: {
            id: true,
            status: true,
            version: true,
            summary: true,
            learningGoals: true,
            updatedAt: true,
          },
        },
        cases: {
          orderBy: [{ date: 'desc' }],
          take: 50,
          select: {
            id: true,
            title: true,
            difficulty: true,
            editorialStatus: true,
            date: true,
            explanation: true,
            validationRuns: {
              orderBy: [{ startedAt: 'desc' }],
              take: 1,
              select: {
                outcome: true,
                summary: true,
                findings: true,
              },
            },
          },
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          orderBy: [{ type: 'asc' }, { label: 'asc' }],
          select: {
            id: true,
            type: true,
            label: true,
            targetDiagnosisRegistryId: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  private async getTeachingRelationships(diagnosisRegistryId: string) {
    return this.prisma.diagnosisTeachingRelationship.findMany({
      where: {
        OR: [
          { sourceDiagnosisRegistryId: diagnosisRegistryId },
          { targetDiagnosisRegistryId: diagnosisRegistryId },
        ],
      },
      include: {
        sourceDiagnosisRegistry: {
          select: { id: true, displayLabel: true, canonicalName: true },
        },
        targetDiagnosisRegistry: {
          select: { id: true, displayLabel: true, canonicalName: true },
        },
        supportingGraphFact: {
          select: { id: true, type: true, label: true, status: true },
        },
        supportingTeachingRule: {
          select: { id: true, stableKey: true, title: true, status: true },
        },
      },
      orderBy: [
        {
          status: 'asc',
        },
        { updatedAt: 'desc' },
      ],
      take: 100,
    });
  }

  private async getEvidenceGraph(diagnosisRegistryId: string) {
    const relationships =
      await this.prisma.diagnosisEvidenceRelationship.findMany({
        where: { diagnosisRegistryId },
        include: {
          evidenceNode: true,
          supportingTeachingRelationship: {
            select: {
              id: true,
              relationshipType: true,
              teachingPurpose: true,
              status: true,
            },
          },
          supportingTeachingRule: {
            select: { id: true, stableKey: true, title: true, status: true },
          },
          supportingCase: {
            select: { id: true, title: true, editorialStatus: true },
          },
        },
        orderBy: [
          { status: 'asc' },
          { discriminatorWeight: 'desc' },
          { strength: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: 150,
      });
    const active = relationships.filter(
      (relationship) => relationship.status === 'ACTIVE',
    );

    return {
      summary: {
        total: relationships.length,
        active: active.length,
        discriminatorEvidence: relationships.filter(
          (relationship) =>
            relationship.relationshipType === 'DISCRIMINATES' ||
            relationship.discriminatorWeight >= 3,
        ).length,
        weakEvidenceCoverage: active.filter(
          (relationship) => relationship.strength <= 1,
        ).length,
        byType: relationships.reduce<Record<string, number>>(
          (acc, relationship) => {
            const type = relationship.evidenceNode.evidenceType;
            acc[type] = (acc[type] ?? 0) + 1;
            return acc;
          },
          {},
        ),
      },
      relationships,
    };
  }

  private emptyEvidenceGraph() {
    return {
      summary: {
        total: 0,
        active: 0,
        discriminatorEvidence: 0,
        weakEvidenceCoverage: 0,
        byType: {},
      },
      relationships: [],
    };
  }

  private async getDifferentialResolutionSummary(diagnosisRegistryId: string) {
    const [caseRows, educationRows] = await Promise.all([
      this.prisma.caseDifferentialMapping.groupBy({
        by: ['status'],
        where: {
          case: { diagnosisRegistryId },
        },
        _count: { _all: true },
      }),
      this.prisma.educationDifferentialMapping.groupBy({
        by: ['status'],
        where: { diagnosisRegistryId },
        _count: { _all: true },
      }),
    ]);
    const summary = this.emptyDifferentialResolutionSummary();

    for (const row of [...caseRows, ...educationRows]) {
      const count = row._count._all;
      if (row.status === DifferentialResolutionStatus.RESOLVED) {
        summary.resolved += count;
      } else if (row.status === DifferentialResolutionStatus.AMBIGUOUS) {
        summary.ambiguous += count;
      } else if (row.status === DifferentialResolutionStatus.UNRESOLVED) {
        summary.unresolved += count;
      } else if (row.status === DifferentialResolutionStatus.REJECTED) {
        summary.rejected += count;
      }
    }

    return summary;
  }

  private async getRegistryCandidateCounts(diagnosisRegistryId: string) {
    const [registryCandidateCount, pendingRegistryCandidateCount] =
      await Promise.all([
        this.prisma.diagnosisRegistryCandidate.count({
          where: { contextDiagnosisRegistryId: diagnosisRegistryId },
        }),
        this.prisma.diagnosisRegistryCandidate.count({
          where: {
            contextDiagnosisRegistryId: diagnosisRegistryId,
            status: {
              in: [
                DiagnosisRegistryCandidateStatus.CANDIDATE,
                DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
                DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
              ],
            },
          },
        }),
      ]);

    return {
      registryCandidateCount,
      pendingRegistryCandidateCount,
    };
  }

  private emptyDifferentialResolutionSummary() {
    return {
      resolved: 0,
      ambiguous: 0,
      unresolved: 0,
      rejected: 0,
    };
  }

  private emptyDifferentialCoverage() {
    return {
      totalDifferentials: 0,
      resolvedLinks: 0,
      unresolvedMappings: 0,
    };
  }

  private emptyRegistryCandidateCounts() {
    return {
      registryCandidateCount: 0,
      pendingRegistryCandidateCount: 0,
    };
  }

  private async getUnsupportedClaimsBySection(diagnosisRegistryId: string) {
    const runs = await this.prisma.reasoningDraftValidationRun.findMany({
      where: { diagnosisRegistryId },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        artifactType: true,
        artifactId: true,
        trustTier: true,
        validationStatus: true,
        unsupportedClaimSignals: true,
        createdAt: true,
      },
    });
    const claims = new Map<
      string,
      {
        sectionId: string;
        sectionType: string;
        claimId: string;
        claimText: string;
        severity: ReadinessSeverity;
        artifactId: string;
        evidenceIds: string[];
        repairTarget: string;
        sourceType: string;
        createdAt: string;
        repairableAutomatically: boolean;
        blocksPublication: boolean;
      }
    >();

    for (const run of runs) {
      for (const signal of this.asRecordArray(run.unsupportedClaimSignals)) {
        const claimText =
          this.stringValue(signal.message) ??
          this.stringValue(signal.claimText) ??
          this.stringValue(signal.code) ??
          'Unsupported claim requires review.';
        const sectionType =
          this.stringValue(signal.sectionType) ??
          this.sectionTypeFromArtifact(String(run.artifactType));
        const sectionId =
          this.stringValue(signal.sectionId) ??
          `${run.artifactType}:${run.artifactId}`;
        const claimId =
          this.stringValue(signal.claimId) ??
          this.stableKey(`${sectionId}:${claimText}`);
        const key = `${sectionId}:${claimId}`;
        if (claims.has(key)) {
          continue;
        }

        claims.set(key, {
          sectionId,
          sectionType,
          claimId,
          claimText,
          severity:
            run.trustTier === 'BLOCKED' || run.validationStatus === 'FAILED'
              ? 'blocker'
              : 'warning',
          artifactId: run.artifactId,
          evidenceIds: this.stringArray(signal.evidenceIds),
          repairTarget:
            this.stringValue(signal.repairTarget) ??
            `${run.artifactType}:${run.artifactId}`,
          sourceType: String(run.artifactType),
          createdAt: this.toIso(run.createdAt),
          repairableAutomatically:
            run.artifactType === 'EDUCATION_SECTION' ||
            run.artifactType === 'TEACHING_RULE',
          blocksPublication:
            run.trustTier === 'BLOCKED' || run.validationStatus === 'FAILED',
        });
      }
    }

    return [...claims.values()].sort(
      (left, right) =>
        Number(right.blocksPublication) - Number(left.blocksPublication) ||
        right.createdAt.localeCompare(left.createdAt),
    );
  }

  private async findUnsupportedClaim(
    diagnosisRegistryId: string,
    claimId: string,
  ) {
    const claims = await this.getUnsupportedClaimsBySection(diagnosisRegistryId);
    return claims.find((claim) => claim.claimId === claimId) ?? null;
  }

  private proposeClaimRepair(claimText: string, evidenceIds: string[]) {
    const softened = claimText
      .replace(/\balways\b/gi, 'can')
      .replace(/\bnever\b/gi, 'does not typically')
      .replace(/\bpathognomonic\b/gi, 'supportive')
      .replace(/\bdiagnostic of\b/gi, 'supportive of')
      .replace(/\brules out\b/gi, 'makes less likely')
      .replace(/\brules in\b/gi, 'supports')
      .replace(/\bdefinitive\b/gi, 'supportive')
      .replace(/\bguarantees\b/gi, 'supports');
    const evidenceSuffix = evidenceIds.length
      ? ` Supported evidence: ${evidenceIds.join(', ')}.`
      : ' Evidence support still needs to be linked before acceptance.';
    return `${softened}${softened.endsWith('.') ? '' : '.'}${evidenceSuffix}`;
  }

  private async getPersistedCaseLearningGoalCoverage(
    diagnosisRegistryId: string,
  ) {
    const rows = await this.prisma.caseLearningGoalCoverage.findMany({
      where: { diagnosisRegistryId },
      include: {
        case: { select: { id: true, title: true } },
      },
      orderBy: [
        { learningGoalId: 'asc' },
        { coverageStrength: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 500,
    });

    return rows.map((row) => ({
      caseId: row.caseId,
      caseTitle: row.case.title,
      learningGoalId: row.learningGoalId,
      learningGoal: row.learningGoal,
      coverageStrength: row.coverageStrength,
      coveredDiscriminators: this.stringArray(row.coveredDiscriminators),
      missingDiscriminators: this.stringArray(row.missingDiscriminators),
      coveredMimics: this.stringArray(row.coveredMimics),
      missingMimics: this.stringArray(row.missingMimics),
      evidenceSource: row.evidenceSource,
      updatedAt: this.toIso(row.updatedAt),
    }));
  }

  private async getPersistedCaseEscalationAnnotations(
    diagnosisRegistryId: string,
  ) {
    const rows = await this.prisma.caseEscalationAnnotation.findMany({
      where: { diagnosisRegistryId },
      include: {
        case: { select: { id: true, title: true } },
      },
      orderBy: [
        { covered: 'desc' },
        { evidenceStrength: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 250,
    });

    return rows.map((row) => ({
      caseId: row.caseId,
      caseTitle: row.case.title,
      escalationType: row.escalationType,
      covered: row.covered,
      evidenceStrength: row.evidenceStrength,
      reasoningPathId: row.reasoningPathId,
      notes: row.notes,
      coverageSource: 'explicit' as const,
      updatedAt: this.toIso(row.updatedAt),
    }));
  }

  private async getAiDraftAuditTrail(diagnosisRegistryId: string) {
    const rows = await this.prisma.aiDraftRevisionAudit.findMany({
      where: { diagnosisRegistryId },
      orderBy: [{ createdAt: 'desc' }],
      take: 25,
      select: {
        id: true,
        actionType: true,
        sourceIssue: true,
        generatedOutput: true,
        editorDecision: true,
        affectedArtifactType: true,
        affectedArtifactId: true,
        reviewStatus: true,
        createdByUserId: true,
        reviewerUserId: true,
        decisionAt: true,
        reviewNote: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      sourceIssue: row.sourceIssue,
      generatedOutput: row.generatedOutput,
      editorDecision: row.editorDecision,
      affectedArtifactType: row.affectedArtifactType,
      affectedArtifactId: row.affectedArtifactId,
      reviewStatus: row.reviewStatus,
      createdByUserId: row.createdByUserId,
      reviewerUserId: row.reviewerUserId,
      decisionAt: row.decisionAt ? this.toIso(row.decisionAt) : null,
      reviewNote: row.reviewNote,
      createdAt: this.toIso(row.createdAt),
    }));
  }

  private reviewStatusForDecision(
    decision: 'accept' | 'reject' | 'request_changes' | 'supersede',
  ) {
    if (decision === 'accept') return 'ACCEPTED';
    if (decision === 'reject') return 'REJECTED';
    if (decision === 'request_changes') return 'NEEDS_CHANGES';
    return 'SUPERSEDED';
  }

  private async applyAcceptedDraftOutput(
    audit: {
      id: string;
      affectedArtifactType: string;
      affectedArtifactId: string;
      sourceIssue: Prisma.JsonValue;
      generatedOutput: Prisma.JsonValue;
    },
    reviewerUserId: string,
  ) {
    if (
      audit.affectedArtifactType !== 'EDUCATION_SECTION' &&
      audit.affectedArtifactType !== 'EDUCATION'
    ) {
      return;
    }

    const education = await this.prisma.diagnosisEducation.findUnique({
      where: { id: audit.affectedArtifactId },
    });
    if (!education) {
      throw new NotFoundException('Target education draft not found');
    }
    if (education.editorialStatus === DiagnosisEducationStatus.PUBLISHED) {
      throw new BadRequestException(
        'Accepted claim repairs can only update draft education artifacts',
      );
    }

    const sourceIssue = this.jsonRecord(audit.sourceIssue);
    const generatedOutput = this.jsonRecord(audit.generatedOutput);
    const section = this.educationJsonField(
      this.stringValue(sourceIssue.sectionId),
    );
    const currentValue = (education as Record<string, unknown>)[section] as
      | Prisma.JsonValue
      | null
      | undefined;
    const repairEntry = {
      type: 'CLAIM_REPAIR',
      originalClaim: this.stringValue(generatedOutput.originalClaim),
      acceptedClaim: this.stringValue(generatedOutput.proposedClaim),
      proposedClaim: this.stringValue(generatedOutput.proposedClaim),
      evidenceIds: this.stringArray(generatedOutput.evidenceIds),
      acceptedAt: new Date().toISOString(),
      reviewerUserId,
      sourceAuditId: audit.id,
    };

    await this.prisma.diagnosisEducation.update({
      where: { id: education.id },
      data: {
        editorialStatus: DiagnosisEducationStatus.DRAFT,
        [section]: this.appendDraftRepair(currentValue, repairEntry),
      },
    });
  }

  private appendDraftRepair(
    currentValue: Prisma.JsonValue | null | undefined,
    repairEntry: Record<string, Prisma.JsonValue>,
  ): Prisma.InputJsonValue {
    const appendUnique = (items: Array<Record<string, Prisma.JsonValue>>) => {
      const sourceAuditId = this.stringValue(repairEntry.sourceAuditId);
      const exists = items.some(
        (item) =>
          sourceAuditId &&
          this.stringValue(item.sourceAuditId) === sourceAuditId,
      );
      return exists ? items : [...items, repairEntry];
    };

    if (Array.isArray(currentValue)) {
      const sourceAuditId = this.stringValue(repairEntry.sourceAuditId);
      const exists = currentValue.some(
        (item) =>
          sourceAuditId &&
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          this.stringValue(
            (item as Record<string, Prisma.JsonValue>).sourceAuditId,
          ) === sourceAuditId,
      );
      return (exists ? currentValue : [...currentValue, repairEntry]) as Prisma.InputJsonValue;
    }
    if (
      currentValue &&
      typeof currentValue === 'object' &&
      !Array.isArray(currentValue)
    ) {
      const record = currentValue as Record<string, Prisma.JsonValue>;
      return {
        ...record,
        claimRepairs: appendUnique(this.asRecordArray(record.claimRepairs)),
      } as Prisma.InputJsonValue;
    }
    return [repairEntry] as Prisma.InputJsonValue;
  }

  private educationJsonField(sectionId: string | null) {
    const field = sectionId ?? 'references';
    const allowed = new Set([
      'summary',
      'clinicalPattern',
      'keySymptoms',
      'keySigns',
      'examPearls',
      'scoringSystems',
      'investigations',
      'differentials',
      'management',
      'complications',
      'pitfalls',
      'recallPrompts',
      'references',
    ]);
    return allowed.has(field) ? field : 'references';
  }

  private async assertCaseBelongsToDiagnosis(
    diagnosisRegistryId: string,
    caseId: string,
  ) {
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: caseId, diagnosisRegistryId },
      select: { id: true },
    });
    if (!caseRecord) {
      throw new BadRequestException(
        'Case does not belong to this diagnosis workspace',
      );
    }
  }

  private async recordCoverageAudit(input: {
    diagnosisRegistryId: string;
    actionType: string;
    caseId: string;
    affectedArtifactType: string;
    affectedArtifactId: string;
    payload: unknown;
    userId: string;
  }) {
    await this.prisma.aiDraftRevisionAudit.create({
      data: {
        diagnosisRegistryId: input.diagnosisRegistryId,
        caseId: input.caseId,
        actionType: input.actionType,
        sourceIssue: { source: 'coverage_annotation' } as Prisma.InputJsonValue,
        inputContext: { caseId: input.caseId } as Prisma.InputJsonValue,
        generatedOutput: this.toInputJson(input.payload),
        affectedArtifactType: input.affectedArtifactType,
        affectedArtifactId: input.affectedArtifactId,
        reviewStatus: 'ACCEPTED',
        createdByUserId: input.userId,
        reviewerUserId: input.userId,
        decisionAt: new Date(),
        editorDecision: 'coverage_annotation_saved',
      },
    });
  }

  private caseLearningGoalCoverageDto(row: {
    caseId: string;
    case: { title: string };
    learningGoalId: string;
    learningGoal: string;
    coverageStrength: number;
    coveredDiscriminators: Prisma.JsonValue | null;
    missingDiscriminators: Prisma.JsonValue | null;
    coveredMimics: Prisma.JsonValue | null;
    missingMimics: Prisma.JsonValue | null;
    evidenceSource: string;
    updatedAt: Date;
  }) {
    return {
      caseId: row.caseId,
      caseTitle: row.case.title,
      learningGoalId: row.learningGoalId,
      learningGoal: row.learningGoal,
      coverageStrength: row.coverageStrength,
      coveredDiscriminators: this.stringArray(row.coveredDiscriminators),
      missingDiscriminators: this.stringArray(row.missingDiscriminators),
      coveredMimics: this.stringArray(row.coveredMimics),
      missingMimics: this.stringArray(row.missingMimics),
      evidenceSource: row.evidenceSource,
      updatedAt: this.toIso(row.updatedAt),
    };
  }

  private caseEscalationAnnotationDto(row: {
    caseId: string;
    case: { title: string };
    escalationType: string;
    covered: boolean;
    evidenceStrength: number;
    reasoningPathId: string | null;
    notes: string | null;
    updatedAt: Date;
  }) {
    return {
      caseId: row.caseId,
      caseTitle: row.case.title,
      escalationType: row.escalationType,
      covered: row.covered,
      evidenceStrength: row.evidenceStrength,
      reasoningPathId: row.reasoningPathId,
      notes: row.notes,
      coverageSource: 'explicit' as const,
      updatedAt: this.toIso(row.updatedAt),
      status: row.covered ? 'explicitly_covered' : 'needs_review',
    };
  }

  private buildLearningGoalCoverage(input: {
    registry: RegistryRow;
    brief: { learningGoals?: Prisma.JsonValue } | null | undefined;
    cases: ReturnType<DiagnosisEditorialWorkspaceService['buildCases']>;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
    teachingRelationships: Array<{
      relationshipType: string;
      status: string;
      targetDiagnosisRegistryId: string;
    }>;
    evidenceCoverage: {
      missingEvidence?: Array<{ type: string; label: string }>;
    } | null;
    reasoningPaths: Array<{
      status: string;
      escalationEvidenceNodeIds: string[];
    }>;
    persistedCoverage: Array<{
      caseId: string;
      learningGoalId: string;
      learningGoal: string;
      coverageStrength: number;
      coveredDiscriminators: string[];
      missingDiscriminators: string[];
      coveredMimics: string[];
      missingMimics: string[];
    }>;
  }) {
    const learningGoals = this.stringArray(input.brief?.learningGoals);
    if (input.persistedCoverage.length) {
      const goalIds = [
        ...new Set(input.persistedCoverage.map((row) => row.learningGoalId)),
      ];
      return goalIds.map((learningGoalId) => {
        const rows = input.persistedCoverage.filter(
          (row) => row.learningGoalId === learningGoalId,
        );
        const strongest = rows.reduce(
          (max, row) => Math.max(max, row.coverageStrength),
          0,
        );
        return {
          learningGoalId,
          learningGoal: rows[0]?.learningGoal ?? learningGoalId,
          coveredByCaseIds: rows
            .filter((row) => row.coverageStrength > 0)
            .map((row) => row.caseId),
          uncoveredDiscriminators: this.unique(
            rows.flatMap((row) => row.missingDiscriminators),
          ),
          missingMimics: this.unique(rows.flatMap((row) => row.missingMimics)),
          generationPriority:
            strongest >= 80
              ? 'low'
              : strongest >= 45
                ? 'medium'
                : 'high',
          coveragePct: strongest,
        };
      });
    }

    const alignedCaseIds = input.cases.items
      .filter(
        (caseItem) =>
          caseItem.qualityProjection.sourceSummary.hasTeachingAlignment,
      )
      .map((caseItem) => caseItem.id);
    const missingMimics = input.teachingRelationships
      .filter(
        (relationship) =>
          relationship.relationshipType === 'MIMIC_CONFUSION' &&
          relationship.status !== 'ACTIVE',
      )
      .map((relationship) => relationship.targetDiagnosisRegistryId);
    const uncoveredDiscriminators =
      input.evidenceCoverage?.missingEvidence
        ?.filter((item) => String(item.type).includes('discriminator'))
        .map((item) => item.label) ?? [];
    const hasEscalationGap = !input.reasoningPaths.some(
      (path) =>
        path.status === 'ACTIVE' && path.escalationEvidenceNodeIds.length > 0,
    );
    const caseGapCount = input.coverageGaps.filter(
      (gap) => gap.missingCases,
    ).length;

    return learningGoals.map((goal, index) => {
      const coveredByCaseIds =
        alignedCaseIds.length && caseGapCount === 0 ? alignedCaseIds : [];
      const missing = [
        ...missingMimics,
        ...(hasEscalationGap ? ['escalation_coverage'] : []),
      ];
      return {
        learningGoalId: this.stableKey(goal) || `goal-${index + 1}`,
        learningGoal: goal,
        coveredByCaseIds,
        uncoveredDiscriminators,
        missingMimics: missing,
        generationPriority:
          coveredByCaseIds.length === 0 ||
          uncoveredDiscriminators.length > 0 ||
          missing.length > 0
            ? 'high'
            : 'low',
        coveragePct: coveredByCaseIds.length ? 100 : 0,
      };
    });
  }

  private buildEscalationCoverage(input: {
    reasoningPaths: Array<{
      id: string;
      status: string;
      reasoningGoal: string;
      escalationEvidenceNodeIds: string[];
    }>;
    teachingRelationships: Array<{
      relationshipType: string;
      status: string;
      learnerPitfall: string | null;
      commonConfusionReason: string | null;
    }>;
    evidenceGraph: {
      relationships: Array<{
        relationshipType: string;
        status: string;
      }>;
    };
    cases: ReturnType<DiagnosisEditorialWorkspaceService['buildCases']>;
    evidenceCoverage: { coverageWeaknesses?: string[] } | null;
    caseEscalationCoverage: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCaseEscalationCoverage']
    >;
  }) {
    const escalationPaths = input.reasoningPaths.filter(
      (path) => path.escalationEvidenceNodeIds.length > 0,
    );
    const activeEscalationPath = escalationPaths.find(
      (path) => path.status === 'ACTIVE',
    );
    const activeEscalationRelationships = input.teachingRelationships.filter(
      (relationship) =>
        relationship.relationshipType === 'ESCALATION_CONTRAST' &&
        relationship.status === 'ACTIVE',
    );
    const escalationEvidence = input.evidenceGraph.relationships.filter(
      (relationship) =>
        relationship.relationshipType === 'ESCALATES' &&
        relationship.status === 'ACTIVE',
    );
    const escalationCaseIds =
      input.caseEscalationCoverage.length
        ? input.caseEscalationCoverage
            .filter((annotation) => annotation.covered)
            .map((annotation) => annotation.caseId)
        : activeEscalationPath && input.cases.summary.usable
          ? input.cases.items
              .filter(
                (caseItem) =>
                  this.isUsableCaseStatus(caseItem.editorialStatus) &&
                  !caseItem.qualityProjection.blockers.length,
              )
              .map((caseItem) => caseItem.id)
          : [];
    const escalationType =
      activeEscalationPath?.reasoningGoal ??
      activeEscalationRelationships[0]?.learnerPitfall ??
      activeEscalationRelationships[0]?.commonConfusionReason ??
      null;

    return {
      coversEscalation:
        input.caseEscalationCoverage.some((annotation) => annotation.covered) ||
        (Boolean(activeEscalationPath) &&
          (activeEscalationRelationships.length > 0 ||
            escalationEvidence.length > 0)),
      escalationType,
      escalationReasoningPathId: activeEscalationPath?.id ?? null,
      escalationCaseIds,
      missingEscalationTeaching: activeEscalationRelationships.length === 0,
      weakEscalationEvidence:
        escalationEvidence.length === 0 ||
        Boolean(
          input.evidenceCoverage?.coverageWeaknesses?.includes(
            'weak_escalation_evidence',
          ),
        ),
      noPlayableEscalationCase: escalationCaseIds.length === 0,
    };
  }

  private buildCaseEscalationCoverage(input: {
    persistedAnnotations: Array<{
      caseId: string;
      caseTitle: string;
      escalationType: string;
      covered: boolean;
      evidenceStrength: number;
      reasoningPathId: string | null;
      notes: string | null;
      coverageSource: 'explicit';
      updatedAt: string;
    }>;
    reasoningPaths: Array<{
      id: string;
      status: string;
      reasoningGoal: string;
      escalationEvidenceNodeIds: string[];
    }>;
    cases: ReturnType<DiagnosisEditorialWorkspaceService['buildCases']>;
  }) {
    if (input.persistedAnnotations.length) {
      return input.persistedAnnotations.map((annotation) => ({
        ...annotation,
        status: annotation.covered ? 'explicitly_covered' : 'needs_review',
      }));
    }

    const activeEscalationPath = input.reasoningPaths.find(
      (path) =>
        path.status === 'ACTIVE' && path.escalationEvidenceNodeIds.length > 0,
    );
    if (!activeEscalationPath) {
      return [];
    }

    return input.cases.items
      .filter(
        (caseItem) =>
          this.isUsableCaseStatus(caseItem.editorialStatus) &&
          !caseItem.qualityProjection.blockers.length,
      )
      .map((caseItem) => ({
        caseId: caseItem.id,
        caseTitle: caseItem.title,
        escalationType: activeEscalationPath.reasoningGoal,
        covered: true,
        evidenceStrength: activeEscalationPath.escalationEvidenceNodeIds.length,
        reasoningPathId: activeEscalationPath.id,
        notes: 'Inferred from active reasoning path until explicit case escalation annotations are added.',
        coverageSource: 'inferred' as const,
        updatedAt: caseItem.updatedAt,
        status: 'inferred_covered',
      }));
  }

  private buildMaturityGovernance(input: {
    registry: RegistryRow;
    summary: DiagnosisWorkspaceQualitySummary | null;
    cases: ReturnType<DiagnosisEditorialWorkspaceService['buildCases']>;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
    differentialCoverage: { totalDifferentials: number; resolvedLinks: number };
    evidenceCoverage: { coverageScore?: number } | null;
    lifecycleGovernance: { blockers: string[] } | null;
    escalationCoverage: ReturnType<
      DiagnosisEditorialWorkspaceService['buildEscalationCoverage']
    >;
    learningGoalCoverage: ReturnType<
      DiagnosisEditorialWorkspaceService['buildLearningGoalCoverage']
    >;
  }) {
    const weighting = {
      objectivesWeight: 0.15,
      evidenceWeight: 0.2,
      teachingWeight: 0.15,
      differentialWeight: 0.15,
      caseWeight: 0.15,
      escalationWeight: 0.1,
    };
    const objectives = input.registry.editorialBrief ? 1 : 0;
    const evidence = this.percentToUnit(
      input.evidenceCoverage?.coverageScore ??
        input.summary?.educationQuality.graphReadiness ??
        null,
    );
    const teaching = input.summary?.teachingCoverage.overall ?? 0;
    const differentialCoverage = input.differentialCoverage.totalDifferentials
      ? input.differentialCoverage.resolvedLinks /
        input.differentialCoverage.totalDifferentials
      : 0;
    const caseCoverage = input.cases.summary.total
      ? input.cases.summary.usable / input.cases.summary.total
      : 0;
    const escalationCoverage = input.escalationCoverage.coversEscalation ? 1 : 0;
    const lifecyclePenalty =
      (input.lifecycleGovernance?.blockers.length ?? 0) * 0.08;
    const blockersPenalty =
      (input.summary?.blockers.length ?? 0) * 0.08 +
      input.coverageGaps.filter((gap) => gap.severity === 'blocker').length *
        0.05;
    const weighted =
      objectives * weighting.objectivesWeight +
      evidence * weighting.evidenceWeight +
      teaching * weighting.teachingWeight +
      differentialCoverage * weighting.differentialWeight +
      caseCoverage * weighting.caseWeight +
      escalationCoverage * weighting.escalationWeight;
    const overall = Math.max(
      0,
      Math.min(1, weighted - lifecyclePenalty - blockersPenalty),
    );

    return {
      weighting,
      breakdown: {
        objectives,
        evidence,
        teaching,
        differentialCoverage,
        caseCoverage,
        escalationCoverage,
        lifecyclePenalty,
        blockersPenalty,
        overall,
      },
      explanation: [
        objectives
          ? 'Objectives are present through an editorial brief.'
          : 'Objectives score reduced because no editorial brief is present.',
        `Evidence score is based on ${input.evidenceCoverage ? 'evidence coverage' : 'workspace graph readiness'}.`,
        `Teaching coverage uses ${input.coverageGaps.length} current coverage gaps.`,
        `Case coverage uses ${input.cases.summary.usable}/${input.cases.summary.total} usable cases.`,
        `Learning-goal coverage uses ${input.learningGoalCoverage.length} explicit editorial goals.`,
        input.escalationCoverage.coversEscalation
          ? 'Escalation coverage has active reasoning support.'
          : 'Escalation coverage is reduced because active escalation support is incomplete.',
        lifecyclePenalty
          ? `Lifecycle penalty applied for ${input.lifecycleGovernance?.blockers.length ?? 0} lifecycle blockers.`
          : 'No lifecycle blocker penalty applied.',
        blockersPenalty
          ? 'Blocker penalty applied for workspace or critical coverage blockers.'
          : 'No blocker penalty applied.',
      ],
    };
  }

  private asRecordArray(
    value: Prisma.JsonValue | null | undefined,
  ): Array<Record<string, Prisma.JsonValue>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is Record<string, Prisma.JsonValue> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
  }

  private jsonRecord(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, Prisma.JsonValue> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, Prisma.JsonValue>;
    }
    return {};
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private stringArray(value: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const record = item as Record<string, Prisma.JsonValue>;
          return (
            this.stringValue(record.id) ??
            this.stringValue(record.label) ??
            this.stringValue(record.title) ??
            this.stringValue(record.text)
          );
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }

  private stringValue(value: Prisma.JsonValue | null | undefined) {
    return typeof value === 'string' && value.trim().length
      ? value.trim()
      : null;
  }

  private sectionTypeFromArtifact(artifactType: string) {
    switch (artifactType) {
      case 'EDUCATION_SECTION':
        return 'education';
      case 'TEACHING_RULE':
        return 'teaching_rule';
      case 'REASONING_PATH':
        return 'differential_map';
      case 'CASE':
        return 'case';
      default:
        return artifactType.toLowerCase();
    }
  }

  private stableKey(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  private percentToUnit(value: number | null | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return this.clampUnit(value > 1 ? value / 100 : value);
  }

  private clampUnit(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  private clampPercent(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private buildCases(cases: CaseRow[]) {
    const items = cases.map((caseRecord) => {
      const qualityProjection =
        this.caseQualityProjectionService.buildProjection(caseRecord);
      return {
        id: caseRecord.id,
        title: caseRecord.title,
        editorialStatus: caseRecord.editorialStatus,
        difficulty: caseRecord.difficulty,
        updatedAt: this.toIso(caseRecord.date),
        qualityProjection,
      };
    });
    const usableCases = cases.filter((caseRecord) =>
      this.isUsableCaseStatus(caseRecord.editorialStatus),
    );
    const latest = items[0] ?? null;

    return {
      summary: {
        total: cases.length,
        usable: usableCases.length,
        byStatus: this.countBy(
          cases.map((caseRecord) => caseRecord.editorialStatus),
        ),
        warningCount: items.reduce(
          (count, item) => count + item.qualityProjection.warnings.length,
          0,
        ),
        blockerCount: items.reduce(
          (count, item) => count + item.qualityProjection.blockers.length,
          0,
        ),
        latest: latest
          ? {
              id: latest.id,
              title: latest.title,
              editorialStatus: latest.editorialStatus,
              difficulty: latest.difficulty,
              updatedAt: latest.updatedAt,
            }
          : null,
      },
      items,
    };
  }

  private buildCoverageMatrix(input: {
    coverage: TeachingUnitCoverageMap | null;
    rules: Array<{
      id: string;
      stableKey: string;
      title: string;
      category: string;
      importance: string;
      status: string;
    }>;
  }) {
    const ruleByStableKey = new Map(
      input.rules.map((rule) => [rule.stableKey, rule]),
    );

    return (input.coverage?.teachingUnits ?? []).map((unit) => {
      const rule = ruleByStableKey.get(unit.id);
      return {
        teachingRuleId: rule?.id ?? null,
        stableKey: unit.id,
        title: rule?.title ?? unit.title,
        category: rule?.category ?? 'legacy_teaching_rule',
        importance: rule?.importance ?? 'supporting',
        ruleStatus:
          rule?.status ??
          (unit.source === 'legacy_teaching_rules' ? 'LEGACY' : 'UNKNOWN'),
        educationCoverage: unit.educationCoverage,
        caseCoverage: unit.caseCoverage.status,
        graphCoverage: unit.graphCoverage,
        fullCoverageStatus: unit.status,
        recommendedAction: unit.recommendedAction,
      };
    });
  }

  private buildCoverageGaps(
    matrix: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageMatrix']
    >,
  ) {
    return matrix
      .filter(
        (row) =>
          this.isGap(row.educationCoverage) ||
          this.isGap(row.caseCoverage) ||
          this.isGap(row.graphCoverage),
      )
      .map((row) => ({
        teachingRuleId: row.teachingRuleId,
        title: row.title,
        missingEducation: this.isGap(row.educationCoverage),
        missingCases: this.isGap(row.caseCoverage),
        missingGraph: this.isGap(row.graphCoverage),
        severity: (row.importance === 'critical' &&
        (this.isGap(row.educationCoverage) || this.isGap(row.caseCoverage))
          ? 'blocker'
          : 'warning') as ReadinessSeverity,
        recommendedAction: row.recommendedAction,
        targetTab: this.targetTabForCoverage(row),
      }));
  }

  private buildLifecycle(input: {
    rules: Array<{ status: string; importance: string }>;
    summary: DiagnosisWorkspaceQualitySummary | null;
    registry: RegistryRow;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
  }): Record<string, LifecycleState> {
    const activeRules = input.rules.filter((rule) =>
      ['ACTIVE', 'APPROVED'].includes(rule.status),
    );
    const pendingRules = input.rules.filter((rule) =>
      ['CANDIDATE', 'NEEDS_REVIEW'].includes(rule.status),
    );
    const briefStatus =
      input.summary?.editorialBrief.status ??
      input.registry.editorialBrief?.status ??
      null;
    const educationBlockers =
      input.summary?.educationQuality.blockerCount ??
      input.summary?.blockers.filter((blocker) =>
        blocker.startsWith('education:'),
      ).length ??
      0;
    const criticalCoverageBlockers = input.coverageGaps.some(
      (gap) => gap.severity === 'blocker',
    );

    const lifecycle: Record<string, LifecycleState> = {
      curriculum: activeRules.length
        ? pendingRules.length
          ? 'warning'
          : 'complete'
        : input.rules.length
          ? 'warning'
          : 'not_started',
      brief: !briefStatus
        ? 'not_started'
        : ['APPROVED', 'ACTIVE'].includes(briefStatus)
          ? 'complete'
          : 'warning',
      education: !input.registry.education
        ? 'not_started'
        : educationBlockers
          ? 'blocked'
          : input.summary?.educationQuality.status === 'published' &&
              !input.summary.educationQuality.warningCount
            ? 'complete'
            : 'warning',
      cases: input.summary
        ? this.lifecycleFromCaseStatus(input.summary.caseQuality.status)
        : input.registry.cases.length
          ? 'warning'
          : 'not_started',
      graph: input.summary
        ? this.lifecycleFromGraphStatus(input.summary.graphReadiness.status)
        : this.lifecycleFromGraphStatus(
            this.graphReadinessFromRegistry(input.registry),
          ),
      ready: 'warning',
    };

    lifecycle.ready =
      lifecycle.curriculum === 'complete' &&
      lifecycle.brief === 'complete' &&
      lifecycle.education === 'complete' &&
      lifecycle.cases === 'complete' &&
      lifecycle.graph === 'complete' &&
      !criticalCoverageBlockers &&
      !input.summary?.blockers.length
        ? 'complete'
        : input.summary?.blockers.length || criticalCoverageBlockers
          ? 'blocked'
          : 'warning';

    return lifecycle;
  }

  private buildReadinessBreakdown(input: {
    summary: DiagnosisWorkspaceQualitySummary | null;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
    compositionWarnings: string[];
  }) {
    return [
      ...(input.summary?.blockers.map((message) => ({
        severity: 'blocker' as const,
        source: 'workspace_quality',
        message,
        actionId: 'review-workspace-blocker',
        targetTab: this.targetTabFromMessage(message),
      })) ?? []),
      ...(input.summary?.warnings.map((message) => ({
        severity: 'warning' as const,
        source: 'workspace_quality',
        message,
        actionId: 'review-workspace-warning',
        targetTab: this.targetTabFromMessage(message),
      })) ?? []),
      ...input.coverageGaps.slice(0, 12).map((gap) => ({
        severity: gap.severity,
        source: 'coverage',
        message: `${gap.title}: ${gap.recommendedAction}`,
        actionId: 'resolve-coverage-gap',
        targetTab: gap.targetTab,
      })),
      ...input.compositionWarnings.map((message) => ({
        severity: 'warning' as const,
        source: 'workspace_read_model',
        message,
        actionId: 'retry-workspace-read',
        targetTab: 'overview' as const,
      })),
    ];
  }

  private buildRecommendedActions(input: {
    registry: RegistryRow;
    summary: DiagnosisWorkspaceQualitySummary | null;
    coverageGaps: ReturnType<
      DiagnosisEditorialWorkspaceService['buildCoverageGaps']
    >;
    graphCandidateCount: number;
  }): ActionDescriptor[] {
    const endpointBase = `/api/admin/diagnosis-workspace/${input.registry.id}`;
    const actions: ActionDescriptor[] = [];

    if (!input.registry.education) {
      actions.push({
        id: 'generate-education',
        label: 'Generate education draft',
        source: 'education',
        severity: 'warning',
        targetTab: 'education',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `/api/admin/education/diagnoses/${input.registry.id}/generate`,
      });
    }

    const caseGap = input.coverageGaps.find((gap) => gap.missingCases);
    if (caseGap) {
      actions.push({
        id: 'generate-targeted-case',
        label: 'Generate aligned case',
        source: 'coverage',
        severity: caseGap.severity,
        targetTab: 'cases',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/generate-case`,
      });
    }

    if (
      input.summary?.graphReadiness.status === 'review_needed' ||
      input.graphCandidateCount > 0
    ) {
      actions.push({
        id: 'review-graph-candidates',
        label: 'Review graph candidates',
        source: 'graph',
        severity: 'warning',
        targetTab: 'graph',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `/api/admin/diagnosis-graph/candidates?diagnosisRegistryId=${input.registry.id}`,
      });
    }

    return this.uniqueActions([
      ...actions,
      ...(input.summary?.recommendedNextActions.map((label, index) => ({
        id: `workspace-next-${index + 1}`,
        label,
        source: 'workspace_quality',
        severity: 'warning' as const,
        targetTab: this.targetTabFromMessage(label),
        enabled: true,
        disabledReason: null,
      })) ?? []),
    ]).slice(0, 10);
  }

  private buildAvailableActions(input: {
    registry: RegistryRow;
    hasEducation: boolean;
  }): ActionDescriptor[] {
    const endpointBase = `/api/admin/diagnosis-workspace/${input.registry.id}`;
    return [
      {
        id: 'generate-teaching-rule-candidates',
        label: 'Generate teaching rule candidates',
        permission: 'editor',
        targetTab: 'teaching-rules',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/teaching-rules/generate`,
      },
      {
        id: 'seed-legacy-teaching-rules',
        label: 'Seed legacy teaching rules',
        permission: 'editor',
        targetTab: 'teaching-rules',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/teaching-rules/seed-legacy`,
      },
      {
        id: 'generate-editorial-brief',
        label: 'Generate editorial brief',
        permission: 'editor',
        targetTab: 'editorial-brief',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/editorial-brief/generate`,
      },
      {
        id: 'generate-education',
        label: 'Generate education draft',
        permission: 'editor',
        targetTab: 'education',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `/api/admin/education/diagnoses/${input.registry.id}/generate`,
      },
      {
        id: 'regenerate-education-section',
        label: 'Regenerate education section',
        permission: 'editor',
        targetTab: 'education',
        enabled: input.hasEducation,
        disabledReason: input.hasEducation
          ? null
          : 'Create an education draft before regenerating sections.',
        targetEndpoint: `/api/admin/education/diagnoses/${input.registry.id}/regenerate-section`,
      },
      {
        id: 'generate-targeted-case',
        label: 'Generate targeted case',
        permission: 'editor',
        targetTab: 'cases',
        enabled: true,
        disabledReason: null,
        targetEndpoint: `${endpointBase}/generate-case`,
      },
    ];
  }

  private buildEditorialBrief(
    brief: {
      status: string;
      version: number;
      summary: string;
      updatedAt: Date | string;
    } | null,
  ) {
    return {
      status: brief?.status ?? null,
      version: brief?.version ?? null,
      activeForGeneration:
        brief?.status === 'APPROVED' || brief?.status === 'ACTIVE',
      summary: brief?.summary ?? null,
      updatedAt: brief ? this.toIso(brief.updatedAt) : null,
    };
  }

  private buildEducation(
    education: RegistryRow['education'],
    summary: DiagnosisWorkspaceQualitySummary | null,
    latestRevision: EducationRevisionAnalysis | null,
  ) {
    return {
      id: education?.id ?? null,
      status:
        summary?.educationQuality.status ??
        education?.editorialStatus ??
        'missing',
      version: summary?.educationQuality.version ?? education?.version ?? null,
      qualityScore: summary?.educationQuality.score ?? null,
      sectionHealth:
        summary?.sectionHealth ?? latestRevision?.quality.sectionHealth ?? [],
      blockers: latestRevision?.quality.blockers ?? [],
      warnings: latestRevision?.quality.warnings ?? [],
      acceptedRepairs: this.acceptedEducationRepairs(education),
      updatedAt: education ? this.toIso(education.updatedAt) : null,
    };
  }

  private acceptedEducationRepairs(education: RegistryRow['education']) {
    if (!education) return [];
    const sections = [
      'summary',
      'clinicalPattern',
      'keySymptoms',
      'keySigns',
      'examPearls',
      'scoringSystems',
      'investigations',
      'differentials',
      'management',
      'complications',
      'pitfalls',
      'recallPrompts',
      'references',
    ] as const;

    return sections.flatMap((section) =>
      this.extractClaimRepairs(section, education[section]),
    );
  }

  private extractClaimRepairs(
    section: string,
    value: Prisma.JsonValue | null,
  ) {
    const records = Array.isArray(value)
      ? this.asRecordArray(value)
      : value && typeof value === 'object'
        ? this.asRecordArray(
            (value as Record<string, Prisma.JsonValue>).claimRepairs,
          )
        : [];

    return records
      .filter((record) => this.stringValue(record.type) === 'CLAIM_REPAIR')
      .map((record) => ({
        section,
        originalClaim: this.stringValue(record.originalClaim) ?? '',
        acceptedClaim:
          this.stringValue(record.acceptedClaim) ??
          this.stringValue(record.proposedClaim) ??
          '',
        evidenceIds: this.stringArray(record.evidenceIds),
        acceptedAt: this.stringValue(record.acceptedAt),
        reviewerUserId: this.stringValue(record.reviewerUserId),
        sourceAuditId: this.stringValue(record.sourceAuditId),
      }))
      .filter((repair) => repair.acceptedClaim);
  }

  private teachingRuleSummary(
    rules: Array<{ status: string; importance: string }>,
  ) {
    return {
      total: rules.length,
      active: rules.filter((rule) => rule.status === 'ACTIVE').length,
      approved: rules.filter((rule) => rule.status === 'APPROVED').length,
      candidates: rules.filter((rule) => rule.status === 'CANDIDATE').length,
      needsReview: rules.filter((rule) => rule.status === 'NEEDS_REVIEW')
        .length,
      critical: rules.filter((rule) => rule.importance === 'critical').length,
    };
  }

  private graphFactsSummary(facts: GraphFactRow[]) {
    return {
      total: facts.length,
      byType: this.countBy(facts.map((fact) => fact.type)),
      recent: facts.slice(0, 10).map((fact) => ({
        id: fact.id,
        type: fact.type,
        label: fact.label,
        targetDiagnosisRegistryId: fact.targetDiagnosisRegistryId,
        updatedAt: this.toIso(fact.updatedAt),
      })),
    };
  }

  private recentLearningThemes(
    revisions: EducationRevisionAnalysis[],
  ): string[] {
    return this.unique(
      revisions
        .slice(0, 3)
        .flatMap((revision) => revision.changedSections ?? [])
        .map((section) => `Recent ${this.formatLabel(section)} edits`),
    );
  }

  private compositionWarnings(input: {
    summaryResult: PromiseSettledResult<unknown>;
    coverageResult: PromiseSettledResult<unknown>;
    rulesResult: PromiseSettledResult<unknown>;
    briefResult: PromiseSettledResult<unknown>;
    revisionsResult: PromiseSettledResult<unknown>;
    graphCandidatesResult: PromiseSettledResult<unknown>;
  }): string[] {
    return [
      this.warningFor('workspace summary', input.summaryResult),
      this.warningFor('teaching coverage', input.coverageResult),
      this.warningFor('teaching rules', input.rulesResult),
      this.warningFor('editorial brief', input.briefResult),
      this.warningFor('education revisions', input.revisionsResult),
      this.warningFor('graph candidates', input.graphCandidatesResult),
    ].filter((warning): warning is string => Boolean(warning));
  }

  private warningFor(
    label: string,
    result: PromiseSettledResult<unknown>,
  ): string | null {
    return result.status === 'rejected'
      ? `Unable to load ${label}: ${this.errorMessage(result.reason)}`
      : null;
  }

  private valueOrNull<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === 'fulfilled' ? result.value : null;
  }

  private graphReadinessFromRegistry(registry: RegistryRow) {
    return registry.graphFacts.length ? 'fact_ready' : 'none';
  }

  private lifecycleFromCaseStatus(
    status: DiagnosisWorkspaceQualitySummary['caseQuality']['status'],
  ): LifecycleState {
    if (status === 'missing') return 'not_started';
    if (status === 'blocker') return 'blocked';
    if (status === 'good') return 'complete';
    return 'warning';
  }

  private lifecycleFromGraphStatus(status: string): LifecycleState {
    if (status === 'none') return 'not_started';
    if (status === 'fact_ready') return 'complete';
    return 'warning';
  }

  private targetTabForCoverage(row: {
    educationCoverage: CoverageStatus;
    caseCoverage: CoverageStatus;
    graphCoverage: CoverageStatus;
  }): TargetTab {
    if (this.isGap(row.educationCoverage)) return 'education';
    if (this.isGap(row.caseCoverage)) return 'cases';
    if (this.isGap(row.graphCoverage)) return 'graph';
    return 'overview';
  }

  private targetTabFromMessage(message: string): TargetTab {
    const normalized = message.toLowerCase();
    if (normalized.includes('case')) return 'cases';
    if (normalized.includes('graph')) return 'graph';
    if (normalized.includes('brief')) return 'editorial-brief';
    if (normalized.includes('rule') || normalized.includes('curriculum')) {
      return 'teaching-rules';
    }
    if (normalized.includes('education') || normalized.includes('regenerate')) {
      return 'education';
    }
    return 'overview';
  }

  private isGap(status: CoverageStatus): boolean {
    return status === 'missing' || status === 'partial';
  }

  private isUsableCaseStatus(status: CaseEditorialStatus | null): boolean {
    return (
      status === CaseEditorialStatus.APPROVED ||
      status === CaseEditorialStatus.READY_TO_PUBLISH ||
      status === CaseEditorialStatus.PUBLISHED
    );
  }

  private isReviewableCandidateStatus(status: string): boolean {
    return (
      status === DiagnosisGraphCandidateStatus.CANDIDATE ||
      status === DiagnosisGraphCandidateStatus.APPROVED
    );
  }

  private diagnosisName(registry: RegistryRow): string {
    return registry.displayLabel || registry.canonicalName;
  }

  private countBy(values: Array<string | null>): Record<string, number> {
    return values.reduce<Record<string, number>>((counts, value) => {
      const key = value ?? 'unknown';
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }

  private uniqueActions(actions: ActionDescriptor[]): ActionDescriptor[] {
    const seen = new Set<string>();
    return actions.filter((action) => {
      if (seen.has(action.id)) {
        return false;
      }
      seen.add(action.id);
      return true;
    });
  }

  private formatLabel(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .toLowerCase();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
