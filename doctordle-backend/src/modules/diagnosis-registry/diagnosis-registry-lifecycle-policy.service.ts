import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisRegistryStatus,
  DifferentialResolutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type DiagnosisRegistryLifecycleAction =
  | 'activate'
  | 'activate_for_dictionary'
  | 'deactivate'
  | 'mark_playable'
  | 'unmark_playable'
  | 'mark_generatable'
  | 'unmark_generatable';

type RegistryLifecycleRow = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  status: DiagnosisRegistryStatus;
  active: boolean;
  isPlayable: boolean;
  isGeneratable: boolean;
  onboardingStatus: DiagnosisEditorialOnboardingStatus | null;
  specialty: string | null;
  category: string | null;
  bodySystem: string | null;
  difficultyBand: string | null;
  isDescriptive: boolean;
  isCompositional: boolean;
  activationReviewedByUserId?: string | null;
  activationReviewedAt?: Date | null;
  education: {
    id: string;
    editorialStatus: DiagnosisEducationStatus;
    publishedAt: Date | null;
  } | null;
  editorialBrief: {
    id: string;
    status: string;
  } | null;
  teachingRules: Array<{
    id: string;
    status: string;
    appliesToCaseGeneration: boolean;
  }>;
  cases: Array<{
    id: string;
    editorialStatus: CaseEditorialStatus | null;
    publishedAt: Date | null;
    currentRevisionId: string | null;
  }>;
  graphFacts: Array<{
    id: string;
  }>;
};

type LifecycleCounts = {
  duplicateCanonicalCount: number;
  duplicateAliasCount: number;
  pendingDuplicateCandidateCount: number;
  unresolvedDifferentialCount: number;
};

type LifecycleStateSnapshot = {
  status: DiagnosisRegistryStatus;
  active: boolean;
  isPlayable: boolean;
  isGeneratable: boolean;
  onboardingStatus: DiagnosisEditorialOnboardingStatus | null;
};

export type LifecycleEvaluation = {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  readinessScore: number;
};

export type DiagnosisRegistryLifecycleReport = {
  diagnosisRegistryId: string;
  lifecycle: {
    status: DiagnosisRegistryStatus;
    active: boolean;
    isPlayable: boolean;
    isGeneratable: boolean;
    onboardingStatus: DiagnosisEditorialOnboardingStatus | null;
    activationReviewedByUserId: string | null;
    activationReviewedAt: string | null;
  };
  readiness: {
    activation: LifecycleEvaluation;
    dictionaryActivation: LifecycleEvaluation;
    playability: LifecycleEvaluation;
    generatability: LifecycleEvaluation;
    merge: LifecycleEvaluation;
  };
  blockers: string[];
  warnings: string[];
  visibility: {
    editorialVisible: boolean;
    dictionaryVisible: boolean;
    playable: boolean;
    generatable: boolean;
    mergeable: boolean;
  };
  duplicateRisk: {
    registryCanonicalMatches: number;
    registryAliasMatches: number;
    pendingCandidateConflicts: number;
  };
  recommendations: string[];
};

const APPROVED_RULE_STATUSES = new Set(['APPROVED', 'PUBLISHED', 'ACTIVE']);
const APPROVED_BRIEF_STATUSES = new Set(['APPROVED', 'PUBLISHED', 'ACTIVE']);
const APPROVED_EDUCATION_STATUSES = new Set<DiagnosisEducationStatus>([
  DiagnosisEducationStatus.APPROVED,
  DiagnosisEducationStatus.PUBLISHED,
]);
const USABLE_CASE_STATUSES = new Set<CaseEditorialStatus>([
  CaseEditorialStatus.READY_TO_PUBLISH,
  CaseEditorialStatus.PUBLISHED,
]);
const PENDING_CANDIDATE_STATUSES = [
  DiagnosisRegistryCandidateStatus.CANDIDATE,
  DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
  DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
];
const UNRESOLVED_DIFFERENTIAL_STATUSES = [
  DifferentialResolutionStatus.UNRESOLVED,
  DifferentialResolutionStatus.AMBIGUOUS,
];

@Injectable()
export class DiagnosisRegistryLifecyclePolicyService {
  private readonly logger = new Logger(
    DiagnosisRegistryLifecyclePolicyService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async getLifecycle(
    diagnosisRegistryId: string,
  ): Promise<DiagnosisRegistryLifecycleReport> {
    const registry = await this.loadRegistry(diagnosisRegistryId);
    const counts = await this.loadCounts(registry);
    return this.buildReport(registry, counts);
  }

  async performAction(input: {
    diagnosisRegistryId: string;
    reviewerUserId: string;
    action: DiagnosisRegistryLifecycleAction;
    isGeneratable?: boolean;
  }) {
    const report = await this.getLifecycle(input.diagnosisRegistryId);
    const evaluation = this.getEvaluationForAction(report, input.action);

    if (!evaluation.allowed) {
      throw new BadRequestException({
        message: 'Lifecycle transition is blocked',
        blockers: evaluation.blockers,
        warnings: evaluation.warnings,
      });
    }

    const now = new Date();
    const data = this.getActionUpdate({
      action: input.action,
      reviewerUserId: input.reviewerUserId,
      now,
      isGeneratable: input.isGeneratable,
      onboardingStatus: report.lifecycle.onboardingStatus,
    });

    const registry = await this.prisma.diagnosisRegistry.update({
      where: { id: input.diagnosisRegistryId },
      data,
      select: {
        id: true,
        status: true,
        active: true,
        isPlayable: true,
        isGeneratable: true,
        onboardingStatus: true,
        activationReviewedByUserId: true,
        activationReviewedAt: true,
        updatedAt: true,
      },
    });

    this.logger.log({
      event: this.getActionEvent(input.action),
      diagnosisRegistryId: input.diagnosisRegistryId,
      reviewerUserId: input.reviewerUserId,
    });

    return {
      registry,
      lifecycle: await this.getLifecycle(input.diagnosisRegistryId),
      activationTelemetry:
        input.action === 'activate_for_dictionary'
          ? {
              before: this.toLifecycleStateSnapshot(report.lifecycle),
              after: this.toLifecycleStateSnapshot(registry),
              dictionaryVisible:
                registry.status === DiagnosisRegistryStatus.ACTIVE &&
                registry.active,
              playable:
                registry.status === DiagnosisRegistryStatus.ACTIVE &&
                registry.active &&
                registry.isPlayable,
              generatable:
                registry.status === DiagnosisRegistryStatus.ACTIVE &&
                registry.active &&
                registry.isPlayable &&
                registry.isGeneratable,
              cacheInvalidated: true,
              cacheInvalidationReason:
                'Registry activation updates updatedAt; dictionary, snapshot, and autocomplete version projections are based on registry updatedAt.',
              activatedByUserId: input.reviewerUserId,
              activatedAt: registry.activationReviewedAt
                ? registry.activationReviewedAt.toISOString()
                : now.toISOString(),
              updatedAt: registry.updatedAt.toISOString(),
            }
          : null,
      cacheInvalidation: {
        dictionaryVersionBumped: true,
        reason: 'diagnosis_registry_updated_at_changed',
      },
    };
  }

  canActivate(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    return this.getActivationReadiness(registry, counts);
  }

  canActivateForDictionary(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    return this.getDictionaryActivationReadiness(registry, counts);
  }

  canMarkPlayable(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    return this.getPlayabilityReadiness(registry, counts);
  }

  canMarkGeneratable(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    return this.getGeneratabilityReadiness(registry, counts);
  }

  canMerge(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    const blockers: string[] = [];
    const warnings = [
      'Merge execution is deferred to Phase 13E-B/13E-C and is not available yet',
    ];

    if (counts.unresolvedDifferentialCount > 0) {
      blockers.push('Unresolved differential mappings should be reviewed first');
    }

    return this.evaluation(blockers, warnings, 0);
  }

  getActivationReadiness(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (registry.status === DiagnosisRegistryStatus.ACTIVE && registry.active) {
      warnings.push('Diagnosis is already active');
    }

    if (
      registry.onboardingStatus !== DiagnosisEditorialOnboardingStatus.COMPLETE
    ) {
      blockers.push('Editorial onboarding is not complete');
      score -= 20;
    }

    if (counts.duplicateCanonicalCount > 0 || counts.duplicateAliasCount > 0) {
      blockers.push('Duplicate registry risk is unresolved');
      score -= 20;
    }

    if (counts.pendingDuplicateCandidateCount > 0) {
      blockers.push('Pending registry candidate conflict is unresolved');
      score -= 15;
    }

    if (!this.hasApprovedEducation(registry)) {
      blockers.push('No approved or published education exists');
      score -= 15;
    }

    if (!this.hasApprovedBrief(registry)) {
      blockers.push('No approved editorial brief exists');
      score -= 10;
    }

    if (!this.hasApprovedTeachingRules(registry)) {
      blockers.push('No approved teaching rules exist');
      score -= 10;
    }

    if (counts.unresolvedDifferentialCount > 0) {
      blockers.push('Unresolved differential mappings remain');
      score -= 10;
    }

    if (!registry.specialty || !registry.category || !registry.bodySystem) {
      blockers.push('Specialty, category, and body system must be assigned');
      score -= 10;
    }

    if (!this.hasGraphReadiness(registry)) {
      warnings.push('No active graph facts are available yet');
      score -= 5;
    }

    if (!this.hasUsableCase(registry)) {
      warnings.push('No ready or published playable case exists yet');
      score -= 5;
    }

    return this.evaluation(blockers, warnings, score);
  }

  getDictionaryActivationReadiness(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (registry.status === DiagnosisRegistryStatus.ACTIVE && registry.active) {
      warnings.push('Diagnosis is already dictionary-active');
    }

    if (!registry.displayLabel || !registry.canonicalName || !registry.canonicalNormalized) {
      blockers.push('Display label, canonical name, and normalized canonical key are required');
      score -= 25;
    }

    if (!registry.specialty) {
      blockers.push('Specialty must be assigned before dictionary activation');
      score -= 15;
    }

    if (!registry.category && !registry.bodySystem) {
      blockers.push('Category or body system must be assigned before dictionary activation');
      score -= 15;
    }

    if (counts.duplicateCanonicalCount > 0 || counts.duplicateAliasCount > 0) {
      blockers.push('Duplicate registry risk is unresolved');
      score -= 25;
    }

    if (counts.pendingDuplicateCandidateCount > 0) {
      blockers.push('Pending registry candidate conflict is unresolved');
      score -= 15;
    }

    if (registry.isDescriptive || registry.isCompositional) {
      blockers.push('Descriptive or compositional entries require manual safety review before dictionary activation');
      score -= 15;
    }

    if (!this.hasUsableCase(registry)) {
      warnings.push('No ready or published playable case exists yet');
      score -= 5;
    }

    if (!this.hasApprovedEducation(registry)) {
      warnings.push('Education is not approved or published yet');
      score -= 5;
    }

    return this.evaluation(blockers, warnings, score);
  }

  getPlayabilityReadiness(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (!this.isActive(registry)) {
      blockers.push('Diagnosis must be active before it can be playable');
      score -= 35;
    }

    if (!this.hasUsableCase(registry)) {
      blockers.push('At least one ready or published case is required');
      score -= 25;
    }

    if (!this.hasApprovedEducation(registry)) {
      warnings.push('Education is not approved or published');
      score -= 10;
    }

    if (counts.unresolvedDifferentialCount > 0) {
      warnings.push('Unresolved differentials remain');
      score -= 5;
    }

    return this.evaluation(blockers, warnings, score);
  }

  getGeneratabilityReadiness(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): LifecycleEvaluation {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (!this.isPlayable(registry)) {
      blockers.push('Diagnosis must be playable before generation is enabled');
      score -= 35;
    }

    if (!this.hasApprovedBrief(registry)) {
      blockers.push('Approved editorial brief is required for generation');
      score -= 20;
    }

    if (!this.hasCaseGenerationRules(registry)) {
      blockers.push('Approved case-generation teaching rules are required');
      score -= 20;
    }

    if (counts.duplicateCanonicalCount > 0 || counts.duplicateAliasCount > 0) {
      warnings.push('Duplicate registry risk should be reviewed before generation');
      score -= 10;
    }

    return this.evaluation(blockers, warnings, score);
  }

  isEditorialVisible(registry: {
    status: DiagnosisRegistryStatus;
  }): boolean {
    return registry.status !== DiagnosisRegistryStatus.DEPRECATED;
  }

  isDictionaryVisible(registry: {
    status: DiagnosisRegistryStatus;
    active: boolean;
  }): boolean {
    return registry.status === DiagnosisRegistryStatus.ACTIVE && registry.active;
  }

  isPlayable(registry: {
    status: DiagnosisRegistryStatus;
    active: boolean;
    isPlayable: boolean;
  }): boolean {
    return this.isDictionaryVisible(registry) && registry.isPlayable;
  }

  isGeneratable(registry: {
    status: DiagnosisRegistryStatus;
    active: boolean;
    isPlayable: boolean;
    isGeneratable: boolean;
  }): boolean {
    return this.isPlayable(registry) && registry.isGeneratable;
  }

  getGeneratableRegistryWhere(): Prisma.DiagnosisRegistryWhereInput {
    return {
      active: true,
      status: DiagnosisRegistryStatus.ACTIVE,
      isPlayable: true,
      isGeneratable: true,
    };
  }

  getPlayableRegistryWhere(): Prisma.DiagnosisRegistryWhereInput {
    return {
      active: true,
      status: DiagnosisRegistryStatus.ACTIVE,
      isPlayable: true,
    };
  }

  getDictionaryVisibleRegistryWhere(): Prisma.DiagnosisRegistryWhereInput {
    return {
      active: true,
      status: DiagnosisRegistryStatus.ACTIVE,
    };
  }

  private async loadRegistry(
    diagnosisRegistryId: string,
  ): Promise<RegistryLifecycleRow> {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        canonicalNormalized: true,
        displayLabel: true,
        status: true,
        active: true,
        isPlayable: true,
        isGeneratable: true,
        onboardingStatus: true,
        specialty: true,
        category: true,
        bodySystem: true,
        difficultyBand: true,
        isDescriptive: true,
        isCompositional: true,
        activationReviewedByUserId: true,
        activationReviewedAt: true,
        education: {
          select: {
            id: true,
            editorialStatus: true,
            publishedAt: true,
          },
        },
        editorialBrief: {
          select: {
            id: true,
            status: true,
          },
        },
        teachingRules: {
          select: {
            id: true,
            status: true,
            appliesToCaseGeneration: true,
          },
        },
        cases: {
          select: {
            id: true,
            editorialStatus: true,
            publishedAt: true,
            currentRevisionId: true,
          },
        },
        graphFacts: {
          where: {
            status: DiagnosisGraphFactStatus.ACTIVE,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    return registry as RegistryLifecycleRow;
  }

  private async loadCounts(
    registry: RegistryLifecycleRow,
  ): Promise<LifecycleCounts> {
    const [
      duplicateCanonicalCount,
      duplicateAliasCount,
      pendingDuplicateCandidateCount,
      unresolvedCaseDifferentialCount,
      unresolvedEducationDifferentialCount,
    ] = await Promise.all([
      this.prisma.diagnosisRegistry.count({
        where: {
          id: { not: registry.id },
          canonicalNormalized: registry.canonicalNormalized,
        },
      }),
      this.prisma.diagnosisAlias.count({
        where: {
          active: true,
          normalizedTerm: registry.canonicalNormalized,
          diagnosisRegistryId: { not: registry.id },
        },
      }),
      this.prisma.diagnosisRegistryCandidate.count({
        where: {
          proposedCanonicalNormalized: registry.canonicalNormalized,
          createdRegistryId: { not: registry.id },
          status: { in: PENDING_CANDIDATE_STATUSES },
        },
      }),
      this.prisma.caseDifferentialMapping.count({
        where: {
          status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES },
          case: { diagnosisRegistryId: registry.id },
        },
      }),
      this.prisma.educationDifferentialMapping.count({
        where: {
          status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES },
          diagnosisRegistryId: registry.id,
        },
      }),
    ]);

    return {
      duplicateCanonicalCount,
      duplicateAliasCount,
      pendingDuplicateCandidateCount,
      unresolvedDifferentialCount:
        unresolvedCaseDifferentialCount + unresolvedEducationDifferentialCount,
    };
  }

  private buildReport(
    registry: RegistryLifecycleRow,
    counts: LifecycleCounts,
  ): DiagnosisRegistryLifecycleReport {
    const activation = this.getActivationReadiness(registry, counts);
    const dictionaryActivation = this.getDictionaryActivationReadiness(
      registry,
      counts,
    );
    const playability = this.getPlayabilityReadiness(registry, counts);
    const generatability = this.getGeneratabilityReadiness(registry, counts);
    const merge = this.canMerge(registry, counts);
    const blockers = this.unique([
      ...activation.blockers,
      ...dictionaryActivation.blockers,
      ...playability.blockers,
      ...generatability.blockers,
    ]);
    const warnings = this.unique([
      ...activation.warnings,
      ...dictionaryActivation.warnings,
      ...playability.warnings,
      ...generatability.warnings,
      ...merge.warnings,
    ]);

    return {
      diagnosisRegistryId: registry.id,
      lifecycle: {
        status: registry.status,
        active: registry.active,
        isPlayable: registry.isPlayable,
        isGeneratable: registry.isGeneratable,
        onboardingStatus: registry.onboardingStatus,
        activationReviewedByUserId:
          registry.activationReviewedByUserId ?? null,
        activationReviewedAt: registry.activationReviewedAt
          ? registry.activationReviewedAt.toISOString()
          : null,
      },
      readiness: {
        activation,
        dictionaryActivation,
        playability,
        generatability,
        merge,
      },
      blockers,
      warnings,
      visibility: {
        editorialVisible: this.isEditorialVisible(registry),
        dictionaryVisible: this.isDictionaryVisible(registry),
        playable: this.isPlayable(registry),
        generatable: this.isGeneratable(registry),
        mergeable: merge.allowed,
      },
      duplicateRisk: {
        registryCanonicalMatches: counts.duplicateCanonicalCount,
        registryAliasMatches: counts.duplicateAliasCount,
        pendingCandidateConflicts: counts.pendingDuplicateCandidateCount,
      },
      recommendations: this.buildRecommendations({
        activation,
        dictionaryActivation,
        playability,
        generatability,
        registry,
      }),
    };
  }

  private getEvaluationForAction(
    report: DiagnosisRegistryLifecycleReport,
    action: DiagnosisRegistryLifecycleAction,
  ): LifecycleEvaluation {
    switch (action) {
      case 'activate':
        return report.readiness.activation;
      case 'activate_for_dictionary':
        return report.readiness.dictionaryActivation;
      case 'mark_playable':
        return report.readiness.playability;
      case 'mark_generatable':
        return report.readiness.generatability;
      default:
        return this.evaluation([], [], 100);
    }
  }

  private getActionUpdate(input: {
    action: DiagnosisRegistryLifecycleAction;
    reviewerUserId: string;
    now: Date;
    isGeneratable?: boolean;
    onboardingStatus?: DiagnosisEditorialOnboardingStatus | null;
  }): Prisma.DiagnosisRegistryUpdateInput {
    switch (input.action) {
      case 'activate':
        return {
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          activationReviewedByUser: { connect: { id: input.reviewerUserId } },
          activationReviewedAt: input.now,
        };
      case 'activate_for_dictionary':
        return {
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
          isGeneratable: input.isGeneratable ?? false,
          onboardingStatus:
            input.onboardingStatus === DiagnosisEditorialOnboardingStatus.COMPLETE
              ? DiagnosisEditorialOnboardingStatus.COMPLETE
              : DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
          activationReviewedByUser: { connect: { id: input.reviewerUserId } },
          activationReviewedAt: input.now,
        };
      case 'deactivate':
        return {
          status: DiagnosisRegistryStatus.HIDDEN,
          active: false,
          isPlayable: false,
          isGeneratable: false,
        };
      case 'mark_playable':
        return { isPlayable: true };
      case 'unmark_playable':
        return { isPlayable: false, isGeneratable: false };
      case 'mark_generatable':
        return { isGeneratable: true };
      case 'unmark_generatable':
        return { isGeneratable: false };
      default:
        throw new BadRequestException('Unsupported lifecycle action');
    }
  }

  private getActionEvent(action: DiagnosisRegistryLifecycleAction): string {
    switch (action) {
      case 'activate':
        return 'diagnosis.lifecycle.activated';
      case 'activate_for_dictionary':
        return 'diagnosis.lifecycle.dictionary_activated';
      case 'deactivate':
        return 'diagnosis.lifecycle.deactivated';
      case 'mark_playable':
        return 'diagnosis.lifecycle.playable_enabled';
      case 'unmark_playable':
        return 'diagnosis.lifecycle.playable_disabled';
      case 'mark_generatable':
        return 'diagnosis.lifecycle.generatable_enabled';
      case 'unmark_generatable':
        return 'diagnosis.lifecycle.generatable_disabled';
    }
  }

  private hasApprovedEducation(registry: RegistryLifecycleRow): boolean {
    return Boolean(
      registry.education &&
        APPROVED_EDUCATION_STATUSES.has(registry.education.editorialStatus),
    );
  }

  private hasApprovedBrief(registry: RegistryLifecycleRow): boolean {
    return Boolean(
      registry.editorialBrief &&
        APPROVED_BRIEF_STATUSES.has(registry.editorialBrief.status),
    );
  }

  private hasApprovedTeachingRules(registry: RegistryLifecycleRow): boolean {
    return registry.teachingRules.some((rule) =>
      APPROVED_RULE_STATUSES.has(rule.status),
    );
  }

  private hasCaseGenerationRules(registry: RegistryLifecycleRow): boolean {
    return registry.teachingRules.some(
      (rule) =>
        rule.appliesToCaseGeneration && APPROVED_RULE_STATUSES.has(rule.status),
    );
  }

  private hasUsableCase(registry: RegistryLifecycleRow): boolean {
    return registry.cases.some(
      (caseRecord) =>
        caseRecord.editorialStatus &&
        USABLE_CASE_STATUSES.has(caseRecord.editorialStatus) &&
        caseRecord.currentRevisionId,
    );
  }

  private hasGraphReadiness(registry: RegistryLifecycleRow): boolean {
    return registry.graphFacts.length > 0;
  }

  private isActive(registry: {
    status: DiagnosisRegistryStatus;
    active: boolean;
  }): boolean {
    return registry.status === DiagnosisRegistryStatus.ACTIVE && registry.active;
  }

  private evaluation(
    blockers: string[],
    warnings: string[],
    readinessScore: number,
  ): LifecycleEvaluation {
    return {
      allowed: blockers.length === 0,
      blockers: this.unique(blockers),
      warnings: this.unique(warnings),
      readinessScore: Math.max(0, Math.min(100, Math.round(readinessScore))),
    };
  }

  private buildRecommendations(input: {
    activation: LifecycleEvaluation;
    dictionaryActivation: LifecycleEvaluation;
    playability: LifecycleEvaluation;
    generatability: LifecycleEvaluation;
    registry: RegistryLifecycleRow;
  }): string[] {
    const recommendations: string[] = [];

    if (!input.activation.allowed) {
      recommendations.push('Resolve activation blockers before enabling registry visibility');
    }

    if (!input.dictionaryActivation.allowed && !this.isDictionaryVisible(input.registry)) {
      recommendations.push('Complete dictionary activation metadata before gameplay visibility');
    }

    if (!input.playability.allowed) {
      recommendations.push('Prepare at least one usable case before marking playable');
    }

    if (!input.generatability.allowed) {
      recommendations.push('Approve generation brief and teaching rules before enabling generation');
    }

    if (!input.registry.isPlayable && input.playability.allowed) {
      recommendations.push('This diagnosis is ready to be marked playable');
    }

    if (!input.registry.isGeneratable && input.generatability.allowed) {
      recommendations.push('This diagnosis is ready to be marked generatable');
    }

    return this.unique(recommendations);
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim())));
  }

  private toLifecycleStateSnapshot(
    row: LifecycleStateSnapshot,
  ): LifecycleStateSnapshot {
    return {
      status: row.status,
      active: row.active,
      isPlayable: row.isPlayable,
      isGeneratable: row.isGeneratable,
      onboardingStatus: row.onboardingStatus,
    };
  }
}
