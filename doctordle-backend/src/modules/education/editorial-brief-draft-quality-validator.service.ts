import { Injectable } from '@nestjs/common';

export type EditorialBriefValidationStatus =
  | 'PASS'
  | 'PASS_WITH_WARNINGS'
  | 'BLOCKED';

export type EditorialBriefQualitySignal =
  | 'model_generated'
  | 'diagnosis_identity_present'
  | 'diagnosis_specific'
  | 'diagnostic_reasoning_present'
  | 'mimic_discriminators_present'
  | 'investigation_roles_present'
  | 'management_principles_present'
  | 'evidence_expected'
  | 'editor_review_required';

export type EditorialBriefDraftValidationResult = {
  status: EditorialBriefValidationStatus;
  blockers: string[];
  warnings: string[];
  qualitySignals: EditorialBriefQualitySignal[];
};

export type EditorialBriefDraftForValidation = {
  targetDiagnosis: string | null;
  educationalScope: string | null;
  learningGoals: string[];
  coreClinicalPattern: string | null;
  importantMimics: Array<{
    diagnosis: string;
    whyConfused: string;
    keyDiscriminator: string;
  }>;
  highValueFindings: Array<{
    finding: string;
    diagnosticRole: string;
    whyItMatters: string;
  }>;
  keyInvestigations: Array<{
    investigation: string;
    role: string;
    expectedInterpretation: string;
    caution: string;
  }>;
  managementAnchors: Array<{
    principle: string;
    reason: string;
    scope: string;
  }>;
  pitfalls: Array<{
    mistakenReasoning: string;
    correctivePrinciple: string;
  }>;
  difficultyGuidance: string[];
  caseGenerationGuidance: string[];
  educationGuidance: string[];
  uncertainties: string[];
};

export type EditorialBriefValidationContext = {
  diagnosisName: string;
  canonicalName: string;
  aliases: string[];
};

const GENERIC_FILLER_PATTERNS = [
  /\brecognize common clinical features\b/i,
  /\bconsider relevant differentials\b/i,
  /\buse appropriate investigations\b/i,
  /\bmanage according to severity\b/i,
  /\bprovide supportive care\b/i,
  /\bavoid premature diagnosis\b/i,
  /\bclinical features and investigations\b/i,
];

const OVERPRECISE_MEDICAL_PATTERN =
  /\b\d+(\.\d+)?\s?(?:mg|mcg|g|units?|iu|ml|days?|weeks?|months?|%|mmol\/l|mg\/dl)\b/i;

@Injectable()
export class EditorialBriefDraftQualityValidator {
  validate(input: {
    draft: EditorialBriefDraftForValidation;
    context: EditorialBriefValidationContext;
  }): EditorialBriefDraftValidationResult {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const qualitySignals = new Set<EditorialBriefQualitySignal>([
      'model_generated',
      'editor_review_required',
    ]);
    const draft = input.draft;
    const diagnosisNames = [
      input.context.diagnosisName,
      input.context.canonicalName,
      ...input.context.aliases,
    ]
      .map((value) => this.normalize(value))
      .filter(Boolean);
    const target = this.normalize(draft.targetDiagnosis ?? '');
    const allText = this.normalize(
      [
        draft.targetDiagnosis,
        draft.educationalScope,
        draft.coreClinicalPattern,
        ...draft.learningGoals,
        ...draft.importantMimics.flatMap((mimic) => [
          mimic.diagnosis,
          mimic.whyConfused,
          mimic.keyDiscriminator,
        ]),
        ...draft.highValueFindings.flatMap((finding) => [
          finding.finding,
          finding.diagnosticRole,
          finding.whyItMatters,
        ]),
        ...draft.keyInvestigations.flatMap((investigation) => [
          investigation.investigation,
          investigation.role,
          investigation.expectedInterpretation,
          investigation.caution,
        ]),
        ...draft.managementAnchors.flatMap((anchor) => [
          anchor.principle,
          anchor.reason,
          anchor.scope,
        ]),
        ...draft.pitfalls.flatMap((pitfall) => [
          pitfall.mistakenReasoning,
          pitfall.correctivePrinciple,
        ]),
        ...draft.difficultyGuidance,
        ...draft.caseGenerationGuidance,
        ...draft.educationGuidance,
        ...draft.uncertainties,
      ].join(' '),
    );

    if (!target) {
      warnings.push('target_diagnosis_missing');
    } else if (
      !diagnosisNames.some((name) => this.sameClinicalName(name, target))
    ) {
      blockers.push('possible_cross_diagnosis_leakage');
    } else {
      qualitySignals.add('diagnosis_identity_present');
    }

    if (!diagnosisNames.some((name) => allText.includes(name))) {
      blockers.push('diagnosis_identity_absent_from_content');
    }

    if (draft.learningGoals.length < 3) {
      blockers.push('generic_learning_goals');
    }
    if (
      draft.learningGoals.some((goal) => this.isGenericFiller(goal)) ||
      this.substantiveWordCount(draft.learningGoals.join(' ')) < 18
    ) {
      blockers.push('insufficient_diagnosis_specificity');
    } else {
      qualitySignals.add('diagnosis_specific');
    }

    if (
      !draft.coreClinicalPattern ||
      this.isGenericFiller(draft.coreClinicalPattern)
    ) {
      blockers.push('missing_core_clinical_pattern');
    } else {
      qualitySignals.add('diagnostic_reasoning_present');
    }

    const usefulMimics = draft.importantMimics.filter(
      (mimic) =>
        this.substantiveWordCount(mimic.whyConfused) >= 4 &&
        this.substantiveWordCount(mimic.keyDiscriminator) >= 3 &&
        !this.isGenericFiller(mimic.whyConfused) &&
        !this.isGenericFiller(mimic.keyDiscriminator),
    );
    if (usefulMimics.length < 2) {
      blockers.push('missing_diagnostic_discriminators');
    } else {
      qualitySignals.add('mimic_discriminators_present');
    }

    if (
      draft.highValueFindings.length < 2 ||
      draft.highValueFindings.some(
        (finding) =>
          !finding.diagnosticRole ||
          !finding.whyItMatters ||
          this.isGenericFiller(finding.diagnosticRole),
      )
    ) {
      warnings.push('weak_high_value_finding_roles');
    }

    const usefulInvestigations = draft.keyInvestigations.filter(
      (investigation) =>
        investigation.investigation &&
        investigation.role &&
        investigation.expectedInterpretation &&
        !this.isGenericFiller(investigation.role),
    );
    if (usefulInvestigations.length < 1) {
      blockers.push('generic_investigation_guidance');
    } else {
      qualitySignals.add('investigation_roles_present');
      qualitySignals.add('evidence_expected');
    }

    const usefulManagementAnchors = draft.managementAnchors.filter(
      (anchor) =>
        anchor.principle &&
        anchor.reason &&
        !this.isGenericFiller(anchor.principle) &&
        !this.isGenericFiller(anchor.reason),
    );
    if (usefulManagementAnchors.length < 1) {
      warnings.push('weak_management_anchors');
    } else {
      qualitySignals.add('management_principles_present');
      qualitySignals.add('evidence_expected');
    }

    const preciseManagement = draft.managementAnchors.find((anchor) =>
      OVERPRECISE_MEDICAL_PATTERN.test(
        `${anchor.principle} ${anchor.reason} ${anchor.scope}`,
      ),
    );
    if (preciseManagement) {
      warnings.push('management_overprecision');
      qualitySignals.add('evidence_expected');
    }

    if (draft.pitfalls.length < 1) {
      warnings.push('missing_reasoning_traps');
    }
    if (this.hasDuplicates(draft.learningGoals)) {
      warnings.push('duplicate_learning_goals');
    }
    if (draft.uncertainties.length > 0) {
      warnings.push('provider_uncertainty_present');
    }

    const uniqueBlockers = [...new Set(blockers)];
    const uniqueWarnings = [...new Set(warnings)];
    return {
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

  private isGenericFiller(value: string) {
    return GENERIC_FILLER_PATTERNS.some((pattern) => pattern.test(value));
  }

  private substantiveWordCount(value: string) {
    return this.normalize(value)
      .split(' ')
      .filter((word) => word.length >= 4).length;
  }

  private hasDuplicates(values: string[]) {
    const normalized = values
      .map((value) => this.normalize(value))
      .filter(Boolean);
    return new Set(normalized).size !== normalized.length;
  }

  private sameClinicalName(left: string, right: string) {
    return left === right || left.includes(right) || right.includes(left);
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
}
