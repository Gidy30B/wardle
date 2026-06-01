import { Injectable, NotFoundException } from '@nestjs/common';
import { DiagnosisEducationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  EducationDraftQualityResult,
  EducationDraftQualityValidator,
} from './education-draft-quality-validator.service';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';
import {
  EducationSectionQualityClassifier,
  type SectionFailureSummary,
} from './education-section-quality-classifier.service';
import { DiagnosisCurriculumProviderService } from './diagnosis-curriculum-provider.service';

type RevisionRow = {
  id: string;
  educationId: string;
  version: number;
  snapshot: Prisma.JsonValue;
  editorialStatus: DiagnosisEducationStatus;
  source: string;
  createdByUserId: string | null;
  createdAt: Date;
};

type RegistryMetadata = {
  canonicalName: string | null;
  displayLabel: string | null;
  specialty: string | null;
  category: string | null;
  bodySystem: string | null;
  clinicalSetting: string | null;
  difficultyBand: string | null;
  aliases: Array<{ term: string | null }>;
};

export type EducationRevisionQualitySummary = {
  overallScore: number;
  graphReadiness: number;
  sectionScores: Record<string, number>;
  coverageScores: Record<string, number>;
  patternComplianceScores: Record<string, number>;
  warnings: string[];
  blockers: string[];
  coverageWarnings: EducationDraftQualityResult['coverageWarnings'];
  sectionHealth: SectionFailureSummary[];
  warningCount: number;
  blockerCount: number;
};

export type EducationRevisionAnalysis = {
  id: string;
  educationId: string;
  version: number;
  editorialStatus: DiagnosisEducationStatus;
  source: string;
  createdByUserId: string | null;
  createdAt: string;
  changedSections?: string[];
  quality: EducationRevisionQualitySummary;
};

export type EducationRevisionCompareResult = {
  fromVersion: number;
  toVersion: number;
  blockerChanges: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  warningChanges: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  sectionChanges: Array<{
    section: string;
    fromScore: number | null;
    toScore: number | null;
    delta: number | null;
    direction: 'improved' | 'regressed' | 'unchanged';
  }>;
  changedSections: string[];
  overallDelta: number;
  graphReadinessDelta: number;
  summary: {
    improvements: string[];
    regressions: string[];
  };
};

const SNAPSHOT_SECTIONS = [
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

@Injectable()
export class EducationRevisionQualityAnalyzer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly educationDraftQualityValidator: EducationDraftQualityValidator = new EducationDraftQualityValidator(),
    private readonly educationKnowledgeRulesService: EducationKnowledgeRulesService = new EducationKnowledgeRulesService(),
    private readonly diagnosisCurriculumProviderService: DiagnosisCurriculumProviderService = new DiagnosisCurriculumProviderService(),
    private readonly educationSectionQualityClassifier: EducationSectionQualityClassifier = new EducationSectionQualityClassifier(),
  ) {}

  async listRevisions(
    diagnosisRegistryId: string,
  ): Promise<{ diagnosisRegistryId: string; revisions: EducationRevisionAnalysis[] }> {
    const context = await this.loadRevisionContext(diagnosisRegistryId);

    if (!context.education) {
      return { diagnosisRegistryId, revisions: [] };
    }

    const analyses = await Promise.all(
      context.education.revisions.map((revision, index, rows) =>
        this.analyzeRevision({
          revision,
          previousRevision: rows[index + 1] ?? null,
          metadata: context.registry,
        }),
      ),
    );

    return { diagnosisRegistryId, revisions: analyses };
  }

  async getRevision(
    diagnosisRegistryId: string,
    version: number,
  ): Promise<EducationRevisionAnalysis> {
    const context = await this.loadRevisionContext(diagnosisRegistryId);
    const revision = context.education?.revisions.find(
      (candidate) => candidate.version === version,
    );

    if (!revision) {
      throw new NotFoundException('Diagnosis education revision not found');
    }

    const previousRevision =
      context.education?.revisions.find(
        (candidate) => candidate.version === version - 1,
      ) ?? null;

    return this.analyzeRevision({
      revision,
      previousRevision,
      metadata: context.registry,
    });
  }

  async compareRevisions(
    diagnosisRegistryId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<EducationRevisionCompareResult> {
    const context = await this.loadRevisionContext(diagnosisRegistryId);
    const revisions = context.education?.revisions ?? [];
    const fromRevision = revisions.find(
      (revision) => revision.version === fromVersion,
    );
    const toRevision = revisions.find((revision) => revision.version === toVersion);

    if (!fromRevision || !toRevision) {
      throw new NotFoundException('Diagnosis education revision not found');
    }

    const fromAnalysis = await this.analyzeRevision({
      revision: fromRevision,
      previousRevision: null,
      metadata: context.registry,
    });
    const toAnalysis = await this.analyzeRevision({
      revision: toRevision,
      previousRevision: fromRevision,
      metadata: context.registry,
    });

    return this.compareAnalyses(fromAnalysis, toAnalysis);
  }

  private async loadRevisionContext(diagnosisRegistryId: string) {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        specialty: true,
        category: true,
        bodySystem: true,
        clinicalSetting: true,
        difficultyBand: true,
        aliases: {
          where: { active: true },
          orderBy: [{ acceptedForMatch: 'desc' }, { rank: 'asc' }],
          select: { term: true },
        },
        education: {
          select: {
            id: true,
            revisions: {
              orderBy: { version: 'desc' },
              select: {
                id: true,
                educationId: true,
                version: true,
                snapshot: true,
                editorialStatus: true,
                source: true,
                createdByUserId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    return { registry, education: registry.education };
  }

  private async analyzeRevision(input: {
    revision: RevisionRow;
    previousRevision: RevisionRow | null;
    metadata: RegistryMetadata;
  }): Promise<EducationRevisionAnalysis> {
    const draft = this.draftFromSnapshot(input.revision.snapshot);
    const teachingRules = await this.diagnosisCurriculumProviderService.getRules(
      input.metadata,
    );
    const quality = this.educationDraftQualityValidator.validate({
      draft,
      guidance: this.educationKnowledgeRulesService.getGuidance(input.metadata),
      teachingRules,
    });
    const changedSections = input.previousRevision
      ? this.changedSections(
          input.previousRevision.snapshot,
          input.revision.snapshot,
        )
      : [];

    return {
      id: input.revision.id,
      educationId: input.revision.educationId,
      version: input.revision.version,
      editorialStatus: input.revision.editorialStatus,
      source: input.revision.source,
      createdByUserId: input.revision.createdByUserId,
      createdAt: input.revision.createdAt.toISOString(),
      changedSections,
      quality: this.summarizeQuality(quality),
    };
  }

  private summarizeQuality(
    quality: EducationDraftQualityResult,
  ): EducationRevisionQualitySummary {
    return {
      overallScore: quality.scores.graphReadinessScore,
      graphReadiness: quality.scores.graphReadinessScore,
      sectionScores: quality.sectionScores,
      coverageScores: quality.coverageScores,
      patternComplianceScores: quality.patternComplianceScores,
      warnings: quality.warnings,
      blockers: quality.blockers,
      coverageWarnings: quality.coverageWarnings,
      sectionHealth: this.educationSectionQualityClassifier.summarize(quality),
      warningCount: quality.warnings.length + quality.coverageWarnings.length,
      blockerCount: quality.blockers.length,
    };
  }

  private compareAnalyses(
    fromAnalysis: EducationRevisionAnalysis,
    toAnalysis: EducationRevisionAnalysis,
  ): EducationRevisionCompareResult {
    const blockerChanges = this.diffStrings(
      fromAnalysis.quality.blockers,
      toAnalysis.quality.blockers,
    );
    const warningChanges = this.diffStrings(
      [
        ...fromAnalysis.quality.warnings,
        ...fromAnalysis.quality.coverageWarnings.map((warning) =>
          warning.item ? `${warning.code}:${warning.item}` : warning.code,
        ),
      ],
      [
        ...toAnalysis.quality.warnings,
        ...toAnalysis.quality.coverageWarnings.map((warning) =>
          warning.item ? `${warning.code}:${warning.item}` : warning.code,
        ),
      ],
    );
    const sectionChanges = this.compareSectionScores(
      fromAnalysis.quality.sectionScores,
      toAnalysis.quality.sectionScores,
    );
    const improvements = [
      ...blockerChanges.removed.map((blocker) => `Blocker removed: ${blocker}`),
      ...sectionChanges
        .filter((change) => change.direction === 'improved')
        .map((change) => `${change.section} improved`),
    ];
    const regressions = [
      ...blockerChanges.added.map((blocker) => `Blocker added: ${blocker}`),
      ...sectionChanges
        .filter((change) => change.direction === 'regressed')
        .map((change) => `${change.section} regressed`),
    ];

    return {
      fromVersion: fromAnalysis.version,
      toVersion: toAnalysis.version,
      blockerChanges,
      warningChanges,
      sectionChanges,
      changedSections: toAnalysis.changedSections ?? [],
      overallDelta: this.round(
        toAnalysis.quality.overallScore - fromAnalysis.quality.overallScore,
      ),
      graphReadinessDelta: this.round(
        toAnalysis.quality.graphReadiness - fromAnalysis.quality.graphReadiness,
      ),
      summary: {
        improvements,
        regressions,
      },
    };
  }

  private compareSectionScores(
    fromScores: Record<string, number>,
    toScores: Record<string, number>,
  ): EducationRevisionCompareResult['sectionChanges'] {
    const sections = [...new Set([...Object.keys(fromScores), ...Object.keys(toScores)])];

    return sections.sort().map((section) => {
      const fromScore = fromScores[section] ?? null;
      const toScore = toScores[section] ?? null;
      const delta =
        fromScore === null || toScore === null
          ? null
          : this.round(toScore - fromScore);
      const direction =
        delta === null || Math.abs(delta) < 0.05
          ? 'unchanged'
          : delta > 0
            ? 'improved'
            : 'regressed';

      return { section, fromScore, toScore, delta, direction };
    });
  }

  private diffStrings(fromValues: string[], toValues: string[]) {
    const from = new Set(fromValues);
    const to = new Set(toValues);

    return {
      added: [...to].filter((value) => !from.has(value)).sort(),
      removed: [...from].filter((value) => !to.has(value)).sort(),
      unchanged: [...to].filter((value) => from.has(value)).sort(),
    };
  }

  private changedSections(
    previousSnapshot: Prisma.JsonValue,
    nextSnapshot: Prisma.JsonValue,
  ): string[] {
    const previous = this.objectFromSnapshot(previousSnapshot);
    const next = this.objectFromSnapshot(nextSnapshot);

    return SNAPSHOT_SECTIONS.filter(
      (section) =>
        this.stableStringify(previous[section]) !==
        this.stableStringify(next[section]),
    );
  }

  private draftFromSnapshot(snapshot: Prisma.JsonValue): Record<string, unknown> {
    const source = this.objectFromSnapshot(snapshot);
    return Object.fromEntries(
      SNAPSHOT_SECTIONS.map((section) => [section, source[section] ?? null]),
    );
  }

  private objectFromSnapshot(snapshot: Prisma.JsonValue): Record<string, unknown> {
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      return snapshot as Record<string, unknown>;
    }

    return {};
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(value ?? null);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
