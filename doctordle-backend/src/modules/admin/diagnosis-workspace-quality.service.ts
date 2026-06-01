import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphFactStatus,
  ValidationOutcome,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  EducationRevisionQualityAnalyzer,
  type EducationRevisionAnalysis,
} from '../education/education-revision-quality-analyzer.service';
import {
  type AdminCaseQualityProjection,
  CaseQualityProjectionService,
} from './case-quality-projection.service';

type WorkspaceStatus =
  | 'ready'
  | 'needs_review'
  | 'blocked'
  | 'insufficient_data';

type GraphReadiness = 'none' | 'candidate_only' | 'review_needed' | 'fact_ready';

export type DiagnosisWorkspaceQualitySummary = {
  diagnosisRegistryId: string;
  diagnosisName: string;
  overallWorkspaceStatus: WorkspaceStatus;
  educationQuality: {
    status: 'missing' | 'draft' | 'review' | 'published' | 'archived';
    version: number | null;
    score: number | null;
    graphReadiness: number | null;
    blockerCount: number;
    warningCount: number;
  };
  caseQuality: {
    status: 'missing' | 'good' | 'warning' | 'blocker' | 'unknown';
    totalCases: number;
    usableCases: number;
    blockerCount: number;
    warningCount: number;
    strongestCaseId: string | null;
  };
  teachingCoverage: {
    overall: number | null;
    scores: Record<string, number>;
    missingItems: Array<{
      code: string;
      item?: string;
      section?: string;
    }>;
  };
  graphReadiness: {
    status: GraphReadiness;
    candidateCount: number;
    factCount: number;
    reviewableCandidateCount: number;
  };
  editorialBrief: {
    status: string | null;
    version: number | null;
    activeForGeneration: boolean;
  };
  revisionTrend: {
    latestVersion: number | null;
    previousVersion: number | null;
    overallDelta: number | null;
    graphReadinessDelta: number | null;
    direction: 'improved' | 'regressed' | 'unchanged' | 'unknown';
  };
  sectionHealth: EducationRevisionAnalysis['quality']['sectionHealth'];
  blockers: string[];
  warnings: string[];
  recommendedNextActions: string[];
};

type WorkspaceCaseRecord = {
  id: string;
  editorialStatus: CaseEditorialStatus | null;
  difficulty: string;
  explanation: Prisma.JsonValue | null;
  validationRuns: Array<{
    outcome: ValidationOutcome | null;
    summary: Prisma.JsonValue | null;
    findings: Prisma.JsonValue | null;
  }>;
};

@Injectable()
export class DiagnosisWorkspaceQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly educationRevisionQualityAnalyzer: EducationRevisionQualityAnalyzer,
    private readonly caseQualityProjectionService: CaseQualityProjectionService,
  ) {}

  async getSummary(
    diagnosisRegistryId: string,
  ): Promise<DiagnosisWorkspaceQualitySummary> {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        education: {
          select: {
            editorialStatus: true,
            version: true,
          },
        },
        editorialBrief: {
          select: {
            status: true,
            version: true,
          },
        },
        cases: {
          orderBy: { date: 'desc' },
          take: 10,
          select: {
            id: true,
            editorialStatus: true,
            difficulty: true,
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
        graphCandidates: {
          select: {
            id: true,
            status: true,
          },
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          select: {
            id: true,
          },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const revisionList =
      await this.educationRevisionQualityAnalyzer.listRevisions(
        diagnosisRegistryId,
      );
    const revisions = revisionList.revisions;
    const latestRevision = revisions[0] ?? null;
    const previousRevision = revisions[1] ?? null;
    const caseSummaries = registry.cases.map((caseRecord) => ({
      caseId: caseRecord.id,
      editorialStatus: caseRecord.editorialStatus,
      projection: this.caseQualityProjectionService.buildProjection(
        caseRecord as unknown as WorkspaceCaseRecord,
      ),
    }));
    const educationQuality = this.buildEducationQuality(
      registry.education,
      latestRevision,
    );
    const caseQuality = this.buildCaseQuality(caseSummaries);
    const graphReadiness = this.buildGraphReadiness({
      candidateStatuses: registry.graphCandidates.map(
        (candidate) => candidate.status,
      ),
      factCount: registry.graphFacts.length,
    });
    const teachingCoverage = {
      overall: latestRevision?.quality.coverageScores.overall ?? null,
      scores: latestRevision?.quality.coverageScores ?? {},
      missingItems:
        latestRevision?.quality.coverageWarnings.map((warning) => ({
          code: warning.code,
          item: warning.item,
          section: warning.section,
        })) ?? [],
    };
    const sectionHealth = latestRevision?.quality.sectionHealth ?? [];
    const revisionTrend = this.buildRevisionTrend(
      latestRevision,
      previousRevision,
    );
    const blockers = this.unique([
      ...(latestRevision?.quality.blockers.map(
        (blocker) => `education:${blocker}`,
      ) ?? []),
      ...caseSummaries.flatMap((caseSummary) =>
        caseSummary.projection.blockers.map(
          (blocker) => `case:${caseSummary.caseId}:${blocker}`,
        ),
      ),
    ]);
    const warnings = this.unique([
      ...(latestRevision?.quality.warnings.map(
        (warning) => `education:${warning}`,
      ) ?? []),
      ...(latestRevision?.quality.coverageWarnings.map((warning) =>
        warning.item
          ? `education:${warning.code}:${warning.item}`
          : `education:${warning.code}`,
      ) ?? []),
      ...caseSummaries.flatMap((caseSummary) =>
        caseSummary.projection.warnings.map(
          (warning) => `case:${caseSummary.caseId}:${warning}`,
        ),
      ),
      ...(graphReadiness.status === 'none'
        ? ['graph:no_graph_facts_or_candidates']
        : graphReadiness.status === 'review_needed'
          ? ['graph:review_candidates']
          : []),
    ]);
    const overallWorkspaceStatus = this.overallStatus({
      hasEducation: Boolean(registry.education),
      usableCases: caseQuality.usableCases,
      blockers,
      warnings,
      graphReadiness: graphReadiness.status,
      educationStatus: educationQuality.status,
      caseStatus: caseQuality.status,
    });

    return {
      diagnosisRegistryId: registry.id,
      diagnosisName: registry.displayLabel || registry.canonicalName,
      overallWorkspaceStatus,
      educationQuality,
      caseQuality,
      teachingCoverage,
      graphReadiness,
      editorialBrief: {
        status: registry.editorialBrief?.status ?? null,
        version: registry.editorialBrief?.version ?? null,
        activeForGeneration:
          registry.editorialBrief?.status === 'APPROVED' ||
          registry.editorialBrief?.status === 'ACTIVE',
      },
      revisionTrend,
      sectionHealth,
      blockers,
      warnings,
      recommendedNextActions: this.recommendedNextActions({
        educationStatus: educationQuality.status,
        blockers,
        warnings,
        caseQuality,
        graphReadiness,
        sectionHealth,
      }),
    };
  }

  private buildEducationQuality(
    education: { editorialStatus: DiagnosisEducationStatus; version: number } | null,
    latestRevision: EducationRevisionAnalysis | null,
  ): DiagnosisWorkspaceQualitySummary['educationQuality'] {
    return {
      status: education ? this.mapEducationStatus(education.editorialStatus) : 'missing',
      version: latestRevision?.version ?? education?.version ?? null,
      score: latestRevision?.quality.overallScore ?? null,
      graphReadiness: latestRevision?.quality.graphReadiness ?? null,
      blockerCount: latestRevision?.quality.blockerCount ?? 0,
      warningCount: latestRevision?.quality.warningCount ?? 0,
    };
  }

  private buildCaseQuality(
    cases: Array<{
      caseId: string;
      editorialStatus: CaseEditorialStatus | null;
      projection: AdminCaseQualityProjection;
    }>,
  ): DiagnosisWorkspaceQualitySummary['caseQuality'] {
    const usableCases = cases.filter(
      (caseSummary) =>
        this.isUsableCaseStatus(caseSummary.editorialStatus) &&
        !caseSummary.projection.blockers.length,
    );
    const blockerCount = cases.reduce(
      (count, caseSummary) => count + caseSummary.projection.blockers.length,
      0,
    );
    const warningCount = cases.reduce(
      (count, caseSummary) => count + caseSummary.projection.warnings.length,
      0,
    );
    const strongestCase = [...cases].sort(
      (left, right) =>
        this.caseScore(right.projection) - this.caseScore(left.projection),
    )[0];
    const hasUnknown = cases.some((caseSummary) =>
      Object.values(caseSummary.projection.dimensions).some(
        (dimension) => dimension.status === 'unknown',
      ),
    );

    return {
      status: cases.length
        ? blockerCount
          ? 'blocker'
          : warningCount
            ? 'warning'
            : hasUnknown
              ? 'unknown'
              : 'good'
        : 'missing',
      totalCases: cases.length,
      usableCases: usableCases.length,
      blockerCount,
      warningCount,
      strongestCaseId: strongestCase?.caseId ?? null,
    };
  }

  private buildGraphReadiness(input: {
    candidateStatuses: DiagnosisGraphCandidateStatus[];
    factCount: number;
  }): DiagnosisWorkspaceQualitySummary['graphReadiness'] {
    const reviewableCandidateCount = input.candidateStatuses.filter((status) =>
      this.isReviewableCandidateStatus(status),
    ).length;
    const status: GraphReadiness = input.factCount
      ? 'fact_ready'
      : input.candidateStatuses.length === 0
        ? 'none'
        : reviewableCandidateCount
          ? 'review_needed'
          : 'candidate_only';

    return {
      status,
      candidateCount: input.candidateStatuses.length,
      factCount: input.factCount,
      reviewableCandidateCount,
    };
  }

  private buildRevisionTrend(
    latestRevision: EducationRevisionAnalysis | null,
    previousRevision: EducationRevisionAnalysis | null,
  ): DiagnosisWorkspaceQualitySummary['revisionTrend'] {
    if (!latestRevision) {
      return {
        latestVersion: null,
        previousVersion: null,
        overallDelta: null,
        graphReadinessDelta: null,
        direction: 'unknown',
      };
    }

    if (!previousRevision) {
      return {
        latestVersion: latestRevision.version,
        previousVersion: null,
        overallDelta: null,
        graphReadinessDelta: null,
        direction: 'unknown',
      };
    }

    const overallDelta = this.round(
      latestRevision.quality.overallScore - previousRevision.quality.overallScore,
    );
    const graphReadinessDelta = this.round(
      latestRevision.quality.graphReadiness -
        previousRevision.quality.graphReadiness,
    );

    return {
      latestVersion: latestRevision.version,
      previousVersion: previousRevision.version,
      overallDelta,
      graphReadinessDelta,
      direction:
        Math.abs(overallDelta) < 0.05
          ? 'unchanged'
          : overallDelta > 0
            ? 'improved'
            : 'regressed',
    };
  }

  private overallStatus(input: {
    hasEducation: boolean;
    usableCases: number;
    blockers: string[];
    warnings: string[];
    graphReadiness: GraphReadiness;
    educationStatus: DiagnosisWorkspaceQualitySummary['educationQuality']['status'];
    caseStatus: DiagnosisWorkspaceQualitySummary['caseQuality']['status'];
  }): WorkspaceStatus {
    if (!input.hasEducation && input.usableCases === 0) {
      return 'insufficient_data';
    }

    if (input.blockers.length || input.caseStatus === 'blocker') {
      return 'blocked';
    }

    if (
      input.warnings.length ||
      input.graphReadiness !== 'fact_ready' ||
      input.educationStatus !== 'published' ||
      input.caseStatus === 'warning' ||
      input.caseStatus === 'unknown'
    ) {
      return 'needs_review';
    }

    return 'ready';
  }

  private recommendedNextActions(input: {
    educationStatus: DiagnosisWorkspaceQualitySummary['educationQuality']['status'];
    blockers: string[];
    warnings: string[];
    caseQuality: DiagnosisWorkspaceQualitySummary['caseQuality'];
    graphReadiness: DiagnosisWorkspaceQualitySummary['graphReadiness'];
    sectionHealth: DiagnosisWorkspaceQualitySummary['sectionHealth'];
  }): string[] {
    const actions: string[] = [];

    for (const section of input.sectionHealth.filter(
      (section) => section.regenerationRecommended,
    )) {
      actions.push(`Regenerate ${this.sectionLabel(section.section)}`);
    }

    if (
      input.sectionHealth.some(
        (section) => section.section === 'management' && section.warnings.length,
      )
    ) {
      actions.push('Review weak management anchors');
    }

    if (input.caseQuality.usableCases === 0 || input.caseQuality.status === 'blocker') {
      actions.push('Add or approve more cases');
    }

    if (
      input.graphReadiness.status === 'none' ||
      input.graphReadiness.status === 'review_needed'
    ) {
      actions.push('Improve graph discriminator coverage');
    }

    if (
      input.educationStatus !== 'published' &&
      !input.blockers.some((blocker) => blocker.startsWith('education:'))
    ) {
      actions.push('Publish education after blocker resolution');
    }

    if (!actions.length && input.warnings.length) {
      actions.push('Review workspace warnings');
    }

    return this.unique(actions).slice(0, 8);
  }

  private caseScore(projection: AdminCaseQualityProjection): number {
    const statuses = Object.values(projection.dimensions);
    const scoreValues = statuses
      .map((dimension) => dimension.score)
      .filter((score): score is number => typeof score === 'number');

    if (scoreValues.length) {
      return scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
    }

    return projection.blockers.length
      ? 0
      : projection.warnings.length
        ? 0.5
        : 1;
  }

  private mapEducationStatus(
    status: DiagnosisEducationStatus,
  ): DiagnosisWorkspaceQualitySummary['educationQuality']['status'] {
    if (status === DiagnosisEducationStatus.PUBLISHED) {
      return 'published';
    }
    if (status === DiagnosisEducationStatus.ARCHIVED) {
      return 'archived';
    }
    if (
      status === DiagnosisEducationStatus.NEEDS_REVIEW ||
      status === DiagnosisEducationStatus.NEEDS_EDIT ||
      status === DiagnosisEducationStatus.APPROVED ||
      status === DiagnosisEducationStatus.REJECTED
    ) {
      return 'review';
    }
    return 'draft';
  }

  private isUsableCaseStatus(status: CaseEditorialStatus | null): boolean {
    return (
      status === CaseEditorialStatus.APPROVED ||
      status === CaseEditorialStatus.READY_TO_PUBLISH ||
      status === CaseEditorialStatus.PUBLISHED
    );
  }

  private isReviewableCandidateStatus(
    status: DiagnosisGraphCandidateStatus,
  ): boolean {
    return (
      status === DiagnosisGraphCandidateStatus.CANDIDATE ||
      status === DiagnosisGraphCandidateStatus.APPROVED
    );
  }

  private sectionLabel(section: string): string {
    return section
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase();
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }
}
