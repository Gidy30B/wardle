import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  EducationKnowledgeRulesService,
  type EducationRuleRegistryMetadata,
} from '../education/education-knowledge-rules.service';

export type EditorialIntentProvenance = {
  sourceType: 'registry' | 'rules' | 'education' | 'case' | 'graph';
  sourceId?: string;
  sourcePath?: string;
  label: string;
};

export type EditorialIntentProjection = {
  diagnosis: {
    id: string;
    displayLabel: string;
    canonicalName?: string | null;
    specialty?: string | null;
    category?: string | null;
    bodySystem?: string | null;
    clinicalSetting?: string | null;
    difficultyBand?: string | null;
    aliases: string[];
  };
  learningGoals: string[];
  requiredFindings: string[];
  requiredSigns: string[];
  requiredSymptoms: string[];
  requiredInvestigations: string[];
  requiredScoringSystems: string[];
  requiredMimics: string[];
  keyDiscriminators: Array<{
    finding: string;
    targetDiagnosis?: string;
    rationale?: string;
    source: string;
  }>;
  pitfallsToTeach: string[];
  managementAnchors: string[];
  editorPearls: string[];
  difficultyGuidance: {
    baselineDifficulty?: string | null;
    targetDifficulty?: string | null;
    targetSolveClue?: number | null;
    forbiddenEarlyClues: string[];
    keepAliveDifferentials: string[];
  };
  provenance: EditorialIntentProvenance[];
  completeness: {
    hasRules: boolean;
    hasEducation: boolean;
    hasCases: boolean;
    hasGraphFacts: boolean;
    missing: string[];
  };
};

type ConceptBucket =
  | 'learningGoals'
  | 'requiredFindings'
  | 'requiredSigns'
  | 'requiredSymptoms'
  | 'requiredInvestigations'
  | 'requiredScoringSystems'
  | 'requiredMimics'
  | 'pitfallsToTeach'
  | 'managementAnchors'
  | 'editorPearls';

type MutableProjection = Omit<
  EditorialIntentProjection,
  | ConceptBucket
  | 'keyDiscriminators'
  | 'provenance'
  | 'difficultyGuidance'
> &
  Record<ConceptBucket, string[]> & {
    keyDiscriminators: EditorialIntentProjection['keyDiscriminators'];
    difficultyGuidance: EditorialIntentProjection['difficultyGuidance'];
    provenance: EditorialIntentProvenance[];
  };

const REVIEWED_CASE_STATUSES = [
  CaseEditorialStatus.APPROVED,
  CaseEditorialStatus.READY_TO_PUBLISH,
  CaseEditorialStatus.PUBLISHED,
] as const;

@Injectable()
export class EditorialIntentProjectionService {
  private readonly educationKnowledgeRulesService =
    new EducationKnowledgeRulesService();

  constructor(private readonly prisma: PrismaService) {}

  async build(
    diagnosisRegistryId: string,
  ): Promise<EditorialIntentProjection> {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      include: {
        aliases: {
          where: { active: true },
          select: { id: true, term: true },
          orderBy: [{ acceptedForMatch: 'desc' }, { rank: 'asc' }],
          take: 20,
        },
        education: true,
        cases: {
          where: { editorialStatus: { in: [...REVIEWED_CASE_STATUSES] } },
          select: {
            id: true,
            title: true,
            difficulty: true,
            clues: true,
            differentials: true,
            explanation: true,
            editorialStatus: true,
          },
          orderBy: [{ publishedAt: 'desc' }, { approvedAt: 'desc' }],
          take: 5,
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          select: {
            id: true,
            type: true,
            label: true,
            payload: true,
            targetDiagnosisRegistryId: true,
            targetDiagnosisRegistry: {
              select: { displayLabel: true, canonicalName: true },
            },
          },
          take: 50,
        },
        graphCandidates: {
          where: { status: DiagnosisGraphCandidateStatus.APPROVED },
          select: {
            id: true,
            type: true,
            rawText: true,
            normalizedText: true,
            payload: true,
            sourcePath: true,
            targetDiagnosisRegistryId: true,
            targetDiagnosisRegistry: {
              select: { displayLabel: true, canonicalName: true },
            },
          },
          take: 50,
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const rules = this.educationKnowledgeRulesService.getGuidance(
      registry as EducationRuleRegistryMetadata,
    );
    const cases = registry.cases ?? [];
    const graphFacts = registry.graphFacts ?? [];
    const graphCandidates = registry.graphCandidates ?? [];
    const hasPublishedEducation =
      registry.education?.editorialStatus === DiagnosisEducationStatus.PUBLISHED;
    const hasCases = cases.length > 0;
    const hasGraphFacts = graphFacts.length > 0 || graphCandidates.length > 0;

    const projection: MutableProjection = {
      diagnosis: {
        id: registry.id,
        displayLabel: registry.displayLabel,
        canonicalName: registry.canonicalName,
        specialty: registry.specialty,
        category: registry.category,
        bodySystem: registry.bodySystem,
        clinicalSetting: registry.clinicalSetting,
        difficultyBand: registry.difficultyBand,
        aliases: (registry.aliases ?? [])
          .map((alias) => alias.term)
          .filter((term): term is string => Boolean(term?.trim())),
      },
      learningGoals: [],
      requiredFindings: [],
      requiredSigns: [],
      requiredSymptoms: [],
      requiredInvestigations: [],
      requiredScoringSystems: [],
      requiredMimics: [],
      keyDiscriminators: [],
      pitfallsToTeach: [],
      managementAnchors: [],
      editorPearls: [],
      difficultyGuidance: {
        baselineDifficulty: registry.difficultyBand,
        targetDifficulty: null,
        targetSolveClue: null,
        forbiddenEarlyClues: [],
        keepAliveDifferentials: [],
      },
      provenance: [],
      completeness: {
        hasRules: Boolean(rules),
        hasEducation: hasPublishedEducation,
        hasCases,
        hasGraphFacts,
        missing: [],
      },
    };

    this.addRegistryMetadata(projection, registry);
    if (hasPublishedEducation && registry.education) {
      this.addEducation(projection, registry.education);
    }
    this.addCases(projection, cases);
    if (rules) {
      this.addRules(projection, rules);
    }
    this.addGraph(projection, graphFacts, graphCandidates);

    projection.completeness.missing = this.getMissingSources(
      projection.completeness,
    );

    return projection;
  }

  private addRegistryMetadata(
    projection: MutableProjection,
    registry: {
      id: string;
      difficultyBand?: string | null;
      preferredClueTypes?: Prisma.JsonValue | null;
      excludedClueTypes?: Prisma.JsonValue | null;
      notes?: string | null;
    },
  ) {
    this.addConcept(projection, 'learningGoals', registry.notes, {
      sourceType: 'registry',
      sourceId: registry.id,
      sourcePath: 'notes',
      label: 'Registry notes',
    });
    for (const value of this.jsonStringArray(registry.excludedClueTypes)) {
      this.addConcept(projection, 'pitfallsToTeach', value, {
        sourceType: 'registry',
        sourceId: registry.id,
        sourcePath: 'excludedClueTypes',
        label: value,
      });
      this.addUnique(
        projection.difficultyGuidance.forbiddenEarlyClues,
        value,
      );
    }
    for (const value of this.jsonStringArray(registry.preferredClueTypes)) {
      this.addConcept(projection, 'editorPearls', value, {
        sourceType: 'registry',
        sourceId: registry.id,
        sourcePath: 'preferredClueTypes',
        label: value,
      });
    }
  }

  private addRules(
    projection: MutableProjection,
    rules: NonNullable<
      ReturnType<EducationKnowledgeRulesService['getGuidance']>
    >,
  ) {
    for (const sign of rules.expectedNamedSigns) {
      this.addConcept(projection, 'requiredSigns', sign, {
        sourceType: 'rules',
        sourcePath: 'expectedNamedSigns',
        label: sign,
      });
    }
    for (const score of rules.expectedScoringSystems) {
      this.addConcept(projection, 'requiredScoringSystems', score, {
        sourceType: 'rules',
        sourcePath: 'expectedScoringSystems',
        label: score,
      });
    }
    for (const investigation of rules.expectedInvestigations) {
      this.addConcept(projection, 'requiredInvestigations', investigation, {
        sourceType: 'rules',
        sourcePath: 'expectedInvestigations',
        label: investigation,
      });
    }
    for (const mimic of rules.expectedMimics) {
      this.addConcept(projection, 'requiredMimics', mimic, {
        sourceType: 'rules',
        sourcePath: 'expectedMimics',
        label: mimic,
      });
      this.addUnique(
        projection.difficultyGuidance.keepAliveDifferentials,
        mimic,
      );
    }
    for (const pitfall of rules.expectedPitfalls) {
      this.addConcept(projection, 'pitfallsToTeach', pitfall, {
        sourceType: 'rules',
        sourcePath: 'expectedPitfalls',
        label: pitfall,
      });
    }
    for (const anchor of rules.expectedManagementAnchors) {
      this.addConcept(projection, 'managementAnchors', anchor, {
        sourceType: 'rules',
        sourcePath: 'expectedManagementAnchors',
        label: anchor,
      });
    }
    for (const guidance of rules.atomicityGuidance) {
      this.addConcept(projection, 'editorPearls', guidance, {
        sourceType: 'rules',
        sourcePath: 'atomicityGuidance',
        label: guidance,
      });
    }
  }

  private addEducation(
    projection: MutableProjection,
    education: {
      id: string;
      summary: Prisma.JsonValue;
      clinicalPattern?: Prisma.JsonValue | null;
      keySymptoms?: Prisma.JsonValue | null;
      keySigns?: Prisma.JsonValue | null;
      examPearls?: Prisma.JsonValue | null;
      scoringSystems?: Prisma.JsonValue | null;
      investigations?: Prisma.JsonValue | null;
      differentials?: Prisma.JsonValue | null;
      management?: Prisma.JsonValue | null;
      pitfalls?: Prisma.JsonValue | null;
      recallPrompts?: Prisma.JsonValue | null;
    },
  ) {
    for (const value of this.extractConcepts(education.summary)) {
      this.addConcept(projection, 'learningGoals', value, {
        sourceType: 'education',
        sourceId: education.id,
        sourcePath: 'summary',
        label: value,
      });
    }
    this.addEducationField(
      projection,
      education.id,
      'clinicalPattern',
      education.clinicalPattern,
      'editorPearls',
    );
    this.addEducationField(
      projection,
      education.id,
      'keySymptoms',
      education.keySymptoms,
      'requiredSymptoms',
    );
    this.addEducationField(
      projection,
      education.id,
      'keySigns',
      education.keySigns,
      'requiredSigns',
    );
    this.addEducationField(
      projection,
      education.id,
      'examPearls',
      education.examPearls,
      'requiredFindings',
    );
    this.addEducationField(
      projection,
      education.id,
      'scoringSystems',
      education.scoringSystems,
      'requiredScoringSystems',
    );
    this.addEducationField(
      projection,
      education.id,
      'investigations',
      education.investigations,
      'requiredInvestigations',
    );
    this.addEducationField(
      projection,
      education.id,
      'differentials',
      education.differentials,
      'requiredMimics',
    );
    this.addEducationField(
      projection,
      education.id,
      'management',
      education.management,
      'managementAnchors',
    );
    this.addEducationField(
      projection,
      education.id,
      'pitfalls',
      education.pitfalls,
      'pitfallsToTeach',
    );
    this.addEducationField(
      projection,
      education.id,
      'recallPrompts',
      education.recallPrompts,
      'learningGoals',
    );

    for (const discriminator of this.extractDiscriminators(
      education.differentials,
      'education',
    )) {
      this.addDiscriminator(projection, discriminator);
    }
  }

  private addEducationField(
    projection: MutableProjection,
    sourceId: string,
    sourcePath: string,
    value: Prisma.JsonValue | null | undefined,
    bucket: ConceptBucket,
  ) {
    for (const concept of this.extractConcepts(value)) {
      this.addConcept(projection, bucket, concept, {
        sourceType: 'education',
        sourceId,
        sourcePath,
        label: concept,
      });
    }
  }

  private addCases(
    projection: MutableProjection,
    cases: Array<{
      id: string;
      difficulty?: string | null;
      clues: Prisma.JsonValue;
      differentials: Prisma.JsonValue;
      explanation: Prisma.JsonValue;
    }>,
  ) {
    for (const caseRecord of cases) {
      if (!projection.difficultyGuidance.targetDifficulty) {
        projection.difficultyGuidance.targetDifficulty =
          caseRecord.difficulty ?? null;
      }

      for (const clue of this.extractCaseClues(caseRecord.clues).slice(0, 3)) {
        this.addConcept(projection, 'requiredFindings', clue, {
          sourceType: 'case',
          sourceId: caseRecord.id,
          sourcePath: 'clues',
          label: clue,
        });
      }
      for (const mimic of this.extractConcepts(caseRecord.differentials)) {
        this.addConcept(projection, 'requiredMimics', mimic, {
          sourceType: 'case',
          sourceId: caseRecord.id,
          sourcePath: 'differentials',
          label: mimic,
        });
        this.addUnique(
          projection.difficultyGuidance.keepAliveDifferentials,
          mimic,
        );
      }
      const explanation = this.asRecord(caseRecord.explanation);
      for (const finding of this.extractConcepts(explanation?.keyFindings)) {
        this.addConcept(projection, 'requiredFindings', finding, {
          sourceType: 'case',
          sourceId: caseRecord.id,
          sourcePath: 'explanation.keyFindings',
          label: finding,
        });
      }
      for (const discriminator of this.extractCaseDifferentialAnalysis(
        explanation?.differentialAnalysis,
        caseRecord.id,
      )) {
        this.addDiscriminator(projection, discriminator);
      }
    }
  }

  private addGraph(
    projection: MutableProjection,
    facts: Array<{
      id: string;
      type: DiagnosisGraphCandidateType;
      label: string;
      payload?: Prisma.JsonValue | null;
      targetDiagnosisRegistry?: {
        displayLabel: string;
        canonicalName: string;
      } | null;
    }>,
    candidates: Array<{
      id: string;
      type: DiagnosisGraphCandidateType;
      rawText: string;
      normalizedText: string;
      payload?: Prisma.JsonValue | null;
      sourcePath: string;
      targetDiagnosisRegistry?: {
        displayLabel: string;
        canonicalName: string;
      } | null;
    }>,
  ) {
    for (const fact of facts) {
      this.addGraphConcept(projection, {
        sourceId: fact.id,
        sourcePath: 'fact',
        type: fact.type,
        label: fact.label,
        targetDiagnosis: fact.targetDiagnosisRegistry?.displayLabel,
      });
    }
    for (const candidate of candidates) {
      this.addGraphConcept(projection, {
        sourceId: candidate.id,
        sourcePath: candidate.sourcePath,
        type: candidate.type,
        label: candidate.rawText || candidate.normalizedText,
        targetDiagnosis: candidate.targetDiagnosisRegistry?.displayLabel,
      });
    }
  }

  private addGraphConcept(
    projection: MutableProjection,
    input: {
      sourceId: string;
      sourcePath: string;
      type: DiagnosisGraphCandidateType;
      label: string;
      targetDiagnosis?: string;
    },
  ) {
    const provenance = {
      sourceType: 'graph' as const,
      sourceId: input.sourceId,
      sourcePath: input.sourcePath,
      label: input.label,
    };
    if (input.type === DiagnosisGraphCandidateType.FINDING) {
      this.addConcept(projection, 'requiredFindings', input.label, provenance);
    } else if (input.type === DiagnosisGraphCandidateType.INVESTIGATION) {
      this.addConcept(
        projection,
        'requiredInvestigations',
        input.label,
        provenance,
      );
    } else if (input.type === DiagnosisGraphCandidateType.MIMIC) {
      this.addConcept(projection, 'requiredMimics', input.label, provenance);
    } else if (input.type === DiagnosisGraphCandidateType.PITFALL) {
      this.addConcept(projection, 'pitfallsToTeach', input.label, provenance);
    } else if (input.type === DiagnosisGraphCandidateType.MANAGEMENT) {
      this.addConcept(projection, 'managementAnchors', input.label, provenance);
    }

    if (input.type === DiagnosisGraphCandidateType.MIMIC) {
      this.addDiscriminator(projection, {
        finding: input.label,
        targetDiagnosis: input.targetDiagnosis,
        source: 'graph',
      });
    }
  }

  private extractCaseClues(value: unknown): string[] {
    return this.asArray(value)
      .map((item) => {
        const record = this.asRecord(item);
        return record ? this.cleanString(record.value) : this.cleanString(item);
      })
      .filter((item): item is string => Boolean(item));
  }

  private extractCaseDifferentialAnalysis(
    value: unknown,
    sourceId: string,
  ): EditorialIntentProjection['keyDiscriminators'] {
    return this.asArray(value).flatMap((item) => {
        const record = this.asRecord(item);
        if (!record) {
          return [];
        }
        const targetDiagnosis = this.cleanString(record.diagnosis) ?? undefined;
        const rationale =
          this.cleanString(record.finalReasonLessLikely) ??
          this.cleanString(record.whyPlausibleEarly) ??
          undefined;
        const finding =
          this.cleanString(record.finalReasonLessLikely) ??
          this.cleanString(record.whyPlausibleEarly) ??
          targetDiagnosis;

        if (!finding) {
          return [];
        }

        const discriminator: EditorialIntentProjection['keyDiscriminators'][number] =
          {
            finding,
            ...(targetDiagnosis ? { targetDiagnosis } : {}),
            ...(rationale ? { rationale } : {}),
            source: `case:${sourceId}`,
          };

        return [discriminator];
      });
  }

  private extractDiscriminators(
    value: unknown,
    source: string,
  ): EditorialIntentProjection['keyDiscriminators'] {
    return this.asArray(value)
      .map((item) => {
        const record = this.asRecord(item);
        if (!record) {
          const text = this.cleanString(item);
          return text ? { finding: text, source } : null;
        }
        const diagnosis =
          this.cleanString(record.diagnosis) ??
          this.cleanString(record.name) ??
          this.cleanString(record.title) ??
          this.cleanString(record.finding) ??
          undefined;
        const rationale =
          this.cleanString(record.discriminator) ??
          this.cleanString(record.whyItMatters) ??
          this.cleanString(record.content) ??
          this.cleanString(record.explanation) ??
          undefined;
        const finding = rationale ?? diagnosis;
        return finding
          ? {
              finding,
              targetDiagnosis: diagnosis,
              rationale,
              source,
            }
          : null;
      })
      .filter(
        (
          item,
        ): item is EditorialIntentProjection['keyDiscriminators'][number] =>
          Boolean(item),
      );
  }

  private extractConcepts(value: unknown): string[] {
    if (value === null || value === undefined) {
      return [];
    }
    if (typeof value === 'string') {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.extractConcepts(item));
    }
    const record = this.asRecord(value);
    if (!record) {
      return [];
    }

    const preferredKeys = [
      'finding',
      'label',
      'name',
      'title',
      'pattern',
      'prompt',
      'diagnosis',
      'content',
      'highYieldTakeaway',
      'definition',
      'whyItMatters',
      'explanation',
      'use',
      'caution',
    ];
    const values = preferredKeys
      .map((key) => this.cleanString(record[key]))
      .filter((item): item is string => Boolean(item));

    return values.length ? values : [];
  }

  private addDiscriminator(
    projection: MutableProjection,
    discriminator: EditorialIntentProjection['keyDiscriminators'][number],
  ) {
    const key = this.normalize([
      discriminator.finding,
      discriminator.targetDiagnosis,
    ].join(' '));
    if (!key) {
      return;
    }
    const existing = new Set(
      projection.keyDiscriminators.map((item) =>
        this.normalize([item.finding, item.targetDiagnosis].join(' ')),
      ),
    );
    if (existing.has(key)) {
      return;
    }
    projection.keyDiscriminators.push(discriminator);
  }

  private addConcept(
    projection: MutableProjection,
    bucket: ConceptBucket,
    rawValue: unknown,
    provenance: EditorialIntentProvenance,
  ) {
    const value = this.cleanString(rawValue);
    if (!value) {
      return;
    }

    if (this.addUnique(projection[bucket], value)) {
      projection.provenance.push({
        ...provenance,
        label: provenance.label || value,
      });
    }
  }

  private addUnique(values: string[], rawValue: string): boolean {
    const value = rawValue.trim();
    const key = this.normalize(value);
    if (!key) {
      return false;
    }
    const existing = new Set(values.map((item) => this.normalize(item)));
    if (existing.has(key)) {
      return false;
    }
    values.push(value);
    return true;
  }

  private jsonStringArray(value: unknown): string[] {
    return this.asArray(value)
      .map((item) => this.cleanString(item))
      .filter((item): item is string => Boolean(item));
  }

  private getMissingSources(
    completeness: EditorialIntentProjection['completeness'],
  ): string[] {
    return [
      completeness.hasRules ? null : 'rules',
      completeness.hasEducation ? null : 'published_education',
      completeness.hasCases ? null : 'approved_or_published_cases',
      completeness.hasGraphFacts ? null : 'graph_facts',
    ].filter((item): item is string => Boolean(item));
  }

  private cleanString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed.length ? trimmed : null;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(?:the|a|an|and|or|of|to|in|with|for|is|are)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
