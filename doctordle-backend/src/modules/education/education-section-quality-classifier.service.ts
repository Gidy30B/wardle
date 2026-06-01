import { Injectable } from '@nestjs/common';
import type {
  EducationCoverageWarning,
  EducationDraftQualityResult,
} from './education-draft-quality-validator.service';

export type EducationRegenerableSection =
  | 'differentials'
  | 'investigations'
  | 'examPearls'
  | 'management';

export type EducationQualitySection =
  | EducationRegenerableSection
  | 'pitfalls'
  | 'recallPrompts'
  | 'findings';

export type SectionFailureSummary = {
  section: EducationQualitySection;
  score: number | null;
  coverageScore: number | null;
  patternComplianceScore: number | null;
  blockers: string[];
  warnings: string[];
  regenerationRecommended: boolean;
  reason: string | null;
};

const SECTION_ORDER: EducationQualitySection[] = [
  'differentials',
  'investigations',
  'examPearls',
  'management',
  'pitfalls',
  'recallPrompts',
  'findings',
];

const WARNING_SECTION_MAP: Record<string, EducationQualitySection> = {
  missing_comparative_differential_reasoning: 'differentials',
  missing_differentials: 'differentials',
  differential_missing_why_confused: 'differentials',
  differential_missing_key_separator: 'differentials',
  differential_generic_separator: 'differentials',
  differential_missing_management_consequence: 'differentials',
  differential_no_comparative_language: 'differentials',
  weak_comparative_differential_quality: 'differentials',
  missing_expected_mimics: 'differentials',
  missing_required_differential: 'differentials',

  missing_investigations: 'investigations',
  missing_expected_investigations: 'investigations',
  missing_expected_scoring_systems: 'investigations',
  missing_required_investigation: 'investigations',
  investigation_missing_expected_finding: 'investigations',
  investigation_missing_interpretation: 'investigations',
  investigation_vague_test_usefulness: 'investigations',
  investigation_missing_limitation: 'investigations',
  weak_investigation_interpretation: 'investigations',

  missing_exam_pearls: 'examPearls',
  missing_expected_named_signs: 'examPearls',
  missing_required_exam_mechanism: 'examPearls',
  exam_missing_mechanism: 'examPearls',
  exam_missing_diagnostic_impact: 'examPearls',
  exam_generic_supports_diagnosis: 'examPearls',
  exam_symptom_listed_as_exam_pearl: 'examPearls',
  exam_lab_listed_as_exam_pearl: 'examPearls',
  weak_exam_pearl_quality: 'examPearls',
  generic_exam_pearl_why_layer: 'examPearls',

  missing_management_anchors: 'management',
  missing_expected_management_anchors: 'management',
  missing_required_management_anchor: 'management',
  management_generic_action: 'management',
  management_missing_indication: 'management',
  management_missing_rationale: 'management',
  management_missing_operational_consequence: 'management',
  weak_management_anchor_usefulness: 'management',

  missing_pitfalls: 'pitfalls',
  missing_expected_pitfalls: 'pitfalls',
  missing_required_pitfall: 'pitfalls',
  pitfall_too_short: 'pitfalls',
  pitfall_generic_trap: 'pitfalls',
  pitfall_missing_consequence: 'pitfalls',
  pitfall_missing_safer_heuristic: 'pitfalls',
  weak_pitfall_specificity: 'pitfalls',

  missing_recall_prompts: 'recallPrompts',
  missing_why_it_matters_recall_prompt: 'recallPrompts',
  missing_required_recall_concept: 'recallPrompts',
  weak_recall_reasoning_quality: 'recallPrompts',
  recall_prompt_too_trivia_based: 'recallPrompts',

  weak_atomic_finding_quality: 'findings',
  missing_atomic_knowledge_items: 'findings',
};

const BLOCKER_SECTION_MAP: Record<string, EducationQualitySection> = {
  no_comparative_differentials: 'differentials',
  investigations_all_missing_interpretation: 'investigations',
  exam_pearls_all_missing_mechanism: 'examPearls',
  management_section_entirely_generic: 'management',
  typed_pearl_differentials_missing_operational_reasoning: 'differentials',
  typed_pearl_investigations_missing_operational_reasoning: 'investigations',
  typed_pearl_examPearls_missing_operational_reasoning: 'examPearls',
  typed_pearl_management_missing_operational_reasoning: 'management',
  typed_pearl_pitfalls_missing_operational_reasoning: 'pitfalls',
};

const COVERAGE_SECTION_MAP: Record<string, EducationQualitySection> = {
  differentials: 'differentials',
  investigations: 'investigations',
  examPearls: 'examPearls',
  management: 'management',
  pitfalls: 'pitfalls',
  recallPrompts: 'recallPrompts',
};

@Injectable()
export class EducationSectionQualityClassifier {
  classifyWarning(code: string): EducationQualitySection | null {
    return WARNING_SECTION_MAP[code] ?? null;
  }

  classifyBlocker(code: string): EducationQualitySection | null {
    return BLOCKER_SECTION_MAP[code] ?? null;
  }

  classifyCoverageWarning(
    warning: Pick<EducationCoverageWarning, 'code' | 'section'>,
  ): EducationQualitySection | null {
    return (
      COVERAGE_SECTION_MAP[warning.section] ??
      this.classifyWarning(warning.code) ??
      null
    );
  }

  summarize(quality: EducationDraftQualityResult): SectionFailureSummary[] {
    return SECTION_ORDER.map((section) => {
      const warnings = [
        ...quality.warnings.filter(
          (warning) => this.classifyWarning(warning) === section,
        ),
        ...quality.coverageWarnings
          .filter((warning) => this.classifyCoverageWarning(warning) === section)
          .map((warning) =>
            warning.item ? `${warning.code}:${warning.item}` : warning.code,
          ),
      ];
      const blockers = quality.blockers.filter(
        (blocker) => this.classifyBlocker(blocker) === section,
      );
      const score = this.sectionScore(quality, section);
      const coverageScore = this.coverageScore(quality, section);
      const patternComplianceScore = this.patternScore(quality, section);
      const weakScore = score !== null && score < 0.75;
      const weakCoverage = coverageScore !== null && coverageScore < 1;
      const regenerationRecommended =
        this.isRegenerable(section) &&
        (blockers.length > 0 || weakScore || weakCoverage || warnings.length >= 2);

      return {
        section,
        score,
        coverageScore,
        patternComplianceScore,
        blockers: [...new Set(blockers)],
        warnings: [...new Set(warnings)],
        regenerationRecommended,
        reason: this.reason({
          blockers,
          warnings,
          weakScore,
          weakCoverage,
          regenerationRecommended,
        }),
      };
    });
  }

  private isRegenerable(
    section: EducationQualitySection,
  ): section is EducationRegenerableSection {
    return [
      'differentials',
      'investigations',
      'examPearls',
      'management',
    ].includes(section);
  }

  private sectionScore(
    quality: EducationDraftQualityResult,
    section: EducationQualitySection,
  ): number | null {
    if (section === 'findings') {
      return quality.scores.atomicityScore;
    }

    return quality.sectionScores[section as keyof typeof quality.sectionScores] ?? null;
  }

  private coverageScore(
    quality: EducationDraftQualityResult,
    section: EducationQualitySection,
  ): number | null {
    const key =
      section === 'examPearls'
        ? 'examMechanisms'
        : section === 'management'
          ? 'managementAnchors'
          : section === 'recallPrompts'
            ? 'recallConcepts'
            : section;

    return quality.coverageScores[key as keyof typeof quality.coverageScores] ?? null;
  }

  private patternScore(
    quality: EducationDraftQualityResult,
    section: EducationQualitySection,
  ): number | null {
    const key =
      section === 'examPearls'
        ? 'examPearl'
        : section === 'management'
          ? 'managementAnchor'
          : section === 'differentials'
            ? 'differential'
            : section === 'investigations'
              ? 'investigation'
              : section === 'recallPrompts'
                ? 'recallPrompt'
                : section;

    return (
      quality.patternComplianceScores[
        key as keyof typeof quality.patternComplianceScores
      ] ?? null
    );
  }

  private reason(input: {
    blockers: string[];
    warnings: string[];
    weakScore: boolean;
    weakCoverage: boolean;
    regenerationRecommended: boolean;
  }): string | null {
    if (input.blockers.length) {
      return input.blockers[0];
    }
    if (input.weakCoverage) {
      return 'missing_required_teaching_coverage';
    }
    if (input.weakScore) {
      return 'low_section_score';
    }
    if (input.regenerationRecommended && input.warnings.length) {
      return input.warnings[0];
    }
    return null;
  }
}
