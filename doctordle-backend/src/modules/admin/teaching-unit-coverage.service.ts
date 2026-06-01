import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphFactStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { DiagnosisCurriculumProviderService } from '../education/diagnosis-curriculum-provider.service';
import type { TeachingUnit } from '../education/education-teaching-rules.service';

type CoverageStatus = 'covered' | 'partial' | 'missing' | 'unknown';

export type TeachingUnitCoverageMap = {
  diagnosisRegistryId: string;
  diagnosisName: string;
  teachingUnits: Array<{
    id: string;
    title: string;
    source: string;
    status: CoverageStatus;
    educationCoverage: CoverageStatus;
    caseCoverage: {
      count: number;
      status: CoverageStatus;
    };
    graphCoverage: CoverageStatus;
    relatedSections: string[];
    relatedCaseIds: string[];
    relatedGraphFactIds: string[];
    warnings: string[];
    recommendedAction: string;
  }>;
};

type CaseRecord = {
  id: string;
  explanation: Prisma.JsonValue | null;
};

@Injectable()
export class TeachingUnitCoverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisCurriculumProviderService: DiagnosisCurriculumProviderService,
  ) {}

  async getCoverage(
    diagnosisRegistryId: string,
  ): Promise<TeachingUnitCoverageMap> {
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
          select: { term: true },
        },
        education: {
          select: {
            editorialStatus: true,
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
          },
        },
        cases: {
          select: {
            id: true,
            explanation: true,
          },
        },
        graphCandidates: {
          select: {
            id: true,
            rawText: true,
            normalizedText: true,
            status: true,
            payload: true,
          },
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          select: {
            id: true,
            label: true,
            normalizedLabel: true,
            payload: true,
          },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const rules = await this.diagnosisCurriculumProviderService.getRules(registry);
    const units = rules?.teachingUnits ?? [];
    const educationSections = registry.education
      ? this.educationSections(registry.education)
      : new Map<string, string>();
    const educationText = [...educationSections.values()].join(' ');
    const caseCoverage = this.caseCoverageByUnit(registry.cases);
    const graphTextById = new Map<string, string>();

    for (const fact of registry.graphFacts) {
      graphTextById.set(
        fact.id,
        [fact.label, fact.normalizedLabel, this.textFrom(fact.payload)].join(' '),
      );
    }
    for (const candidate of registry.graphCandidates.filter((candidate) =>
      this.isReviewableCandidateStatus(candidate.status),
    )) {
      graphTextById.set(
        candidate.id,
        [
          candidate.rawText,
          candidate.normalizedText,
          this.textFrom(candidate.payload),
        ].join(' '),
      );
    }

    return {
      diagnosisRegistryId: registry.id,
      diagnosisName: registry.displayLabel || registry.canonicalName,
      teachingUnits: units.map((unit) =>
        this.coverageForUnit({
          unit,
          hasEducation: Boolean(registry.education),
          educationStatus: registry.education?.editorialStatus ?? null,
          educationText,
          educationSections,
          caseCoverage: caseCoverage.get(unit.id) ?? new Set<string>(),
          graphTextById,
        }),
      ),
    };
  }

  private coverageForUnit(input: {
    unit: TeachingUnit;
    hasEducation: boolean;
    educationStatus: DiagnosisEducationStatus | null;
    educationText: string;
    educationSections: Map<string, string>;
    caseCoverage: Set<string>;
    graphTextById: Map<string, string>;
  }): TeachingUnitCoverageMap['teachingUnits'][number] {
    const phrases = this.unitPhrases(input.unit);
    const educationMatched = input.hasEducation
      ? this.matchesAny(input.educationText, phrases)
      : false;
    const relatedSections = input.hasEducation
      ? this.relatedEducationSections(input.educationSections, phrases)
      : [];
    const relatedGraphFactIds = [...input.graphTextById.entries()]
      .filter(([, text]) => this.matchesAny(text, phrases))
      .map(([id]) => id);
    const educationCoverage: CoverageStatus = !input.hasEducation
      ? 'unknown'
      : educationMatched
        ? input.educationStatus === DiagnosisEducationStatus.PUBLISHED ||
          input.educationStatus === DiagnosisEducationStatus.APPROVED
          ? 'covered'
          : 'partial'
        : 'missing';
    const caseStatus: CoverageStatus =
      input.caseCoverage.size > 0
        ? 'covered'
        : input.unit.appliesToCaseGeneration
          ? 'missing'
          : 'unknown';
    const graphCoverage: CoverageStatus = relatedGraphFactIds.length
      ? 'covered'
      : input.graphTextById.size
        ? 'missing'
        : 'unknown';
    const status = this.overallCoverage(
      educationCoverage,
      caseStatus,
      graphCoverage,
    );
    const warnings = this.warnings({
      educationCoverage,
      caseStatus,
      graphCoverage,
    });

    return {
      id: input.unit.id,
      title: input.unit.label,
      source:
        input.unit.source ??
        'teaching_rules',
      status,
      educationCoverage,
      caseCoverage: {
        count: input.caseCoverage.size,
        status: caseStatus,
      },
      graphCoverage,
      relatedSections,
      relatedCaseIds: [...input.caseCoverage],
      relatedGraphFactIds,
      warnings,
      recommendedAction: this.recommendedAction({
        educationCoverage,
        caseStatus,
        graphCoverage,
      }),
    };
  }

  private caseCoverageByUnit(cases: CaseRecord[]): Map<string, Set<string>> {
    const coverage = new Map<string, Set<string>>();

    for (const caseRecord of cases) {
      const quality = this.asObject(this.asObject(caseRecord.explanation)?.generationQuality);
      const alignment = this.asObject(quality?.teachingAlignment);
      const selectedUnits = Array.isArray(alignment?.selectedUnits)
        ? alignment.selectedUnits
        : [];

      for (const selectedUnit of selectedUnits) {
        const unit = this.asObject(selectedUnit);
        if (!unit || typeof unit.id !== 'string' || unit.covered !== true) {
          continue;
        }

        const caseIds = coverage.get(unit.id) ?? new Set<string>();
        caseIds.add(caseRecord.id);
        coverage.set(unit.id, caseIds);
      }
    }

    return coverage;
  }

  private relatedEducationSections(
    educationSections: Map<string, string>,
    phrases: string[],
  ): string[] {
    return [...educationSections.entries()]
      .filter(([, text]) => this.matchesAny(text, phrases))
      .map(([section]) => section);
  }

  private educationSections(
    education: Record<string, unknown>,
  ): Map<string, string> {
    return new Map(
      [
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
      ].map((section) => [section, this.textFrom(education[section])]),
    );
  }

  private unitPhrases(unit: TeachingUnit): string[] {
    return [unit.id, unit.label, ...unit.acceptableManifestations];
  }

  private matchesAny(text: string, phrases: string[]): boolean {
    const normalizedText = this.normalize(text);
    return phrases.some((phrase) => {
      const normalizedPhrase = this.normalize(phrase);
      return (
        normalizedPhrase.length > 0 &&
        (normalizedText.includes(normalizedPhrase) ||
          this.tokenOverlap(normalizedText, normalizedPhrase) >= 0.65)
      );
    });
  }

  private tokenOverlap(text: string, phrase: string): number {
    const textTokens = new Set(text.split(' ').filter((token) => token.length >= 3));
    const phraseTokens = phrase.split(' ').filter((token) => token.length >= 3);
    if (!phraseTokens.length) {
      return 0;
    }
    return (
      phraseTokens.filter((token) => textTokens.has(token)).length /
      phraseTokens.length
    );
  }

  private overallCoverage(...statuses: CoverageStatus[]): CoverageStatus {
    if (statuses.every((status) => status === 'covered' || status === 'unknown')) {
      return statuses.some((status) => status === 'covered') ? 'covered' : 'unknown';
    }
    if (statuses.some((status) => status === 'covered' || status === 'partial')) {
      return 'partial';
    }
    if (statuses.every((status) => status === 'unknown')) {
      return 'unknown';
    }
    return 'missing';
  }

  private warnings(input: {
    educationCoverage: CoverageStatus;
    caseStatus: CoverageStatus;
    graphCoverage: CoverageStatus;
  }): string[] {
    return [
      ...(input.educationCoverage === 'missing'
        ? ['missing_education_coverage']
        : []),
      ...(input.caseStatus === 'missing' ? ['missing_case_coverage'] : []),
      ...(input.graphCoverage === 'missing' ? ['missing_graph_coverage'] : []),
    ];
  }

  private recommendedAction(input: {
    educationCoverage: CoverageStatus;
    caseStatus: CoverageStatus;
    graphCoverage: CoverageStatus;
  }): string {
    if (input.educationCoverage === 'missing') {
      return 'Add education pearl';
    }
    if (input.caseStatus === 'missing') {
      return 'Generate aligned case';
    }
    if (input.graphCoverage === 'missing') {
      return 'Review graph discriminator';
    }
    if (
      input.educationCoverage === 'partial' ||
      input.caseStatus === 'partial' ||
      input.graphCoverage === 'partial'
    ) {
      return 'Review partial coverage';
    }
    return 'Ready';
  }

  private isReviewableCandidateStatus(
    status: DiagnosisGraphCandidateStatus,
  ): boolean {
    return (
      status === DiagnosisGraphCandidateStatus.CANDIDATE ||
      status === DiagnosisGraphCandidateStatus.APPROVED
    );
  }

  private textFrom(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.textFrom(item)).join(' ');
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value)
        .map((item) => this.textFrom(item))
        .join(' ');
    }
    return '';
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
