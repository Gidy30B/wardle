import { Injectable, Logger } from '@nestjs/common';
import {
  EditorialIntentProjectionService,
  type EditorialIntentProjection,
} from './editorial-intent-projection.service';

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
  difficultyGuidance: EditorialIntentProjection['difficultyGuidance'];
  sourceSummary: {
    hasEducation: boolean;
    hasCases: boolean;
    hasRules: boolean;
    hasGraphFacts: boolean;
  };
};

@Injectable()
export class GenerationContextBuilder {
  private readonly logger = new Logger(GenerationContextBuilder.name);

  constructor(
    private readonly editorialIntentProjectionService: EditorialIntentProjectionService,
  ) {}

  async build(input: {
    diagnosisRegistryId: string;
    purpose: GenerationPurpose;
  }): Promise<GenerationContext> {
    const projection = await this.editorialIntentProjectionService.build(
      input.diagnosisRegistryId,
    );

    const context: GenerationContext = {
      diagnosis: projection.diagnosis,
      conciseClinicalContext: this.buildClinicalContext(projection),
      learningGoals: this.limit(projection.learningGoals, 6),
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
      difficultyGuidance: {
        ...projection.difficultyGuidance,
        forbiddenEarlyClues: this.limit(
          projection.difficultyGuidance.forbiddenEarlyClues,
          8,
        ),
        keepAliveDifferentials: this.limit(
          projection.difficultyGuidance.keepAliveDifferentials,
          8,
        ),
      },
      sourceSummary: {
        hasEducation: projection.completeness.hasEducation,
        hasCases: projection.completeness.hasCases,
        hasRules: projection.completeness.hasRules,
        hasGraphFacts: projection.completeness.hasGraphFacts,
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
}
