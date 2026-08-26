import { Injectable } from '@nestjs/common';

export const TEACHING_RULE_CATEGORIES = [
  'differential_concept',
  'finding_concept',
  'exam_mechanism',
  'investigation_concept',
  'pitfall_concept',
  'management_concept',
  'recall_concept',
] as const;

export const TEACHING_RULE_IMPORTANCE = [
  'critical',
  'high',
  'supporting',
] as const;

export type TeachingRuleDraftCategory =
  (typeof TEACHING_RULE_CATEGORIES)[number];
export type TeachingRuleDraftImportance =
  (typeof TEACHING_RULE_IMPORTANCE)[number];
export type TeachingRuleValidationStatus =
  'PASS' | 'PASS_WITH_WARNINGS' | 'BLOCKED';

export type TeachingRuleQualitySignal =
  | 'model_generated'
  | 'brief_derived'
  | 'diagnosis_specific'
  | 'atomic'
  | 'operational'
  | 'differential_discriminator_present'
  | 'investigation_role_present'
  | 'management_principle_present'
  | 'evidence_expected'
  | 'editor_review_required';

export type TeachingRuleDraftDifferential = {
  registryId: string | null;
  diagnosis: string;
  whyConfused: string;
  keySeparator: string;
};

export type TeachingRuleDraft = {
  stableKeyHint: string | null;
  title: string;
  category: string;
  importance: string;
  rationale: string | null;
  acceptableManifestations: string[];
  requiredDifferentials: TeachingRuleDraftDifferential[];
  expectedEvidence: {
    evidenceExpected: boolean;
    evidenceClass: string | null;
    reason: string | null;
  };
  difficultyHints: {
    relevance: string | null;
    clueTiming: string | null;
    revealConstraints: string[];
  };
  avoidTooEarly: boolean;
  appliesToEducation: boolean;
  appliesToCaseGeneration: boolean;
  appliesToGraph: boolean;
  sourceBriefGoalIndexes: number[];
  sourceConcepts: string[];
};

export type TeachingRuleSetValidationResult = {
  status: TeachingRuleValidationStatus;
  blockers: string[];
  warnings: string[];
  qualitySignals: TeachingRuleQualitySignal[];
  ruleResults: Array<{
    index: number;
    status: TeachingRuleValidationStatus;
    blockers: string[];
    warnings: string[];
    qualitySignals: TeachingRuleQualitySignal[];
  }>;
  coverage: {
    coveredLearningGoalIndexes: number[];
    coveredMimics: string[];
    coveredInvestigations: string[];
    coveredPitfalls: string[];
    coveredManagementAnchors: string[];
    coveredDifficultyGuidance: string[];
    missingCriticalIntent: string[];
  };
};

export type TeachingRuleValidationContext = {
  diagnosisName: string;
  canonicalName: string;
  aliases: string[];
  brief: {
    learningGoals: string[];
    requiredMimicNames: string[];
    requiredPitfalls: string[];
    keyInvestigations: string[];
    managementAnchors: string[];
    difficultyGuidance: string[];
  };
};

const GENERIC_RULE_PATTERNS = [
  /\bteach important clinical features\b/i,
  /\brecognize symptoms\b/i,
  /\bperform appropriate tests\b/i,
  /\buse appropriate investigations\b/i,
  /\bconsider relevant differentials\b/i,
  /\btreat promptly\b/i,
  /\bprovide supportive care\b/i,
  /\bmanage according to severity\b/i,
  /\bclinical features and investigations\b/i,
];

const WORKFLOW_PATTERNS = [
  /\bactivate (?:a )?reasoning path\b/i,
  /\badd more graph facts\b/i,
  /\bimprove case diversity\b/i,
  /\bincrease discriminator coverage\b/i,
  /\bexpand investigation coverage\b/i,
  /\bimprove discriminator education\b/i,
  /\breview queue\b/i,
];

const OVERPRECISE_MEDICAL_PATTERN =
  /\b\d+(\.\d+)?\s?(?:mg|mcg|g|units?|iu|ml|days?|weeks?|months?|%|mmol\/l|mg\/dl)\b/i;

@Injectable()
export class TeachingRuleDraftQualityValidator {
  validate(input: {
    rules: TeachingRuleDraft[];
    context: TeachingRuleValidationContext;
  }): TeachingRuleSetValidationResult {
    const ruleResults = input.rules.map((rule, index) =>
      this.validateRule({ rule, index, context: input.context }),
    );
    const blockers = ruleResults.flatMap((result) =>
      result.blockers.map((blocker) => `rule_${result.index}:${blocker}`),
    );
    const warnings = ruleResults.flatMap((result) =>
      result.warnings.map((warning) => `rule_${result.index}:${warning}`),
    );
    const coverage = this.coverage(input.rules, input.context);
    blockers.push(
      ...coverage.missingCriticalIntent.map(
        (missing) => `brief_intent_missing:${missing}`,
      ),
    );

    const qualitySignals = new Set<TeachingRuleQualitySignal>([
      'model_generated',
      'brief_derived',
      'editor_review_required',
    ]);
    for (const result of ruleResults) {
      result.qualitySignals.forEach((signal) => qualitySignals.add(signal));
    }
    if (input.rules.some((rule) => rule.expectedEvidence.evidenceExpected)) {
      qualitySignals.add('evidence_expected');
    }

    const uniqueBlockers = this.unique(blockers);
    const uniqueWarnings = this.unique(warnings);
    return {
      status: uniqueBlockers.length
        ? 'BLOCKED'
        : uniqueWarnings.length
          ? 'PASS_WITH_WARNINGS'
          : 'PASS',
      blockers: uniqueBlockers,
      warnings: uniqueWarnings,
      qualitySignals: [...qualitySignals],
      ruleResults,
      coverage,
    };
  }

  private validateRule(input: {
    rule: TeachingRuleDraft;
    index: number;
    context: TeachingRuleValidationContext;
  }): TeachingRuleSetValidationResult['ruleResults'][number] {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const qualitySignals = new Set<TeachingRuleQualitySignal>([
      'model_generated',
      'brief_derived',
      'editor_review_required',
    ]);
    const rule = input.rule;
    const text = [
      rule.title,
      rule.rationale,
      ...rule.acceptableManifestations,
      ...rule.requiredDifferentials.flatMap((differential) => [
        differential.diagnosis,
        differential.whyConfused,
        differential.keySeparator,
      ]),
      rule.expectedEvidence.reason,
      rule.difficultyHints.relevance,
      rule.difficultyHints.clueTiming,
      ...rule.difficultyHints.revealConstraints,
      ...rule.sourceConcepts,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ');
    const normalized = this.normalize(text);

    if (!TEACHING_RULE_CATEGORIES.includes(rule.category as never)) {
      blockers.push('invalid_category');
    }
    if (!TEACHING_RULE_IMPORTANCE.includes(rule.importance as never)) {
      blockers.push('invalid_importance');
    }
    if (this.isWorkflowAdvice(text)) {
      blockers.push('workflow_recommendation_not_clinical_rule');
    }
    if (this.isGeneric(text)) {
      blockers.push('generic_teaching_rule');
    }
    if (!this.referencesDiagnosis(normalized, input.context)) {
      blockers.push('wrong_or_missing_target_diagnosis');
    } else {
      qualitySignals.add('diagnosis_specific');
    }
    if (this.conceptLoad(rule) > 2) {
      warnings.push('multi_concept_overloaded_rule');
    } else {
      qualitySignals.add('atomic');
    }
    if (
      !rule.appliesToEducation &&
      !rule.appliesToCaseGeneration &&
      !rule.appliesToGraph
    ) {
      blockers.push('rule_has_no_operational_application');
    } else {
      qualitySignals.add('operational');
    }

    this.validateCategoryFit(rule, blockers, warnings, qualitySignals);

    if (OVERPRECISE_MEDICAL_PATTERN.test(text)) {
      warnings.push('unsupported_treatment_precision_or_threshold');
    }
    if (
      ['management_concept', 'investigation_concept'].includes(rule.category) &&
      !rule.expectedEvidence.evidenceExpected
    ) {
      warnings.push('high_risk_rule_missing_evidence_expectation');
    }

    const uniqueBlockers = this.unique(blockers);
    const uniqueWarnings = this.unique(warnings);
    return {
      index: input.index,
      status: uniqueBlockers.length
        ? 'BLOCKED'
        : uniqueWarnings.length
          ? 'PASS_WITH_WARNINGS'
          : 'PASS',
      blockers: uniqueBlockers,
      warnings: uniqueWarnings,
      qualitySignals: [...qualitySignals],
    };
  }

  private validateCategoryFit(
    rule: TeachingRuleDraft,
    blockers: string[],
    warnings: string[],
    qualitySignals: Set<TeachingRuleQualitySignal>,
  ) {
    const text = this.normalize(
      [
        rule.title,
        rule.rationale,
        ...rule.acceptableManifestations,
        ...rule.requiredDifferentials.flatMap((differential) => [
          differential.diagnosis,
          differential.whyConfused,
          differential.keySeparator,
        ]),
      ].join(' '),
    );
    switch (rule.category) {
      case 'differential_concept':
        if (!rule.requiredDifferentials.length) {
          blockers.push('differential_missing_mimic_identity');
        }
        if (
          rule.requiredDifferentials.some(
            (differential) =>
              this.substantiveWordCount(differential.whyConfused) < 4 ||
              this.substantiveWordCount(differential.keySeparator) < 4,
          )
        ) {
          blockers.push('differential_missing_meaningful_separator');
        } else {
          qualitySignals.add('differential_discriminator_present');
        }
        break;
      case 'investigation_concept':
        if (
          !/\b(confirm|support|screen|exclude|monitor|stage|severity|interpret|biopsy|immunofluorescence|serology|test|ct|mri|ultrasound|lab)\b/.test(
            text,
          )
        ) {
          blockers.push('investigation_missing_diagnostic_role');
        } else {
          qualitySignals.add('investigation_role_present');
        }
        break;
      case 'pitfall_concept':
        if (
          !/\b(mistake|pitfall|avoid|do not|does not exclude|excluded|exclude|trap|premature|false)\b/.test(
            text,
          )
        ) {
          blockers.push('pitfall_missing_reasoning_error');
        }
        break;
      case 'management_concept':
        if (
          !/\b(manage|management|treat|therapy|control|diet|escalat|monitor|safety|principle|long term|symptom)\b/.test(
            text,
          )
        ) {
          blockers.push('management_missing_clinical_principle');
        } else {
          qualitySignals.add('management_principle_present');
        }
        break;
      default:
        break;
    }
  }

  private coverage(
    rules: TeachingRuleDraft[],
    context: TeachingRuleValidationContext,
  ): TeachingRuleSetValidationResult['coverage'] {
    const text = this.normalize(
      rules
        .map((rule) =>
          [
            rule.title,
            rule.rationale,
            ...rule.acceptableManifestations,
            ...rule.requiredDifferentials.flatMap((differential) => [
              differential.diagnosis,
              differential.whyConfused,
              differential.keySeparator,
            ]),
            ...rule.sourceConcepts,
          ].join(' '),
        )
        .join(' '),
    );
    const coveredLearningGoalIndexes = context.brief.learningGoals
      .map((goal, index) =>
        this.overlaps(text, goal) ||
        rules.some((rule) => rule.sourceBriefGoalIndexes.includes(index))
          ? index
          : null,
      )
      .filter((index): index is number => index !== null);
    const coveredMimics = context.brief.requiredMimicNames.filter((mimic) =>
      this.overlaps(text, mimic),
    );
    const coveredInvestigations = context.brief.keyInvestigations.filter(
      (investigation) => this.overlaps(text, investigation),
    );
    const coveredPitfalls = context.brief.requiredPitfalls.filter((pitfall) =>
      this.overlaps(text, pitfall),
    );
    const coveredManagementAnchors = context.brief.managementAnchors.filter(
      (anchor) => this.overlaps(text, anchor),
    );
    const coveredDifficultyGuidance = context.brief.difficultyGuidance.filter(
      (guidance) => this.overlaps(text, guidance),
    );
    const missingCriticalIntent = [
      context.brief.learningGoals.length &&
      coveredLearningGoalIndexes.length === 0
        ? 'learning_goals'
        : null,
      context.brief.requiredMimicNames.length && coveredMimics.length === 0
        ? 'mimics'
        : null,
      context.brief.keyInvestigations.length &&
      coveredInvestigations.length === 0
        ? 'investigations'
        : null,
      context.brief.requiredPitfalls.length && coveredPitfalls.length === 0
        ? 'pitfalls'
        : null,
      context.brief.managementAnchors.length &&
      coveredManagementAnchors.length === 0
        ? 'management_anchors'
        : null,
    ].filter((item): item is string => Boolean(item));

    return {
      coveredLearningGoalIndexes,
      coveredMimics,
      coveredInvestigations,
      coveredPitfalls,
      coveredManagementAnchors,
      coveredDifficultyGuidance,
      missingCriticalIntent,
    };
  }

  private conceptLoad(rule: TeachingRuleDraft): number {
    return [
      rule.category.includes('finding') ||
        /\brash|finding|sign|pattern\b/i.test(rule.title),
      rule.requiredDifferentials.length > 0,
      rule.category.includes('investigation') ||
        /\btest|biopsy|immunofluorescence|lab|imaging\b/i.test(rule.title),
      rule.category.includes('management') ||
        /\btreat|manage|therapy|diet|control\b/i.test(rule.title),
      rule.category.includes('pitfall') ||
        /\bavoid|pitfall|mistake|exclude\b/i.test(rule.title),
    ].filter(Boolean).length;
  }

  private referencesDiagnosis(
    normalizedText: string,
    context: TeachingRuleValidationContext,
  ) {
    const names = [
      context.diagnosisName,
      context.canonicalName,
      ...context.aliases,
    ]
      .map((value) => this.normalize(value))
      .filter(Boolean);
    return names.some((name) => normalizedText.includes(name));
  }

  private isGeneric(value: string) {
    return GENERIC_RULE_PATTERNS.some((pattern) => pattern.test(value));
  }

  private isWorkflowAdvice(value: string) {
    return WORKFLOW_PATTERNS.some((pattern) => pattern.test(value));
  }

  private overlaps(haystack: string, needle: string) {
    const words = this.normalize(needle)
      .split(' ')
      .filter(
        (word) =>
          word.length >= 5 &&
          ![
            'dermatitis',
            'herpetiformis',
            'disease',
            'syndrome',
            'diagnosis',
            'clinical',
          ].includes(word),
      );
    if (!words.length) return false;
    return words.some((word) => haystack.includes(word));
  }

  private substantiveWordCount(value: string) {
    return this.normalize(value)
      .split(' ')
      .filter((word) => word.length >= 4).length;
  }

  private normalize(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[''`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
  }
}
