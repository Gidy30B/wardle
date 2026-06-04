import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  DiagnosisRegistryCandidateStatus,
  DiagnosisRegistryStatus,
  DifferentialResolutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';
import { DiagnosisRegistryLifecyclePolicyService } from './diagnosis-registry-lifecycle-policy.service';

export type RegistryMergeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

export type RegistryMergeAnalysis = {
  analysisHash: string;
  allowed: boolean;
  severity: RegistryMergeSeverity;
  blockers: string[];
  warnings: string[];
  readiness: {
    score: number;
    label: 'ready' | 'needs_review' | 'blocked';
  };
  impact: Record<string, number>;
  conflicts: {
    aliases: string[];
    teachingRules: string[];
    graph: string[];
    lifecycle: string[];
    duplicateCases: string[];
  };
  recommendations: string[];
  mergePreview: {
    resultingCanonical: string;
    resultingAliases: string[];
    resultingStatus: DiagnosisRegistryStatus;
    resultingVisibility: {
      editorialVisible: boolean;
      dictionaryVisible: boolean;
      playable: boolean;
      generatable: boolean;
    };
  };
  source: RegistryMergeRegistrySummary;
  target: RegistryMergeRegistrySummary;
};

export type RegistryMergeRelated = {
  diagnosisRegistryId: string;
  potentialDuplicateSuggestions: Array<{
    id: string;
    canonicalName: string;
    displayLabel: string;
    status: DiagnosisRegistryStatus;
    reason: string;
  }>;
  aliasSimilarityMatches: Array<{
    diagnosisRegistryId: string;
    displayLabel: string;
    alias: string;
    reason: string;
  }>;
  candidateConflicts: Array<{
    id: string;
    proposedCanonicalName: string;
    status: DiagnosisRegistryCandidateStatus;
    sourceRawText: string;
  }>;
};

type RegistryMergeRegistrySummary = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  status: DiagnosisRegistryStatus;
  active: boolean;
  isPlayable: boolean;
  isGeneratable: boolean;
  onboardingStatus: string | null;
  aliases: Array<{
    id: string;
    term: string;
    normalizedTerm: string;
    active: boolean;
    acceptedForMatch: boolean;
  }>;
};

type ImpactSide = {
  aliases: number;
  teachingRules: number;
  editorialBriefs: number;
  education: number;
  cases: number;
  caseRevisions: number;
  differentialMappings: number;
  differentialLinks: number;
  graphFacts: number;
  graphCandidates: number;
  registryCandidates: number;
  notifications: number;
  coverage: number;
  learnState: number;
};

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
export class DiagnosisRegistryMergeAnalysisService {
  private readonly logger = new Logger(
    DiagnosisRegistryMergeAnalysisService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecyclePolicy: DiagnosisRegistryLifecyclePolicyService,
  ) {}

  async analyzeMerge(
    sourceDiagnosisRegistryId: string,
    targetDiagnosisRegistryId: string,
  ): Promise<RegistryMergeAnalysis> {
    this.logger.log({
      event: 'diagnosis.merge.analysis.started',
      sourceDiagnosisRegistryId,
      targetDiagnosisRegistryId,
    });

    if (sourceDiagnosisRegistryId === targetDiagnosisRegistryId) {
      this.logger.warn({
        event: 'diagnosis.merge.analysis.blocked',
        sourceDiagnosisRegistryId,
        targetDiagnosisRegistryId,
        reason: 'same_diagnosis',
      });
      throw new BadRequestException('Source and target diagnosis must differ');
    }

    const [source, target] = await Promise.all([
      this.loadRegistry(sourceDiagnosisRegistryId),
      this.loadRegistry(targetDiagnosisRegistryId),
    ]);
    const [sourceImpact, targetImpact] = await Promise.all([
      this.estimateImpact(source.id),
      this.estimateImpact(target.id),
    ]);
    const [sourceLifecycle, targetLifecycle] = await Promise.all([
      this.lifecyclePolicy.getLifecycle(source.id),
      this.lifecyclePolicy.getLifecycle(target.id),
    ]);
    const conflicts = await this.detectConflicts(source, target);
    const impact = this.combineImpact(sourceImpact, targetImpact);
    const lifecycleConflicts = [
      ...conflicts.lifecycle,
      ...this.detectLifecycleConflicts(source, target, {
        sourceImpact,
        targetImpact,
        sourceLifecycle,
        targetLifecycle,
      }),
    ];
    const allConflicts = {
      ...conflicts,
      lifecycle: this.unique(lifecycleConflicts),
    };
    const { blockers, warnings } = this.computeBlockersAndWarnings(
      allConflicts,
      impact,
    );
    const severity = this.computeSeverity(blockers, warnings, impact);
    const readinessScore = this.computeReadinessScore(
      blockers,
      warnings,
      severity,
    );
    const readinessLabel: RegistryMergeAnalysis['readiness']['label'] =
      blockers.length > 0
        ? 'blocked'
        : warnings.length > 0
          ? 'needs_review'
          : 'ready';
    const analysisWithoutHash = {
      allowed: blockers.length === 0,
      severity,
      blockers,
      warnings,
      readiness: {
        score: readinessScore,
        label: readinessLabel,
      },
      impact,
      conflicts: allConflicts,
      recommendations: this.buildRecommendations(blockers, warnings, source),
      mergePreview: this.buildMergePreview(source, target),
      source,
      target,
    };
    const analysis = {
      analysisHash: this.hashAnalysis(analysisWithoutHash),
      ...analysisWithoutHash,
    } satisfies RegistryMergeAnalysis;

    this.logger.log({
      event: 'diagnosis.merge.analysis.completed',
      sourceDiagnosisRegistryId,
      targetDiagnosisRegistryId,
      severity: analysis.severity,
      allowed: analysis.allowed,
      blockerCount: blockers.length,
      warningCount: warnings.length,
    });

    return analysis;
  }

  async getMergeRelated(
    diagnosisRegistryId: string,
  ): Promise<RegistryMergeRelated> {
    const registry = await this.loadRegistry(diagnosisRegistryId);
    const aliasTerms = registry.aliases.map((alias) => alias.normalizedTerm);
    const tokens = registry.canonicalNormalized
      .split(' ')
      .filter((token) => token.length >= 4);

    const [candidateConflicts, canonicalMatches, aliasMatches] =
      await Promise.all([
        this.prisma.diagnosisRegistryCandidate.findMany({
          where: {
            status: { in: PENDING_CANDIDATE_STATUSES },
            OR: [
              { proposedCanonicalNormalized: registry.canonicalNormalized },
              { sourceRawText: { contains: registry.displayLabel, mode: 'insensitive' } },
            ],
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: 10,
          select: {
            id: true,
            proposedCanonicalName: true,
            status: true,
            sourceRawText: true,
          },
        }),
        this.prisma.diagnosisRegistry.findMany({
          where: {
            id: { not: registry.id },
            OR: [
              { canonicalNormalized: registry.canonicalNormalized },
              ...(tokens.length
                ? tokens.map((token) => ({
                    canonicalNormalized: { contains: token },
                  }))
                : []),
            ],
          },
          orderBy: [{ searchPriority: 'desc' }, { displayLabel: 'asc' }],
          take: 10,
          select: {
            id: true,
            canonicalName: true,
            displayLabel: true,
            status: true,
          },
        }),
        this.prisma.diagnosisAlias.findMany({
          where: {
            diagnosisRegistryId: { not: registry.id },
            active: true,
            normalizedTerm: {
              in: [registry.canonicalNormalized, ...aliasTerms],
            },
          },
          take: 10,
          select: {
            term: true,
            normalizedTerm: true,
            diagnosisRegistryId: true,
            diagnosis: {
              select: {
                displayLabel: true,
              },
            },
          },
        }),
      ]);

    return {
      diagnosisRegistryId: registry.id,
      potentialDuplicateSuggestions: canonicalMatches.map((match) => ({
        ...match,
        reason:
          match.canonicalName === registry.canonicalName
            ? 'Canonical name match'
            : 'Canonical text similarity',
      })),
      aliasSimilarityMatches: aliasMatches.map((match) => ({
        diagnosisRegistryId: match.diagnosisRegistryId,
        displayLabel: match.diagnosis.displayLabel,
        alias: match.term,
        reason:
          match.normalizedTerm === registry.canonicalNormalized
            ? 'Alias matches canonical name'
            : 'Alias overlaps with an existing alias',
      })),
      candidateConflicts,
    };
  }

  private async loadRegistry(
    diagnosisRegistryId: string,
  ): Promise<RegistryMergeRegistrySummary> {
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
        aliases: {
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
          select: {
            id: true,
            term: true,
            normalizedTerm: true,
            active: true,
            acceptedForMatch: true,
          },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    return registry;
  }

  private async estimateImpact(
    diagnosisRegistryId: string,
  ): Promise<ImpactSide> {
    const [
      aliases,
      teachingRules,
      editorialBriefs,
      education,
      cases,
      caseRevisions,
      caseDifferentialMappings,
      educationDifferentialMappings,
      caseDifferentialLinks,
      educationDifferentialLinks,
      graphFacts,
      targetedGraphFacts,
      graphCandidates,
      targetedGraphCandidates,
      contextualRegistryCandidates,
      createdRegistryCandidates,
      selectedAttempts,
      strictMatchedAttempts,
    ] = await Promise.all([
      this.prisma.diagnosisAlias.count({ where: { diagnosisRegistryId } }),
      this.prisma.diagnosisTeachingRule.count({ where: { diagnosisRegistryId } }),
      this.prisma.diagnosisEditorialBrief.count({ where: { diagnosisRegistryId } }),
      this.prisma.diagnosisEducation.count({ where: { diagnosisRegistryId } }),
      this.prisma.case.count({ where: { diagnosisRegistryId } }),
      this.prisma.caseRevision.count({ where: { diagnosisRegistryId } }),
      this.prisma.caseDifferentialMapping.count({
        where: { resolvedDiagnosisRegistryId: diagnosisRegistryId },
      }),
      this.prisma.educationDifferentialMapping.count({
        where: {
          OR: [
            { diagnosisRegistryId },
            { resolvedDiagnosisRegistryId: diagnosisRegistryId },
          ],
        },
      }),
      this.prisma.caseDifferentialLink.count({ where: { diagnosisRegistryId } }),
      this.prisma.educationDifferentialLink.count({
        where: { diagnosisRegistryId },
      }),
      this.prisma.diagnosisGraphFact.count({ where: { diagnosisRegistryId } }),
      this.prisma.diagnosisGraphFact.count({
        where: { targetDiagnosisRegistryId: diagnosisRegistryId },
      }),
      this.prisma.diagnosisGraphCandidate.count({
        where: { diagnosisRegistryId },
      }),
      this.prisma.diagnosisGraphCandidate.count({
        where: { targetDiagnosisRegistryId: diagnosisRegistryId },
      }),
      this.prisma.diagnosisRegistryCandidate.count({
        where: { contextDiagnosisRegistryId: diagnosisRegistryId },
      }),
      this.prisma.diagnosisRegistryCandidate.count({
        where: { createdRegistryId: diagnosisRegistryId },
      }),
      this.prisma.attempt.count({
        where: {
          OR: [
            { selectedDiagnosisId: diagnosisRegistryId },
            { strictMatchedDiagnosisId: diagnosisRegistryId },
          ],
        },
      }),
      this.prisma.attempt.count({
        where: { strictMatchedDiagnosisId: diagnosisRegistryId },
      }),
    ]);

    return {
      aliases,
      teachingRules,
      editorialBriefs,
      education,
      cases,
      caseRevisions,
      differentialMappings:
        caseDifferentialMappings + educationDifferentialMappings,
      differentialLinks: caseDifferentialLinks + educationDifferentialLinks,
      graphFacts: graphFacts + targetedGraphFacts,
      graphCandidates: graphCandidates + targetedGraphCandidates,
      registryCandidates:
        contextualRegistryCandidates + createdRegistryCandidates,
      notifications: 0,
      coverage: teachingRules + graphFacts,
      learnState: selectedAttempts + strictMatchedAttempts,
    };
  }

  private async detectConflicts(
    source: RegistryMergeRegistrySummary,
    target: RegistryMergeRegistrySummary,
  ) {
    const [teachingRules, graphFacts, cases, unresolvedDifferentials] =
      await Promise.all([
        this.prisma.diagnosisTeachingRule.findMany({
          where: { diagnosisRegistryId: { in: [source.id, target.id] } },
          select: { diagnosisRegistryId: true, stableKey: true, title: true },
        }),
        this.prisma.diagnosisGraphFact.findMany({
          where: { diagnosisRegistryId: { in: [source.id, target.id] } },
          select: {
            diagnosisRegistryId: true,
            type: true,
            normalizedLabel: true,
            targetDiagnosisRegistryId: true,
            label: true,
          },
        }),
        this.prisma.case.findMany({
          where: { diagnosisRegistryId: { in: [source.id, target.id] } },
          select: { diagnosisRegistryId: true, id: true, title: true },
        }),
        this.prisma.caseDifferentialMapping.count({
          where: {
            resolvedDiagnosisRegistryId: source.id,
            status: { in: UNRESOLVED_DIFFERENTIAL_STATUSES },
          },
        }),
      ]);

    return {
      aliases: this.detectAliasConflicts(source, target),
      teachingRules: this.detectOverlap(
        teachingRules,
        source.id,
        target.id,
        (rule) => rule.stableKey,
        (rule) => rule.title,
      ),
      graph: this.detectOverlap(
        graphFacts,
        source.id,
        target.id,
        (fact) =>
          `${fact.type}:${fact.normalizedLabel}:${fact.targetDiagnosisRegistryId ?? ''}`,
        (fact) => fact.label,
      ),
      lifecycle: unresolvedDifferentials
        ? ['Source has unresolved or ambiguous differential mappings']
        : [],
      duplicateCases: this.detectOverlap(
        cases,
        source.id,
        target.id,
        (caseRecord) => normalizeDiagnosisTerm(caseRecord.title),
        (caseRecord) => caseRecord.title,
      ),
    };
  }

  private detectAliasConflicts(
    source: RegistryMergeRegistrySummary,
    target: RegistryMergeRegistrySummary,
  ): string[] {
    const targetTerms = new Map<string, string>();
    targetTerms.set(target.canonicalNormalized, target.canonicalName);
    for (const alias of target.aliases) {
      targetTerms.set(alias.normalizedTerm, alias.term);
    }

    const conflicts: string[] = [];
    if (targetTerms.has(source.canonicalNormalized)) {
      conflicts.push(
        `Source canonical "${source.canonicalName}" collides with target term "${targetTerms.get(source.canonicalNormalized)}"`,
      );
    }
    for (const alias of source.aliases) {
      const targetTerm = targetTerms.get(alias.normalizedTerm);
      if (targetTerm) {
        conflicts.push(
          `Source alias "${alias.term}" collides with target term "${targetTerm}"`,
        );
      }
    }
    return this.unique(conflicts);
  }

  private detectLifecycleConflicts(
    source: RegistryMergeRegistrySummary,
    target: RegistryMergeRegistrySummary,
    input: {
      sourceImpact: ImpactSide;
      targetImpact: ImpactSide;
      sourceLifecycle: Awaited<
        ReturnType<DiagnosisRegistryLifecyclePolicyService['getLifecycle']>
      >;
      targetLifecycle: Awaited<
        ReturnType<DiagnosisRegistryLifecyclePolicyService['getLifecycle']>
      >;
    },
  ): string[] {
    const conflicts: string[] = [];
    if (source.isPlayable && !target.isPlayable) {
      conflicts.push('Source is playable while target is not playable');
    }
    if (source.isGeneratable && !target.isGeneratable) {
      conflicts.push('Source is generatable while target is not generatable');
    }
    if (source.status === DiagnosisRegistryStatus.ACTIVE && !target.active) {
      conflicts.push('Source is active while target is inactive');
    }
    if (
      input.sourceLifecycle.duplicateRisk.registryCanonicalMatches > 0 ||
      input.targetLifecycle.duplicateRisk.registryCanonicalMatches > 0
    ) {
      conflicts.push('Lifecycle duplicate risk exists on one side');
    }
    if (input.sourceImpact.learnState + input.targetImpact.learnState > 0) {
      conflicts.push('Player attempt history references one or both diagnoses');
    }
    return conflicts;
  }

  private detectOverlap<T extends { diagnosisRegistryId: string | null }>(
    rows: T[],
    sourceId: string,
    targetId: string,
    keyFor: (row: T) => string,
    labelFor: (row: T) => string,
  ): string[] {
    const sourceKeys = new Map<string, string>();
    const targetKeys = new Map<string, string>();

    for (const row of rows) {
      if (row.diagnosisRegistryId === sourceId) {
        sourceKeys.set(keyFor(row), labelFor(row));
      }
      if (row.diagnosisRegistryId === targetId) {
        targetKeys.set(keyFor(row), labelFor(row));
      }
    }

    return Array.from(sourceKeys.entries())
      .filter(([key]) => targetKeys.has(key))
      .map(
        ([key, label]) =>
          `${label} overlaps with target item "${targetKeys.get(key)}" (${key})`,
      );
  }

  private combineImpact(source: ImpactSide, target: ImpactSide) {
    const keys = Object.keys(source) as Array<keyof ImpactSide>;
    return Object.fromEntries(
      keys.map((key) => [key, source[key] + target[key]]),
    ) as Record<keyof ImpactSide, number>;
  }

  private computeBlockersAndWarnings(
    conflicts: RegistryMergeAnalysis['conflicts'],
    impact: Record<string, number>,
  ) {
    const blockers = [
      ...conflicts.aliases.map((conflict) => `Alias conflict: ${conflict}`),
      ...conflicts.teachingRules.map(
        (conflict) => `Teaching rule conflict: ${conflict}`,
      ),
      ...conflicts.graph.map((conflict) => `Graph fact conflict: ${conflict}`),
    ];
    const warnings = [
      ...conflicts.lifecycle.map((conflict) => `Lifecycle: ${conflict}`),
      ...conflicts.duplicateCases.map(
        (conflict) => `Duplicate case title: ${conflict}`,
      ),
    ];

    if (impact.education > 1) {
      blockers.push(
        'DiagnosisEducation conflict: both source and target have education',
      );
    }
    if (impact.editorialBriefs > 1) {
      blockers.push(
        'DiagnosisEditorialBrief conflict: both source and target have editorial briefs',
      );
    }

    if (impact.cases > 10 || impact.caseRevisions > 20) {
      warnings.push('Large case/revision impact requires senior review');
    }

    return {
      blockers: this.unique(blockers),
      warnings: this.unique(warnings),
    };
  }

  private computeSeverity(
    blockers: string[],
    warnings: string[],
    impact: Record<string, number>,
  ): RegistryMergeSeverity {
    if (blockers.length) {
      return 'BLOCKED';
    }
    if (
      warnings.length >= 4 ||
      impact.cases > 10 ||
      impact.graphFacts > 10 ||
      impact.learnState > 0
    ) {
      return 'HIGH';
    }
    if (warnings.length > 0 || impact.cases > 0 || impact.education > 1) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private computeReadinessScore(
    blockers: string[],
    warnings: string[],
    severity: RegistryMergeSeverity,
  ): number {
    if (severity === 'BLOCKED') {
      return Math.max(0, 35 - blockers.length * 10);
    }
    const warningPenalty = warnings.length * 8;
    const severityPenalty =
      severity === 'HIGH' ? 25 : severity === 'MEDIUM' ? 10 : 0;
    return Math.max(0, Math.min(100, 100 - warningPenalty - severityPenalty));
  }

  private buildRecommendations(
    blockers: string[],
    warnings: string[],
    source: RegistryMergeRegistrySummary,
  ): string[] {
    const recommendations: string[] = [];
    if (blockers.some((blocker) => blocker.includes('Alias conflict'))) {
      recommendations.push('Resolve alias collisions before merge execution');
    }
    if (warnings.some((warning) => warning.includes('Lifecycle'))) {
      recommendations.push('Resolve lifecycle mismatch before merge execution');
    }
    if (source.active || source.isPlayable || source.isGeneratable) {
      recommendations.push('Consider deactivating the source before execution');
    }
    if (warnings.some((warning) => warning.includes('differential'))) {
      recommendations.push('Resolve unresolved differential mappings first');
    }
    if (!recommendations.length) {
      recommendations.push('Review impact summary before merge execution');
    }
    return this.unique(recommendations);
  }

  private buildMergePreview(
    source: RegistryMergeRegistrySummary,
    target: RegistryMergeRegistrySummary,
  ): RegistryMergeAnalysis['mergePreview'] {
    const resultingAliases = this.unique([
      ...target.aliases.map((alias) => alias.term),
      source.canonicalName,
      ...source.aliases.map((alias) => alias.term),
    ]);
    return {
      resultingCanonical: target.canonicalName,
      resultingAliases,
      resultingStatus: target.status,
      resultingVisibility: {
        editorialVisible: this.lifecyclePolicy.isEditorialVisible(target),
        dictionaryVisible: this.lifecyclePolicy.isDictionaryVisible(target),
        playable: this.lifecyclePolicy.isPlayable(target),
        generatable: this.lifecyclePolicy.isGeneratable(target),
      },
    };
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim())));
  }

  private hashAnalysis(analysis: Omit<RegistryMergeAnalysis, 'analysisHash'>) {
    return createHash('sha256')
      .update(stableStringify(analysis))
      .digest('hex');
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
