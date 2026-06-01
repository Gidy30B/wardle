import { Injectable } from '@nestjs/common';
import type { GenerationContext } from '../editorial/generation-context-builder.service';
import type { TeachingUnit } from '../education/education-teaching-rules.service';
import type { GeneratedCase } from './case-generator.types';

export type CaseTeachingAlignmentInput = {
  caseData: GeneratedCase;
  diagnosisRegistryId?: string | null;
  generationContext?: GenerationContext;
  selectedTeachingUnits: TeachingUnit[];
};

export type CaseTeachingAlignmentReport = {
  selectedUnits: Array<{
    id: string;
    label: string;
    importance: TeachingUnit['importance'];
    covered: boolean;
    matchedManifestations: string[];
    firstClueIndex?: number;
    evidence: string[];
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

const UNIT_SYNONYMS: Record<string, string[]> = {
  potassium_before_insulin: [
    'serum potassium before insulin',
    'potassium checked before insulin',
    'correct potassium before insulin',
    'hypokalemia risk with insulin',
    'insulin shifts potassium intracellularly',
  ],
  insulin_hypokalemia_trap: [
    'hypokalemia risk with insulin',
    'insulin shifts potassium intracellularly',
    'potassium must be corrected before insulin',
  ],
  peritoneal_irritation: [
    'rebound',
    'guarding',
    'rovsing',
    'psoas',
    'obturator',
    'mcburney',
    'peritonism',
  ],
  ketosis_acidosis_distinguishes_dka: [
    'ketones',
    'beta hydroxybutyrate',
    'anion gap acidosis',
    'metabolic acidosis',
    'low bicarbonate',
  ],
};

const GENERIC_GIVEAWAY_PATTERNS = [
  /\bdiabetic ketoacidosis\b/i,
  /\bdka\b/i,
  /\bkussmaul\b/i,
  /\bct\b.*\bappendicitis\b/i,
  /\bst[-\s]?elevation myocardial infarction\b/i,
  /\bstemi\b/i,
];

@Injectable()
export class CaseTeachingAlignmentService {
  buildReport(input: CaseTeachingAlignmentInput): CaseTeachingAlignmentReport {
    const selectedUnits = input.selectedTeachingUnits.map((unit) =>
      this.assessSelectedUnit(unit, input.caseData),
    );
    const revealTiming = this.assessRevealTiming(input);
    const mimicPersistence = this.assessMimicPersistence(input);
    const playability = this.assessPlayability({
      input,
      selectedUnits,
      revealTiming,
      mimicPersistence,
    });
    const warnings = this.buildWarnings({
      selectedUnits,
      revealTiming,
      mimicPersistence,
      playability,
    });

    return {
      selectedUnits,
      revealTiming,
      mimicPersistence,
      playability,
      warnings,
    };
  }

  private assessSelectedUnit(unit: TeachingUnit, caseData: GeneratedCase) {
    const phrases = this.getUnitPhrases(unit);
    const matchedManifestations = new Set<string>();
    const evidence: string[] = [];
    let firstClueIndex: number | undefined;

    for (const clue of this.orderedClues(caseData)) {
      const matches = this.matchingPhrases(clue.value, phrases);
      if (!matches.length) {
        continue;
      }

      for (const match of matches) {
        matchedManifestations.add(match);
      }
      evidence.push(`Clue ${clue.order}: ${clue.value}`);
      firstClueIndex =
        firstClueIndex === undefined
          ? clue.order
          : Math.min(firstClueIndex, clue.order);
    }

    const explanationMatches = this.matchingPhrases(
      this.getExplanationText(caseData),
      phrases,
    );
    if (explanationMatches.length) {
      for (const match of explanationMatches) {
        matchedManifestations.add(match);
      }
      evidence.push(...explanationMatches.map((match) => `Explanation: ${match}`));
    }

    return {
      id: unit.id,
      label: unit.label,
      importance: unit.importance,
      covered: matchedManifestations.size > 0,
      matchedManifestations: [...matchedManifestations],
      ...(firstClueIndex !== undefined ? { firstClueIndex } : {}),
      evidence,
    };
  }

  private assessRevealTiming(input: CaseTeachingAlignmentInput) {
    const revealByClue =
      input.generationContext?.difficultyStrategy?.revealCoreUnitByClue ?? 3;
    const avoidTooEarly = [
      ...(input.generationContext?.difficultyStrategy?.avoidTooEarly ?? []),
      ...(input.generationContext?.difficultyGuidance?.forbiddenEarlyClues ?? []),
      ...input.selectedTeachingUnits.flatMap((unit) => unit.avoidTooEarly ?? []),
    ];
    const issues: string[] = [];
    let earliestCoreRevealClue: number | undefined;

    for (const clue of this.orderedClues(input.caseData)) {
      if (clue.order >= revealByClue) {
        continue;
      }

      const giveaway = this.findGiveaway(clue.value, avoidTooEarly);
      if (!giveaway) {
        continue;
      }

      earliestCoreRevealClue =
        earliestCoreRevealClue === undefined
          ? clue.order
          : Math.min(earliestCoreRevealClue, clue.order);
      issues.push(`Clue ${clue.order} reveals ${giveaway} before clue ${revealByClue}.`);
    }

    return {
      ...(earliestCoreRevealClue !== undefined ? { earliestCoreRevealClue } : {}),
      giveawayTooEarly: issues.length > 0,
      issues,
    };
  }

  private assessMimicPersistence(input: CaseTeachingAlignmentInput) {
    const preferredMimics =
      input.generationContext?.difficultyGuidance?.keepAliveDifferentials ?? [];
    const earlyMimicsPresent = input.caseData.differentials.filter((differential) =>
      preferredMimics.length
        ? preferredMimics.some((mimic) => this.phrasesMatch(differential, mimic))
        : true,
    );
    const relevantAnalyses = input.caseData.explanation.differentialAnalysis.filter(
      (analysis) =>
        earlyMimicsPresent.some((mimic) =>
          this.phrasesMatch(analysis.diagnosis, mimic),
        ),
    );
    const firstRuleOutClues = relevantAnalyses
      .flatMap((analysis) => analysis.ruledOutByClues.map((ruleOut) => ruleOut.clueOrder))
      .filter((clueOrder) => Number.isFinite(clueOrder));
    const mimicsStillPlausibleUntilClue = firstRuleOutClues.length
      ? Math.min(...firstRuleOutClues)
      : undefined;
    const issues: string[] = [];

    if (input.caseData.differentials.length > 0 && earlyMimicsPresent.length === 0) {
      issues.push('No preferred mimics are present in the generated differential list.');
    }

    if (
      mimicsStillPlausibleUntilClue !== undefined &&
      mimicsStillPlausibleUntilClue <= 1
    ) {
      issues.push(
        `Mimics are weakened by clue ${mimicsStillPlausibleUntilClue}, before the middle clues.`,
      );
    }

    return {
      earlyMimicsPresent,
      ...(mimicsStillPlausibleUntilClue !== undefined
        ? { mimicsStillPlausibleUntilClue }
        : {}),
      issues,
    };
  }

  private assessPlayability(input: {
    input: CaseTeachingAlignmentInput;
    selectedUnits: CaseTeachingAlignmentReport['selectedUnits'];
    revealTiming: CaseTeachingAlignmentReport['revealTiming'];
    mimicPersistence: CaseTeachingAlignmentReport['mimicPersistence'];
  }) {
    const issues: string[] = [];
    const missingCount = input.selectedUnits.filter((unit) => !unit.covered).length;
    let score = 100 - missingCount * 15;

    if (input.revealTiming.giveawayTooEarly) {
      score -= 20;
      issues.push('A high-specificity clue appears too early.');
    }

    if (input.mimicPersistence.issues.length) {
      score -= input.mimicPersistence.issues.length * 12;
      issues.push(...input.mimicPersistence.issues);
    }

    const targetDifficulty =
      input.input.generationContext?.difficultyStrategy?.targetDifficulty;
    const earliestReveal = input.revealTiming.earliestCoreRevealClue;
    let difficultyFit: CaseTeachingAlignmentReport['playability']['difficultyFit'] =
      'unclear';

    if (!targetDifficulty || earliestReveal === undefined) {
      difficultyFit = input.revealTiming.giveawayTooEarly ? 'too_easy' : 'fits';
    } else if (targetDifficulty === 'hard' && earliestReveal < 3) {
      difficultyFit = 'too_easy';
    } else if (targetDifficulty === 'medium' && earliestReveal <= 1) {
      difficultyFit = 'too_easy';
    } else if (missingCount >= Math.max(2, input.selectedUnits.length)) {
      difficultyFit = 'too_hard';
    } else {
      difficultyFit = 'fits';
    }

    if (difficultyFit === 'too_easy') {
      issues.push('Difficulty may be too easy because discriminating evidence appears early.');
    }

    if (difficultyFit === 'too_hard') {
      issues.push('Difficulty may be too hard because selected teaching units are missing.');
      score -= 10;
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      difficultyFit,
      issues: [...new Set(issues)],
    };
  }

  private buildWarnings(input: {
    selectedUnits: CaseTeachingAlignmentReport['selectedUnits'];
    revealTiming: CaseTeachingAlignmentReport['revealTiming'];
    mimicPersistence: CaseTeachingAlignmentReport['mimicPersistence'];
    playability: CaseTeachingAlignmentReport['playability'];
  }): string[] {
    return [
      ...input.selectedUnits
        .filter((unit) => !unit.covered)
        .map((unit) => `missing_selected_teaching_unit:${unit.id}`),
      ...(input.revealTiming.giveawayTooEarly ? ['giveaway_clue_too_early'] : []),
      ...input.mimicPersistence.issues.map(() => 'mimics_killed_too_early'),
      ...(input.playability.difficultyFit === 'too_easy'
        ? ['case_playability_too_easy']
        : []),
      ...(input.playability.difficultyFit === 'too_hard'
        ? ['case_playability_too_hard']
        : []),
    ];
  }

  private getUnitPhrases(unit: TeachingUnit): string[] {
    return [
      unit.label,
      ...unit.acceptableManifestations,
      ...(UNIT_SYNONYMS[unit.id] ?? []),
    ];
  }

  private matchingPhrases(text: string, phrases: string[]): string[] {
    return phrases.filter((phrase) => this.phrasesMatch(text, phrase));
  }

  private phrasesMatch(text: string, phrase: string): boolean {
    const normalizedText = this.normalizeClinicalText(text);
    const normalizedPhrase = this.normalizeClinicalText(phrase);

    if (!normalizedPhrase) {
      return false;
    }

    if (
      normalizedText.includes(normalizedPhrase) ||
      normalizedPhrase.includes(normalizedText)
    ) {
      return true;
    }

    const phraseTokens = this.tokenize(normalizedPhrase);
    if (phraseTokens.length === 0) {
      return false;
    }

    const textTokens = new Set(this.tokenize(normalizedText));
    const overlap = phraseTokens.filter((token) => textTokens.has(token)).length;
    return overlap / phraseTokens.length >= 0.65;
  }

  private findGiveaway(text: string, avoidTooEarly: string[]): string | null {
    const normalizedText = this.normalizeClinicalText(text);
    const explicit = avoidTooEarly.find((phrase) => this.phrasesMatch(text, phrase));
    if (explicit) {
      return explicit;
    }

    const generic = GENERIC_GIVEAWAY_PATTERNS.find((pattern) =>
      pattern.test(text),
    );
    if (generic) {
      return 'diagnosis-specific giveaway';
    }

    const hasKetones = /\bketon|beta hydroxybutyrate\b/.test(normalizedText);
    const hasAcidosis = /\bacidosis|anion gap|bicarbonate|ph\b/.test(normalizedText);
    const hasGlucose = /\bglucose|hyperglycemia|blood sugar\b/.test(normalizedText);
    if (hasKetones && hasAcidosis && hasGlucose) {
      return 'ketones, acidosis, and hyperglycemia together';
    }

    return null;
  }

  private orderedClues(caseData: GeneratedCase) {
    return [...caseData.clues].sort((left, right) => left.order - right.order);
  }

  private getExplanationText(caseData: GeneratedCase): string {
    return [
      caseData.explanation.summary,
      ...caseData.explanation.reasoning,
      ...caseData.explanation.keyFindings,
      ...caseData.explanation.differentialAnalysis.flatMap((analysis) => [
        analysis.diagnosis,
        analysis.whyPlausibleEarly,
        analysis.finalReasonLessLikely,
        ...analysis.ruledOutByClues.flatMap((ruleOut) => [
          ruleOut.evidence,
          ruleOut.reason,
        ]),
      ]),
    ].join(' ');
  }

  private tokenize(value: string): string[] {
    return value
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);
  }

  private normalizeClinicalText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
