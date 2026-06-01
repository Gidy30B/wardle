import { Injectable } from '@nestjs/common';
import { ValidationOutcome, type Prisma } from '@prisma/client';

type QualityStatus = 'good' | 'warning' | 'blocker' | 'unknown';

type QualityDimension = {
  status: QualityStatus;
  score: number | null;
  warnings: string[];
  blockers: string[];
  summary: string;
};

export type AdminCaseQualityProjection = {
  dimensions: {
    clinicalValidity: QualityDimension;
    differentialPlausibility: QualityDimension;
    teachingAlignment: QualityDimension;
    revealTiming: QualityDimension;
    mimicPersistence: QualityDimension;
    playability: QualityDimension;
    difficultyFit: QualityDimension;
  };
  warnings: string[];
  blockers: string[];
  sourceSummary: {
    hasValidationRun: boolean;
    hasValidationFindings: boolean;
    hasGenerationQuality: boolean;
    hasTeachingAlignment: boolean;
  };
};

type ValidationIssue = {
  validator: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
};

type ValidationRunInput = {
  outcome: ValidationOutcome | null;
  summary: Prisma.JsonValue | null;
  findings?: Prisma.JsonValue | null;
} | null;

type CaseQualityInput = {
  difficulty?: string | null;
  explanation?: Prisma.JsonValue | null;
  validationRuns?: ValidationRunInput[];
};

type TeachingAlignment = {
  selectedUnits: Array<{
    id: string;
    label: string;
    importance: string;
    covered: boolean;
  }>;
  revealTiming: {
    earliestCoreRevealClue?: number;
    giveawayTooEarly: boolean;
    issues: string[];
  };
  mimicPersistence: {
    earlyMimicsPresent: string[];
    mimicsStillPlausibleUntilClue?: number;
    issues: string[];
  };
  playability: {
    score: number;
    difficultyFit: 'too_easy' | 'fits' | 'too_hard' | 'unclear';
    issues: string[];
  };
  warnings: string[];
};

type GenerationQuality = {
  critiqueScore?: number;
  critiquePassed?: boolean;
  critiqueIssues: string[];
  differentialPlausibilityScore?: number;
  clinicalEdgeValidityScore?: number;
  qualityScore?: number;
  teachingAlignment?: TeachingAlignment;
};

@Injectable()
export class CaseQualityProjectionService {
  buildProjection(input: CaseQualityInput): AdminCaseQualityProjection {
    const latestValidation = input.validationRuns?.[0] ?? null;
    const validationIssues = this.parseValidationIssues(
      latestValidation?.findings ?? null,
    );
    const generationQuality = this.parseGenerationQuality(input.explanation);
    const teachingAlignment = generationQuality?.teachingAlignment ?? null;
    const dimensions = {
      clinicalValidity: this.clinicalValidity({
        validationRun: latestValidation,
        validationIssues,
        generationQuality,
      }),
      differentialPlausibility: this.differentialPlausibility({
        validationIssues,
        generationQuality,
      }),
      teachingAlignment: this.teachingAlignment(teachingAlignment),
      revealTiming: this.revealTiming(teachingAlignment),
      mimicPersistence: this.mimicPersistence(teachingAlignment),
      playability: this.playability({
        validationRun: latestValidation,
        validationIssues,
        generationQuality,
        teachingAlignment,
      }),
      difficultyFit: this.difficultyFit({
        validationIssues,
        teachingAlignment,
      }),
    };
    const warnings = this.unique(
      Object.values(dimensions).flatMap((dimension) => dimension.warnings),
    );
    const blockers = this.unique(
      Object.values(dimensions).flatMap((dimension) => dimension.blockers),
    );

    return {
      dimensions,
      warnings,
      blockers,
      sourceSummary: {
        hasValidationRun: Boolean(latestValidation),
        hasValidationFindings: validationIssues.length > 0,
        hasGenerationQuality: Boolean(generationQuality),
        hasTeachingAlignment: Boolean(teachingAlignment),
      },
    };
  }

  private clinicalValidity(input: {
    validationRun: ValidationRunInput;
    validationIssues: ValidationIssue[];
    generationQuality: GenerationQuality | null;
  }): QualityDimension {
    if (!input.validationRun && !input.generationQuality) {
      return this.unknown('No validation or generation quality data yet.');
    }

    const relevantIssues = input.validationIssues.filter((issue) =>
      ['structure', 'clue', 'explanation'].includes(issue.validator),
    );
    const blockers = this.issueCodes(relevantIssues, 'error');
    const warnings = [
      ...this.issueCodes(relevantIssues, 'warning'),
      ...(input.generationQuality?.critiquePassed === false
        ? input.generationQuality.critiqueIssues
        : []),
    ];
    const score =
      input.generationQuality?.clinicalEdgeValidityScore ??
      input.generationQuality?.critiqueScore ??
      null;

    if (blockers.length || input.validationRun?.outcome === ValidationOutcome.FAILED) {
      return this.dimension({
        status: 'blocker',
        score,
        blockers,
        warnings,
        summary: 'Clinical structure or reasoning validation failed.',
      });
    }

    if (warnings.length || input.validationRun?.outcome === ValidationOutcome.ERROR) {
      return this.dimension({
        status: 'warning',
        score,
        warnings,
        summary: 'Clinically usable, but validation raised concerns.',
      });
    }

    return this.dimension({
      status: 'good',
      score,
      summary: 'Clinical validation signals are acceptable.',
    });
  }

  private differentialPlausibility(input: {
    validationIssues: ValidationIssue[];
    generationQuality: GenerationQuality | null;
  }): QualityDimension {
    const differentialIssues = input.validationIssues.filter(
      (issue) => issue.validator === 'differential',
    );
    const blockers = this.issueCodes(differentialIssues, 'error');
    const warnings = this.issueCodes(differentialIssues, 'warning');
    const score = input.generationQuality?.differentialPlausibilityScore ?? null;

    if (blockers.length) {
      return this.dimension({
        status: 'blocker',
        score,
        blockers,
        warnings,
        summary: 'Differentials are missing, duplicated, or structurally weak.',
      });
    }

    if (warnings.length || (typeof score === 'number' && score < 0.7)) {
      return this.dimension({
        status: 'warning',
        score,
        warnings:
          warnings.length || typeof score !== 'number'
            ? warnings
            : ['low_differential_plausibility_score'],
        summary: 'Differentials may not stay plausible enough.',
      });
    }

    if (typeof score !== 'number' && differentialIssues.length === 0) {
      return this.unknown('No differential quality score is available yet.');
    }

    return this.dimension({
      status: 'good',
      score,
      summary: 'Differential plausibility signals are acceptable.',
    });
  }

  private teachingAlignment(
    teachingAlignment: TeachingAlignment | null,
  ): QualityDimension {
    if (!teachingAlignment) {
      return this.unknown('No teaching alignment report is available yet.');
    }

    const uncovered = teachingAlignment.selectedUnits.filter(
      (unit) => !unit.covered,
    );
    const criticalUncovered = uncovered.filter(
      (unit) => unit.importance === 'critical',
    );
    const warnings = [
      ...teachingAlignment.warnings,
      ...uncovered.map((unit) => `missing_selected_teaching_unit:${unit.id}`),
    ];
    const selectedCount = teachingAlignment.selectedUnits.length;
    const coveredCount = selectedCount - uncovered.length;
    const score = selectedCount > 0 ? coveredCount / selectedCount : null;

    if (criticalUncovered.length) {
      return this.dimension({
        status: 'blocker',
        score,
        blockers: criticalUncovered.map(
          (unit) => `critical_teaching_unit_missing:${unit.id}`,
        ),
        warnings,
        summary: 'A critical selected teaching unit is not represented.',
      });
    }

    if (uncovered.length || teachingAlignment.warnings.length) {
      return this.dimension({
        status: 'warning',
        score,
        warnings,
        summary: 'Some selected teaching intent is weakly represented.',
      });
    }

    return this.dimension({
      status: 'good',
      score,
      summary: 'Selected teaching units are represented.',
    });
  }

  private revealTiming(teachingAlignment: TeachingAlignment | null): QualityDimension {
    if (!teachingAlignment) {
      return this.unknown('No reveal timing report is available yet.');
    }

    if (teachingAlignment.revealTiming.giveawayTooEarly) {
      return this.dimension({
        status: 'warning',
        score: null,
        warnings: [
          'giveaway_clue_too_early',
          ...teachingAlignment.revealTiming.issues,
        ],
        summary: 'High-specificity evidence may appear too early.',
      });
    }

    return this.dimension({
      status: 'good',
      score: null,
      summary: 'Reveal timing preserves diagnostic reasoning.',
    });
  }

  private mimicPersistence(
    teachingAlignment: TeachingAlignment | null,
  ): QualityDimension {
    if (!teachingAlignment) {
      return this.unknown('No mimic persistence report is available yet.');
    }

    if (teachingAlignment.mimicPersistence.issues.length) {
      return this.dimension({
        status: 'warning',
        score: null,
        warnings: teachingAlignment.mimicPersistence.issues,
        summary: 'Mimics may be ruled out too early.',
      });
    }

    if (teachingAlignment.mimicPersistence.earlyMimicsPresent.length === 0) {
      return this.dimension({
        status: 'warning',
        score: null,
        warnings: ['no_early_mimics_present'],
        summary: 'No early mimics were detected in the case.',
      });
    }

    return this.dimension({
      status: 'good',
      score: null,
      summary: 'Mimics remain plausible enough for play.',
    });
  }

  private playability(input: {
    validationRun: ValidationRunInput;
    validationIssues: ValidationIssue[];
    generationQuality: GenerationQuality | null;
    teachingAlignment: TeachingAlignment | null;
  }): QualityDimension {
    const clueIssues = input.validationIssues.filter(
      (issue) => issue.validator === 'clue',
    );
    const blockers = this.issueCodes(clueIssues, 'error');
    const validationWarnings = this.issueCodes(clueIssues, 'warning');
    const alignmentIssues = input.teachingAlignment?.playability.issues ?? [];
    const score =
      input.teachingAlignment?.playability.score ??
      (typeof input.generationQuality?.qualityScore === 'number'
        ? Math.round(input.generationQuality.qualityScore * 100)
        : null);

    if (blockers.length) {
      return this.dimension({
        status: 'blocker',
        score: this.scoreToUnit(score),
        blockers,
        warnings: [...validationWarnings, ...alignmentIssues],
        summary: 'Case structure is not currently playable.',
      });
    }

    if (
      validationWarnings.length ||
      alignmentIssues.length ||
      (typeof score === 'number' && score < 70)
    ) {
      return this.dimension({
        status: 'warning',
        score: this.scoreToUnit(score),
        warnings: [
          ...validationWarnings,
          ...alignmentIssues,
          ...(typeof score === 'number' && score < 70
            ? ['low_playability_score']
            : []),
        ],
        summary: 'Playable, but pacing or clue structure may need tuning.',
      });
    }

    if (!input.validationRun && !input.teachingAlignment && !input.generationQuality) {
      return this.unknown('No playability signal is available yet.');
    }

    return this.dimension({
      status: 'good',
      score: this.scoreToUnit(score),
      summary: 'Playability signals are acceptable.',
    });
  }

  private difficultyFit(input: {
    validationIssues: ValidationIssue[];
    teachingAlignment: TeachingAlignment | null;
  }): QualityDimension {
    const difficultyIssues = input.validationIssues.filter(
      (issue) => issue.validator === 'difficulty',
    );
    const blockers = this.issueCodes(difficultyIssues, 'error');
    const warnings = [
      ...this.issueCodes(difficultyIssues, 'warning'),
      ...(input.teachingAlignment?.playability.difficultyFit &&
      input.teachingAlignment.playability.difficultyFit !== 'fits'
        ? [`difficulty_fit:${input.teachingAlignment.playability.difficultyFit}`]
        : []),
    ];

    if (blockers.length) {
      return this.dimension({
        status: 'blocker',
        score: null,
        blockers,
        warnings,
        summary: 'Difficulty label is not valid for editorial workflow.',
      });
    }

    if (warnings.length) {
      return this.dimension({
        status: 'warning',
        score: null,
        warnings,
        summary: 'Difficulty may not match clue progression.',
      });
    }

    if (!input.teachingAlignment && difficultyIssues.length === 0) {
      return this.unknown('No difficulty-fit signal is available yet.');
    }

    return this.dimension({
      status: 'good',
      score: null,
      summary: 'Difficulty appears to fit clue progression.',
    });
  }

  private parseGenerationQuality(
    explanation: Prisma.JsonValue | null | undefined,
  ): GenerationQuality | null {
    const explanationObject = this.asObject(explanation);
    const quality = this.asObject(explanationObject?.generationQuality);
    if (!quality) {
      return null;
    }

    return {
      critiqueScore: this.optionalNumber(quality.critiqueScore),
      critiquePassed:
        typeof quality.critiquePassed === 'boolean'
          ? quality.critiquePassed
          : undefined,
      critiqueIssues: this.stringArray(quality.critiqueIssues),
      differentialPlausibilityScore: this.optionalNumber(
        quality.differentialPlausibilityScore,
      ),
      clinicalEdgeValidityScore: this.optionalNumber(
        quality.clinicalEdgeValidityScore,
      ),
      qualityScore: this.optionalNumber(quality.qualityScore),
      teachingAlignment: this.parseTeachingAlignment(quality.teachingAlignment),
    };
  }

  private parseTeachingAlignment(value: unknown): TeachingAlignment | undefined {
    const object = this.asObject(value);
    if (!object) {
      return undefined;
    }

    const revealTiming = this.asObject(object.revealTiming);
    const mimicPersistence = this.asObject(object.mimicPersistence);
    const playability = this.asObject(object.playability);
    if (!revealTiming || !mimicPersistence || !playability) {
      return undefined;
    }

    return {
      selectedUnits: Array.isArray(object.selectedUnits)
        ? object.selectedUnits
            .map((unit) => this.asObject(unit))
            .filter((unit): unit is Record<string, unknown> => Boolean(unit))
            .map((unit) => ({
              id: typeof unit.id === 'string' ? unit.id : 'unknown',
              label: typeof unit.label === 'string' ? unit.label : 'Unknown unit',
              importance:
                typeof unit.importance === 'string'
                  ? unit.importance
                  : 'supporting',
              covered: unit.covered === true,
            }))
        : [],
      revealTiming: {
        earliestCoreRevealClue: this.optionalNumber(
          revealTiming.earliestCoreRevealClue,
        ),
        giveawayTooEarly: revealTiming.giveawayTooEarly === true,
        issues: this.stringArray(revealTiming.issues),
      },
      mimicPersistence: {
        earlyMimicsPresent: this.stringArray(
          mimicPersistence.earlyMimicsPresent,
        ),
        mimicsStillPlausibleUntilClue: this.optionalNumber(
          mimicPersistence.mimicsStillPlausibleUntilClue,
        ),
        issues: this.stringArray(mimicPersistence.issues),
      },
      playability: {
        score:
          typeof playability.score === 'number'
            ? playability.score
            : 0,
        difficultyFit: this.difficultyFitValue(playability.difficultyFit),
        issues: this.stringArray(playability.issues),
      },
      warnings: this.stringArray(object.warnings),
    };
  }

  private parseValidationIssues(
    findings: Prisma.JsonValue | null | undefined,
  ): ValidationIssue[] {
    const object = this.asObject(findings);
    if (!object || !Array.isArray(object.issues)) {
      return [];
    }

    return object.issues
      .map((issue) => this.asObject(issue))
      .filter((issue): issue is Record<string, unknown> => Boolean(issue))
      .filter(
        (issue) =>
          typeof issue.validator === 'string' &&
          typeof issue.severity === 'string' &&
          typeof issue.code === 'string' &&
          typeof issue.message === 'string',
      )
      .filter(
        (issue) =>
          issue.severity === 'error' ||
          issue.severity === 'warning' ||
          issue.severity === 'info',
      )
      .map((issue) => ({
        validator: issue.validator as string,
        severity: issue.severity as ValidationIssue['severity'],
        code: issue.code as string,
        message: issue.message as string,
        path: typeof issue.path === 'string' ? issue.path : undefined,
      }));
  }

  private issueCodes(
    issues: ValidationIssue[],
    severity: ValidationIssue['severity'],
  ): string[] {
    return issues
      .filter((issue) => issue.severity === severity)
      .map((issue) => issue.code);
  }

  private dimension(input: {
    status: QualityStatus;
    score?: number | null;
    warnings?: string[];
    blockers?: string[];
    summary: string;
  }): QualityDimension {
    return {
      status: input.status,
      score: input.score ?? null,
      warnings: this.unique(input.warnings ?? []),
      blockers: this.unique(input.blockers ?? []),
      summary: input.summary,
    };
  }

  private unknown(summary: string): QualityDimension {
    return this.dimension({ status: 'unknown', score: null, summary });
  }

  private scoreToUnit(score: number | null | undefined): number | null {
    if (typeof score !== 'number' || Number.isNaN(score)) {
      return null;
    }

    return score > 1 ? Math.round(score) / 100 : score;
  }

  private optionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private difficultyFitValue(
    value: unknown,
  ): TeachingAlignment['playability']['difficultyFit'] {
    if (
      value === 'too_easy' ||
      value === 'fits' ||
      value === 'too_hard' ||
      value === 'unclear'
    ) {
      return value;
    }

    return 'unclear';
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }
}
