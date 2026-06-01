import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphFactStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { EducationDraftQualityValidator } from '../education/education-draft-quality-validator.service';
import { EducationKnowledgeRulesService } from '../education/education-knowledge-rules.service';
import {
  EducationSectionQualityClassifier,
  type SectionFailureSummary,
} from '../education/education-section-quality-classifier.service';
import { DiagnosisCurriculumProviderService } from '../education/diagnosis-curriculum-provider.service';

type WorkspaceEducationStatus =
  | 'missing'
  | 'draft'
  | 'review'
  | 'published'
  | 'archived';

type WorkspaceGraphReadiness =
  | 'none'
  | 'candidate_only'
  | 'review_needed'
  | 'fact_ready';

type WorkspaceProjectionRegistryRecord = {
  id: string;
  displayLabel: string;
  canonicalName: string;
  specialty: string | null;
  difficultyBand: string | null;
  aliases: Array<{ term: string }>;
  education: {
    id: string;
    version: number;
    editorialStatus: DiagnosisEducationStatus;
    updatedAt: Date;
    summary: unknown;
    clinicalPattern: unknown;
    keySymptoms: unknown;
    keySigns: unknown;
    examPearls: unknown;
    scoringSystems: unknown;
    investigations: unknown;
    differentials: unknown;
    management: unknown;
    complications: unknown;
    pitfalls: unknown;
    recallPrompts: unknown;
    references: unknown;
  } | null;
  cases: Array<{
    id: string;
    title: string;
    editorialStatus: CaseEditorialStatus | null;
    difficulty: string;
    date: Date;
  }>;
  graphCandidates: Array<{
    id: string;
    type: string;
    status: DiagnosisGraphCandidateStatus;
    promotedFactId: string | null;
  }>;
  graphFacts: Array<{
    id: string;
    type: string;
    status: DiagnosisGraphFactStatus;
  }>;
};

export type DiagnosisWorkspaceProjection = {
  diagnosis: {
    id: string;
    displayLabel: string;
    canonicalName?: string | null;
    aliases: string[];
    specialty?: string | null;
    difficultyBand?: string | null;
  };
  sourceSummary: {
    hasEducation: boolean;
    hasPublishedEducation: boolean;
    caseCount: number;
    approvedCaseCount: number;
    publishedCaseCount: number;
    graphCandidateCount: number;
    promotedGraphFactCount: number;
  };
  education: {
    status: WorkspaceEducationStatus;
    id?: string;
    version?: number;
    editorialStatus?: string;
    updatedAt?: string;
    qualityReport?: {
      scores?: Record<string, number>;
      sectionScores?: Record<string, number>;
      coverageScores?: Record<string, number>;
      patternComplianceScores?: Record<string, number>;
      coverageWarnings?: Array<{
        code: string;
        item: string;
        section: string;
        severity: string;
      }>;
      sectionFailureSummary?: SectionFailureSummary[];
      warnings: string[];
      blockers: string[];
    };
  };
  cases: {
    total: number;
    byStatus: Record<string, number>;
    latest?: {
      id: string;
      title: string;
      editorialStatus?: string | null;
      difficulty?: string | null;
      updatedAt?: string;
    };
  };
  graph: {
    candidates: {
      total: number;
      byType: Record<string, number>;
      byStatus: Record<string, number>;
    };
    facts: {
      total: number;
      byType: Record<string, number>;
    };
    readiness: WorkspaceGraphReadiness;
  };
  readiness: {
    generationReady: boolean;
    educationReadyForReview: boolean;
    publishReady: boolean;
    graphReady: boolean;
    missing: string[];
    nextActions: string[];
  };
};

@Injectable()
export class WorkspaceProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly educationDraftQualityValidator: EducationDraftQualityValidator = new EducationDraftQualityValidator(),
    private readonly educationKnowledgeRulesService: EducationKnowledgeRulesService = new EducationKnowledgeRulesService(),
    private readonly diagnosisCurriculumProviderService: DiagnosisCurriculumProviderService = new DiagnosisCurriculumProviderService(),
    private readonly educationSectionQualityClassifier: EducationSectionQualityClassifier = new EducationSectionQualityClassifier(),
  ) {}

  async getProjection(
    diagnosisRegistryId: string,
  ): Promise<DiagnosisWorkspaceProjection> {
    const registry = (await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        difficultyBand: true,
        aliases: {
          where: { active: true },
          orderBy: [{ acceptedForMatch: 'desc' }, { rank: 'asc' }],
          select: { term: true },
        },
        education: {
          select: {
            id: true,
            version: true,
            editorialStatus: true,
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
        cases: {
          orderBy: { date: 'desc' },
          select: {
            id: true,
            title: true,
            editorialStatus: true,
            difficulty: true,
            date: true,
          },
        },
        graphCandidates: {
          select: {
            id: true,
            type: true,
            status: true,
            promotedFactId: true,
          },
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
      },
    })) as WorkspaceProjectionRegistryRecord | null;

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const qualityReport = registry.education
      ? await this.buildQualityReport({
          ...registry,
          education: registry.education,
        })
      : null;
    const education = registry.education
      ? {
          status: this.mapEducationStatus(registry.education.editorialStatus),
          id: registry.education.id,
          version: registry.education.version,
          editorialStatus: registry.education.editorialStatus,
          updatedAt: registry.education.updatedAt.toISOString(),
          ...(qualityReport ? { qualityReport } : {}),
        }
      : { status: 'missing' as const };
    const casesByStatus = this.countBy(
      registry.cases.map((caseRecord) => caseRecord.editorialStatus ?? 'null'),
    );
    const candidateByType = this.countBy(
      registry.graphCandidates.map((candidate) => candidate.type),
    );
    const candidateByStatus = this.countBy(
      registry.graphCandidates.map((candidate) => candidate.status),
    );
    const factByType = this.countBy(
      registry.graphFacts.map((fact) => fact.type),
    );
    const graphReadiness = this.getGraphReadiness({
      candidateStatuses: registry.graphCandidates.map(
        (candidate) => candidate.status,
      ),
      factCount: registry.graphFacts.length,
    });
    const readiness = this.buildReadiness({
      hasDiagnosis: true,
      educationStatus: education.status,
      educationBlockers: qualityReport?.blockers ?? [],
      educationWarnings: qualityReport?.warnings ?? [],
      caseCount: registry.cases.length,
      graphReadiness,
    });

    return {
      diagnosis: {
        id: registry.id,
        displayLabel: registry.displayLabel,
        canonicalName: registry.canonicalName,
        aliases: registry.aliases.map((alias) => alias.term),
        specialty: registry.specialty,
        difficultyBand: registry.difficultyBand ?? null,
      },
      sourceSummary: {
        hasEducation: Boolean(registry.education),
        hasPublishedEducation:
          registry.education?.editorialStatus ===
          DiagnosisEducationStatus.PUBLISHED,
        caseCount: registry.cases.length,
        approvedCaseCount: registry.cases.filter((caseRecord) =>
          this.isApprovedCaseStatus(caseRecord.editorialStatus),
        ).length,
        publishedCaseCount: registry.cases.filter(
          (caseRecord) =>
            caseRecord.editorialStatus === CaseEditorialStatus.PUBLISHED,
        ).length,
        graphCandidateCount: registry.graphCandidates.length,
        promotedGraphFactCount: registry.graphFacts.length,
      },
      education,
      cases: {
        total: registry.cases.length,
        byStatus: casesByStatus,
        ...(registry.cases[0]
          ? {
              latest: {
                id: registry.cases[0].id,
                title: registry.cases[0].title,
                editorialStatus: registry.cases[0].editorialStatus ?? null,
                difficulty: registry.cases[0].difficulty ?? null,
                updatedAt: registry.cases[0].date.toISOString(),
              },
            }
          : {}),
      },
      graph: {
        candidates: {
          total: registry.graphCandidates.length,
          byType: candidateByType,
          byStatus: candidateByStatus,
        },
        facts: {
          total: registry.graphFacts.length,
          byType: factByType,
        },
        readiness: graphReadiness,
      },
      readiness,
    };
  }

  private async buildQualityReport(registry: {
    canonicalName: string;
    displayLabel: string;
    specialty: string | null;
    difficultyBand: unknown;
    aliases: Array<{ term: string }>;
    education: {
      summary: unknown;
      clinicalPattern: unknown;
      keySymptoms: unknown;
      keySigns: unknown;
      examPearls: unknown;
      scoringSystems: unknown;
      investigations: unknown;
      differentials: unknown;
      management: unknown;
      complications: unknown;
      pitfalls: unknown;
      recallPrompts: unknown;
      references: unknown;
    };
  }) {
    const metadata = {
      canonicalName: registry.canonicalName,
      displayLabel: registry.displayLabel,
      specialty: registry.specialty,
      difficultyBand:
        typeof registry.difficultyBand === 'string'
          ? registry.difficultyBand
          : null,
      aliases: registry.aliases,
    };
    const teachingRules =
      await this.diagnosisCurriculumProviderService.getRules(metadata);
    const quality = this.educationDraftQualityValidator.validate({
      draft: {
        summary: registry.education.summary,
        clinicalPattern: registry.education.clinicalPattern,
        keySymptoms: registry.education.keySymptoms,
        keySigns: registry.education.keySigns,
        examPearls: registry.education.examPearls,
        scoringSystems: registry.education.scoringSystems,
        investigations: registry.education.investigations,
        differentials: registry.education.differentials,
        management: registry.education.management,
        complications: registry.education.complications,
        pitfalls: registry.education.pitfalls,
        recallPrompts: registry.education.recallPrompts,
        references: registry.education.references,
      },
      guidance: this.educationKnowledgeRulesService.getGuidance(metadata),
      teachingRules,
    });

    return {
      scores: quality.scores,
      sectionScores: quality.sectionScores,
      coverageScores: quality.coverageScores,
      patternComplianceScores: quality.patternComplianceScores,
      coverageWarnings: quality.coverageWarnings,
      sectionFailureSummary:
        this.educationSectionQualityClassifier.summarize(quality),
      warnings: quality.warnings,
      blockers: quality.blockers,
    };
  }

  private mapEducationStatus(
    status: DiagnosisEducationStatus,
  ): WorkspaceEducationStatus {
    if (status === DiagnosisEducationStatus.PUBLISHED) {
      return 'published';
    }

    if (status === DiagnosisEducationStatus.ARCHIVED) {
      return 'archived';
    }

    if (
      status === DiagnosisEducationStatus.DRAFT ||
      status === DiagnosisEducationStatus.GENERATED
    ) {
      return 'draft';
    }

    return 'review';
  }

  private getGraphReadiness(input: {
    candidateStatuses: DiagnosisGraphCandidateStatus[];
    factCount: number;
  }): WorkspaceGraphReadiness {
    if (input.factCount > 0) {
      return 'fact_ready';
    }

    if (!input.candidateStatuses.length) {
      return 'none';
    }

    if (input.candidateStatuses.some((status) => this.isReviewableCandidateStatus(status))) {
      return 'review_needed';
    }

    return 'candidate_only';
  }

  private buildReadiness(input: {
    hasDiagnosis: boolean;
    educationStatus: WorkspaceEducationStatus;
    educationBlockers: string[];
    educationWarnings: string[];
    caseCount: number;
    graphReadiness: WorkspaceGraphReadiness;
  }) {
    const missing: string[] = [];
    const nextActions: string[] = [];
    const hasEducation = input.educationStatus !== 'missing';
    const hasCoverageWarnings = input.educationWarnings.some((warning) =>
      warning.startsWith('missing_required_'),
    );

    if (!hasEducation) {
      missing.push('education');
      nextActions.push('Generate education draft');
    }

    if (!input.caseCount) {
      missing.push('cases');
      nextActions.push('Generate more cases');
    }

    if (hasEducation && input.educationBlockers.length) {
      nextActions.push('Resolve education blockers');
    }

    if (
      hasEducation &&
      !input.educationBlockers.length &&
      input.educationStatus !== 'published'
    ) {
      nextActions.push(
        hasCoverageWarnings ? 'Resolve required teaching coverage' : 'Publish education',
      );
    }

    if (input.graphReadiness === 'review_needed') {
      nextActions.push('Review graph candidates');
    } else if (input.graphReadiness === 'none') {
      nextActions.push('Promote graph facts');
    }

    return {
      generationReady: input.hasDiagnosis,
      educationReadyForReview:
        hasEducation && input.educationBlockers.length === 0,
      publishReady:
        hasEducation &&
        input.educationBlockers.length === 0 &&
        !hasCoverageWarnings &&
        input.educationStatus !== 'archived',
      graphReady: input.graphReadiness !== 'none',
      missing,
      nextActions: [...new Set(nextActions)],
    };
  }

  private countBy(values: Array<string | null>): Record<string, number> {
    return values.reduce<Record<string, number>>((counts, value) => {
      const key = value ?? 'null';
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }

  private isApprovedCaseStatus(status: CaseEditorialStatus | null): boolean {
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
}
