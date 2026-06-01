import { Injectable, Logger } from '@nestjs/common';
import {
  EditorialIntentProjectionService,
  type EditorialIntentProjection,
} from './editorial-intent-projection.service';
import {
  type DifficultyStrategy,
  type ManifestationOption,
  type TeachingUnit,
} from '../education/education-teaching-rules.service';
import { DiagnosisCurriculumProviderService } from '../education/diagnosis-curriculum-provider.service';
import {
  DiagnosisEditorialBriefService,
  type EditorialBriefContext,
} from '../education/diagnosis-editorial-brief.service';

export type GenerationPurpose = 'education' | 'case' | 'difficulty' | 'graph';

export type GenerationContext = {
  diagnosis: EditorialIntentProjection['diagnosis'];
  conciseClinicalContext: string;
  learningGoals: string[];
  mustInclude: string[];
  avoid: string[];
  mimics: Array<{
    diagnosis: string;
    whyConfused?: string;
    keySeparator?: string;
  }>;
  discriminators: Array<{
    finding: string;
    discriminatesFrom?: string;
    rationale?: string;
  }>;
  pitfalls: string[];
  investigations: string[];
  scoringSystems: string[];
  managementAnchors: string[];
  requiredTeachingUnits: TeachingUnit[];
  suggestedManifestations: ManifestationOption[];
  editorialBrief: EditorialBriefContext | null;
  difficultyStrategy: DifficultyStrategy;
  difficultyGuidance: EditorialIntentProjection['difficultyGuidance'];
  sourceSummary: {
    hasEducation: boolean;
    hasCases: boolean;
    hasRules: boolean;
    hasGraphFacts: boolean;
    hasEditorialBrief: boolean;
  };
};

@Injectable()
export class GenerationContextBuilder {
  private readonly logger = new Logger(GenerationContextBuilder.name);

  constructor(
    private readonly editorialIntentProjectionService: EditorialIntentProjectionService,
    private readonly diagnosisCurriculumProviderService: DiagnosisCurriculumProviderService = new DiagnosisCurriculumProviderService(),
    private readonly diagnosisEditorialBriefService?: DiagnosisEditorialBriefService,
  ) {}

  async build(input: {
    diagnosisRegistryId: string;
    purpose: GenerationPurpose;
  }): Promise<GenerationContext> {
    const projection = await this.editorialIntentProjectionService.build(
      input.diagnosisRegistryId,
    );
    const teachingRules = await this.diagnosisCurriculumProviderService.getRules(
      projection.diagnosis,
    );
    const editorialBrief =
      await this.diagnosisEditorialBriefService?.getApprovedBriefContext(
        input.diagnosisRegistryId,
      ) ?? null;
    const difficultyStrategy = this.buildDifficultyStrategy({
      projection,
      rules: teachingRules,
      purpose: input.purpose,
      editorialBrief,
    });
    const requiredTeachingUnits = this.limit(
      (teachingRules?.teachingUnits ?? []).filter((unit) =>
        input.purpose === 'case'
          ? unit.appliesToCaseGeneration
          : unit.appliesToEducation,
      ),
      input.purpose === 'case' ? 8 : 16,
    );

    const context: GenerationContext = {
      diagnosis: projection.diagnosis,
      conciseClinicalContext: this.buildClinicalContext(projection),
      learningGoals: this.limit(
        [
          ...(editorialBrief?.learningGoals ?? []),
          ...projection.learningGoals,
        ],
        8,
      ),
      mustInclude: this.limit(
        [
          ...projection.requiredSigns,
          ...projection.requiredSymptoms,
          ...projection.requiredFindings,
        ],
        input.purpose === 'case' ? 12 : 16,
      ),
      avoid: this.limit(
        [
          ...projection.difficultyGuidance.forbiddenEarlyClues,
          ...projection.pitfallsToTeach.filter((item) =>
            /\b(?:generic|avoid|do not|don't|trap)\b/i.test(item),
          ),
        ],
        8,
      ),
      mimics: this.buildMimics(projection),
      discriminators: this.limit(
        projection.keyDiscriminators.map((item) => ({
          finding: item.finding,
          discriminatesFrom: item.targetDiagnosis,
          rationale: item.rationale,
        })),
        10,
      ),
      pitfalls: this.limit(projection.pitfallsToTeach, 10),
      investigations: this.limit(projection.requiredInvestigations, 10),
      scoringSystems: this.limit(projection.requiredScoringSystems, 6),
      managementAnchors: this.limit(projection.managementAnchors, 8),
      requiredTeachingUnits,
      editorialBrief,
      suggestedManifestations: this.limit(
        this.diagnosisCurriculumProviderService.getManifestationOptions({
          ...(teachingRules ?? {
            diagnosisKey: '',
            teachingUnits: [],
            difficultyStrategy,
            requiredDifferentials: [],
            requiredPitfalls: [],
            requiredFindings: [],
            requiredInvestigations: [],
            requiredExamMechanisms: [],
            requiredManagementAnchors: [],
            requiredRecallConcepts: [],
          }),
          teachingUnits: requiredTeachingUnits,
        }),
        input.purpose === 'case' ? 24 : 48,
      ),
      difficultyStrategy,
      difficultyGuidance: {
        ...projection.difficultyGuidance,
        forbiddenEarlyClues: this.limit(
          [
            ...projection.difficultyGuidance.forbiddenEarlyClues,
            ...this.guidanceItems(editorialBrief?.difficultyGuidance).filter(
              (item) => /\b(?:avoid|early|reveal)\b/i.test(item),
            ),
          ],
          8,
        ),
        keepAliveDifferentials: this.limit(
          [
            ...projection.difficultyGuidance.keepAliveDifferentials,
            ...(editorialBrief?.requiredMimicIds ?? []),
          ],
          8,
        ),
      },
      sourceSummary: {
        hasEducation: projection.completeness.hasEducation,
        hasCases: projection.completeness.hasCases,
        hasRules: projection.completeness.hasRules,
        hasGraphFacts: projection.completeness.hasGraphFacts,
        hasEditorialBrief: Boolean(editorialBrief),
      },
    };

    this.logger.debug(
      JSON.stringify({
        event: 'generation_context.built',
        diagnosisRegistryId: input.diagnosisRegistryId,
        purpose: input.purpose,
        contextChars: JSON.stringify(context).length,
      }),
    );

    return context;
  }

  private buildDifficultyStrategy(input: {
    projection: EditorialIntentProjection;
    rules: Awaited<ReturnType<DiagnosisCurriculumProviderService['getRules']>>;
    purpose: GenerationPurpose;
    editorialBrief: EditorialBriefContext | null;
  }): DifficultyStrategy {
    const targetDifficulty = this.normalizeDifficulty(
      input.projection.difficultyGuidance.targetDifficulty ??
        input.projection.diagnosis.difficultyBand ??
        input.rules?.difficultyStrategy.targetDifficulty ??
        null,
    );
    const revealCoreUnitByClue =
      input.purpose === 'case'
        ? targetDifficulty === 'hard'
          ? 4
          : targetDifficulty === 'easy'
            ? 2
            : 3
        : input.rules?.difficultyStrategy.revealCoreUnitByClue;

    return {
      targetDifficulty,
      ...(revealCoreUnitByClue ? { revealCoreUnitByClue } : {}),
      avoidTooEarly: this.limit(
        [
          ...(input.rules?.difficultyStrategy.avoidTooEarly ?? []),
          ...input.projection.difficultyGuidance.forbiddenEarlyClues,
          ...this.guidanceItems(input.editorialBrief?.difficultyGuidance).filter(
            (item) => /\b(?:avoid|early|reveal)\b/i.test(item),
          ),
        ],
        12,
      ),
      allowAlternativeManifestations:
        input.rules?.difficultyStrategy.allowAlternativeManifestations ?? true,
    };
  }

  private buildClinicalContext(
    projection: EditorialIntentProjection,
  ): string {
    const parts = [
      projection.diagnosis.displayLabel,
      projection.diagnosis.specialty,
      projection.diagnosis.category,
      projection.diagnosis.bodySystem,
      projection.diagnosis.clinicalSetting,
      projection.diagnosis.difficultyBand
        ? `baseline ${projection.diagnosis.difficultyBand}`
        : null,
    ].filter((item): item is string => Boolean(item));

    const goals = projection.learningGoals.slice(0, 2).join(' ');
    return this.compact([parts.join(' | '), goals].filter(Boolean).join('. '), 500);
  }

  private buildMimics(
    projection: EditorialIntentProjection,
  ): GenerationContext['mimics'] {
    return this.limit(projection.requiredMimics, 8).map((diagnosis) => {
      const discriminator = projection.keyDiscriminators.find(
        (item) =>
          item.targetDiagnosis &&
          this.normalize(item.targetDiagnosis) === this.normalize(diagnosis),
      );

      return {
        diagnosis,
        ...(discriminator?.rationale
          ? { whyConfused: this.compact(discriminator.rationale, 220) }
          : {}),
        ...(discriminator?.finding
          ? { keySeparator: this.compact(discriminator.finding, 220) }
          : {}),
      };
    });
  }

  private limit<T>(values: T[], count: number): T[] {
    return values.slice(0, count);
  }

  private guidanceItems(values: string[] | null | undefined): string[] {
    return values ?? [];
  }

  private compact(value: string, maxLength: number): string {
    const compacted = value.replace(/\s+/g, ' ').trim();
    return compacted.length > maxLength
      ? `${compacted.slice(0, maxLength - 1).trim()}...`
      : compacted;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeDifficulty(
    value: string | null | undefined,
  ): DifficultyStrategy['targetDifficulty'] {
    const normalized = this.normalize(value ?? '');
    if (normalized.includes('hard') || normalized.includes('advanced')) {
      return 'hard';
    }
    if (normalized.includes('easy') || normalized.includes('basic')) {
      return 'easy';
    }
    return 'medium';
  }
}
