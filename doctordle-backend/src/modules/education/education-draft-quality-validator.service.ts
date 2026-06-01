import { Injectable } from '@nestjs/common';
import {
  EducationEditorialPatternsService,
  type EducationEditorialPatternComplianceScores,
} from './education-editorial-patterns.service';
import type { EducationKnowledgeRulePack } from './education-knowledge-rules.service';
import { EducationSchemaContractService } from './education-schema-contract.service';
import type { EducationTeachingRulePack } from './education-teaching-rules.service';

export type EducationDraftQualityScores = {
  clinicalSpecificityScore: number;
  atomicityScore: number;
  differentialReasoningScore: number;
  investigationInterpretationScore: number;
  pitfallQualityScore: number;
  managementAnchorScore: number;
  recallReasoningScore: number;
  graphReadinessScore: number;
};

export type EducationDraftSectionScores = {
  differentials: number;
  investigations: number;
  examPearls: number;
  pitfalls: number;
  management: number;
  recallPrompts: number;
};

export type EducationTeachingCoverageScores = {
  differentials: number;
  pitfalls: number;
  findings: number;
  investigations: number;
  examMechanisms: number;
  managementAnchors: number;
  recallConcepts: number;
  overall: number;
};

export type EducationCoverageWarning = {
  code:
    | 'missing_required_differential'
    | 'missing_required_pitfall'
    | 'missing_required_investigation'
    | 'missing_required_exam_mechanism'
    | 'missing_required_management_anchor'
    | 'missing_required_recall_concept';
  item: string;
  section:
    | 'differentials'
    | 'pitfalls'
    | 'investigations'
    | 'examPearls'
    | 'management'
    | 'recallPrompts';
  severity: 'warning';
};

export type EducationDraftQualityResult = {
  warnings: string[];
  blockers: string[];
  coverageWarnings: EducationCoverageWarning[];
  scores: EducationDraftQualityScores;
  sectionScores: EducationDraftSectionScores;
  coverageScores: EducationTeachingCoverageScores;
  patternComplianceScores: EducationEditorialPatternComplianceScores;
};

type ValidatorInput = {
  draft: Partial<Record<string, unknown>>;
  guidance?: EducationKnowledgeRulePack | null;
  teachingRules?: EducationTeachingRulePack | null;
};

const DIFFERENTIAL_COMPARISON_PATTERN =
  /\b(?:unlike|rather than|whereas|compared with|favors|favours|argues against|distinguish|differentiate|over|instead of|less likely|more likely)\b/i;

const INTERPRETATION_PATTERN =
  /\b(?:supports|favors|favours|suggests|indicates|argues against|rules out|distinguishes|differentiate|confirms|raises suspicion|lowers suspicion|severity|threshold|positive|negative|elevated|reduced|normal)\b/i;

const PITFALL_SPECIFICITY_PATTERN =
  /\b(?:miss|false|normal|early|atypical|trap|avoid|delayed|before|after|worsen|over-|under-|reassuring|consequence|risk|perforation|hypokalemia|potassium|ketone|acidosis|consolidation)\b/i;

const MANAGEMENT_ANCHOR_PATTERN =
  /\b(?:consult|oxygen|fluid|fluids|antibiotic|insulin|potassium|ecg|troponin|thrombolysis|ct|imaging|severity|monitor|source control|diuresis|bronchodilator|steroid|reperfusion|admission|npo|analgesia)\b/i;

const RECALL_REASONING_PATTERN =
  /\b(?:why|distinguish|differentiate|favors|favours|argues against|rather than|unlike|what changes|what risk|what trap|what management|why it matters|next step|what should|how would)\b/i;

const GENERIC_SEPARATOR_PATTERN =
  /\b(?:characterized by|classic sign|classic symptom|look for|helps distinguish|helps differentiate|can help|may help|use imaging|imaging can|imaging may|supports diagnosis|supports the diagnosis|indicates an inflammatory process|inflammatory process|is useful|is helpful)\b/i;

const GENERIC_TEST_USEFULNESS_PATTERN =
  /\b(?:look for|useful test|helps diagnose|helps evaluate|can be used|important test|order .{0,24}to evaluate|indicates an inflammatory process)\b/i;

const GENERIC_MANAGEMENT_PATTERN =
  /\b(?:consult surgery|surgical consult|supportive care|treat promptly|manage based on severity|management depends|appropriate management|refer as needed)\b/i;

const SYMPTOM_AS_EXAM_PATTERN =
  /\b(?:nausea|vomiting|diarrhea|anorexia|cough|dyspnea|chest pain|abdominal pain|headache|fever|fatigue)\b/i;

const LAB_AS_EXAM_PATTERN =
  /\b(?:cbc|wbc|white blood cell|leukocytosis|troponin|ketone|glucose|lactate|crp|esr|bnp|creatinine|sodium|potassium)\b/i;

const OVERLAP_REASONING_PATTERN =
  /\b(?:both|overlap|mimic|confused|similar|shared|common alternative|can resemble|same early)\b/i;

const OBJECTIVE_FINDING_PATTERN =
  /\b(?:shows?|finding|findings|positive|negative|elevated|reduced|low|high|normal|abnormal|leukocytosis|ketone|ketones|acidosis|consolidation|infiltrate|troponin|lactate|bnp|wbc|ph|bicarbonate|creatinine|score)\b/i;

const MANAGEMENT_INDICATION_PATTERN =
  /\b(?:when|if|for|with|suspected|confirmed|severe|high risk|high-risk|unstable|focal|persistent|progressive|peritonism|shock|hypoxia)\b/i;

const GENERIC_FILLER_PATTERNS = [
  /\bmay present with\b/i,
  /\bcan present with\b/i,
  /\bimportant for (?:early )?diagnosis\b/i,
  /\bimportant for management\b/i,
  /\bguides (?:treatment|management)\b/i,
  /\bclinical correlation is advised\b/i,
  /\bmanagement depends on severity\b/i,
  /\bprompt treatment is necessary\b/i,
  /\bcan lead to complications\b/i,
];

@Injectable()
export class EducationDraftQualityValidator {
  constructor(
    private readonly educationEditorialPatternsService: EducationEditorialPatternsService = new EducationEditorialPatternsService(),
    private readonly educationSchemaContractService: EducationSchemaContractService = new EducationSchemaContractService(),
  ) {}

  validate(input: ValidatorInput): EducationDraftQualityResult {
    const warnings = new Set<string>();
    const blockers: string[] = [];
    const coverageWarnings: EducationCoverageWarning[] = [];
    const draft = input.draft;
    const guidance = input.guidance ?? null;
    const teachingRules = input.teachingRules ?? null;
    const fullText = this.textFrom(draft);
    const normalizedFullText = this.normalize(fullText);

    this.collectRuleCoverageWarnings({
      guidance,
      normalizedFullText,
      warnings,
    });
    const coverageScores = this.collectTeachingCoverageWarnings({
      draft,
      rules: teachingRules,
      warnings,
      coverageWarnings,
    });

    const atomicityScore = this.scoreAtomicity(draft, warnings);
    const examPearlSectionScore = this.scoreExamPearls(
      draft,
      warnings,
      blockers,
    );
    const differentialReasoningScore = this.scoreDifferentials(
      draft,
      warnings,
      blockers,
    );
    const investigationInterpretationScore = this.scoreInvestigations(
      draft,
      warnings,
      blockers,
    );
    const pitfallQualityScore = this.scorePitfalls(draft, warnings);
    const managementAnchorScore = this.scoreManagement(
      draft,
      warnings,
      blockers,
    );
    const recallReasoningScore = this.scoreRecallPrompts(draft, warnings);
    const patternComplianceScores =
      this.educationEditorialPatternsService.scoreDraft(draft);
    const genericScore = this.scoreGenericFiller(fullText, warnings);
    const clinicalSpecificityScore = this.scoreClinicalSpecificity({
      guidance,
      normalizedFullText,
      genericScore,
    });
    const graphReadinessScore = this.roundScore(
      atomicityScore * 0.2 +
        differentialReasoningScore * 0.18 +
        investigationInterpretationScore * 0.14 +
        pitfallQualityScore * 0.13 +
        managementAnchorScore * 0.12 +
        recallReasoningScore * 0.1 +
        clinicalSpecificityScore * 0.13,
    );

    if (graphReadinessScore < 0.6) {
      warnings.add('low_graph_readiness');
    }

    return {
      warnings: [...warnings].sort(),
      blockers,
      coverageWarnings,
      scores: {
        clinicalSpecificityScore,
        atomicityScore,
        differentialReasoningScore,
        investigationInterpretationScore,
        pitfallQualityScore,
        managementAnchorScore,
        recallReasoningScore,
        graphReadinessScore,
      },
      sectionScores: {
        differentials: differentialReasoningScore,
        investigations: investigationInterpretationScore,
        examPearls: examPearlSectionScore,
        pitfalls: pitfallQualityScore,
        management: managementAnchorScore,
        recallPrompts: recallReasoningScore,
      },
      coverageScores,
      patternComplianceScores,
    };
  }

  private collectRuleCoverageWarnings(input: {
    guidance: EducationKnowledgeRulePack | null;
    normalizedFullText: string;
    warnings: Set<string>;
  }): void {
    if (!input.guidance) {
      return;
    }

    if (
      !this.hasExpectedCoverage(
        input.normalizedFullText,
        input.guidance.expectedNamedSigns,
      )
    ) {
      input.warnings.add('missing_expected_named_signs');
    }

    if (
      input.guidance.expectedScoringSystems.length &&
      !this.hasExpectedCoverage(
        input.normalizedFullText,
        input.guidance.expectedScoringSystems,
      )
    ) {
      input.warnings.add('missing_expected_scoring_systems');
    }

    if (
      !this.hasExpectedCoverage(
        input.normalizedFullText,
        input.guidance.expectedInvestigations,
      )
    ) {
      input.warnings.add('missing_expected_investigations');
    }

    if (
      !this.hasExpectedCoverage(
        input.normalizedFullText,
        input.guidance.expectedMimics,
      )
    ) {
      input.warnings.add('missing_expected_mimics');
    }

    if (
      !this.hasExpectedCoverage(
        input.normalizedFullText,
        input.guidance.expectedPitfalls,
      )
    ) {
      input.warnings.add('missing_expected_pitfalls');
    }

    if (
      !this.hasExpectedCoverage(
        input.normalizedFullText,
        input.guidance.expectedManagementAnchors,
      )
    ) {
      input.warnings.add('missing_expected_management_anchors');
    }
  }

  private collectTeachingCoverageWarnings(input: {
    draft: Partial<Record<string, unknown>>;
    rules: EducationTeachingRulePack | null;
    warnings: Set<string>;
    coverageWarnings: EducationCoverageWarning[];
  }): EducationTeachingCoverageScores {
    if (!input.rules) {
      return this.emptyCoverageScores();
    }

    const usesTeachingUnits = input.rules.teachingUnits.length > 0;
    const scores = {
      differentials: usesTeachingUnits
        ? this.unitCoverageScore(
            this.textFrom(input.draft.differentials),
            input.rules.teachingUnits,
            'differential_concept',
          )
        : this.coverageScore(
            this.textFrom(input.draft.differentials),
            input.rules.requiredDifferentials,
          ),
      pitfalls: usesTeachingUnits
        ? this.unitCoverageScore(
            this.textFrom(input.draft.pitfalls),
            input.rules.teachingUnits,
            'pitfall_concept',
          )
        : this.coverageScore(
            this.textFrom(input.draft.pitfalls),
            input.rules.requiredPitfalls,
          ),
      findings: usesTeachingUnits
        ? this.unitCoverageScore(
            this.textFrom([
              input.draft.clinicalPattern,
              input.draft.keySymptoms,
              input.draft.keySigns,
              input.draft.examPearls,
            ]),
            input.rules.teachingUnits,
            'finding_concept',
          )
        : this.coverageScore(
            this.textFrom([
              input.draft.clinicalPattern,
              input.draft.keySymptoms,
              input.draft.keySigns,
              input.draft.examPearls,
            ]),
            input.rules.requiredFindings,
          ),
      investigations: usesTeachingUnits
        ? this.unitCoverageScore(
            this.textFrom([
              input.draft.investigations,
              input.draft.scoringSystems,
            ]),
            input.rules.teachingUnits,
            'investigation_concept',
          )
        : this.coverageScore(
            this.textFrom([
              input.draft.investigations,
              input.draft.scoringSystems,
            ]),
            input.rules.requiredInvestigations,
          ),
      examMechanisms: usesTeachingUnits
        ? this.unitCoverageScore(
            this.textFrom(input.draft.examPearls),
            input.rules.teachingUnits,
            'exam_mechanism',
          )
        : this.coverageScore(
            this.textFrom(input.draft.examPearls),
            input.rules.requiredExamMechanisms,
          ),
      managementAnchors: usesTeachingUnits
        ? this.unitCoverageScore(
            this.textFrom(input.draft.management),
            input.rules.teachingUnits,
            'management_concept',
          )
        : this.coverageScore(
            this.textFrom(input.draft.management),
            input.rules.requiredManagementAnchors,
          ),
      recallConcepts: usesTeachingUnits
        ? this.unitCoverageScore(
            this.textFrom(input.draft.recallPrompts),
            input.rules.teachingUnits,
            'recall_concept',
          )
        : this.coverageScore(
            this.textFrom(input.draft.recallPrompts),
            input.rules.requiredRecallConcepts,
          ),
    };

    if (scores.differentials < 1) {
      input.warnings.add('missing_required_differential');
      if (usesTeachingUnits) {
        this.addUnitCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.differentials),
          teachingUnits: input.rules.teachingUnits,
          category: 'differential_concept',
          code: 'missing_required_differential',
          section: 'differentials',
        });
      } else {
        this.addCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.differentials),
          requiredItems: input.rules.requiredDifferentials,
          code: 'missing_required_differential',
          section: 'differentials',
        });
      }
    }
    if (scores.pitfalls < 1) {
      input.warnings.add('missing_required_pitfall');
      if (usesTeachingUnits) {
        this.addUnitCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.pitfalls),
          teachingUnits: input.rules.teachingUnits,
          category: 'pitfall_concept',
          code: 'missing_required_pitfall',
          section: 'pitfalls',
        });
      } else {
        this.addCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.pitfalls),
          requiredItems: input.rules.requiredPitfalls,
          code: 'missing_required_pitfall',
          section: 'pitfalls',
        });
      }
    }
    if (scores.investigations < 1) {
      input.warnings.add('missing_required_investigation');
      if (usesTeachingUnits) {
        this.addUnitCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom([
            input.draft.investigations,
            input.draft.scoringSystems,
          ]),
          teachingUnits: input.rules.teachingUnits,
          category: 'investigation_concept',
          code: 'missing_required_investigation',
          section: 'investigations',
        });
      } else {
        this.addCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom([
            input.draft.investigations,
            input.draft.scoringSystems,
          ]),
          requiredItems: input.rules.requiredInvestigations,
          code: 'missing_required_investigation',
          section: 'investigations',
        });
      }
    }
    if (scores.examMechanisms < 1) {
      input.warnings.add('missing_required_exam_mechanism');
      if (usesTeachingUnits) {
        this.addUnitCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.examPearls),
          teachingUnits: input.rules.teachingUnits,
          category: 'exam_mechanism',
          code: 'missing_required_exam_mechanism',
          section: 'examPearls',
        });
      } else {
        this.addCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.examPearls),
          requiredItems: input.rules.requiredExamMechanisms,
          code: 'missing_required_exam_mechanism',
          section: 'examPearls',
        });
      }
    }
    if (scores.managementAnchors < 1) {
      input.warnings.add('missing_required_management_anchor');
      if (usesTeachingUnits) {
        this.addUnitCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.management),
          teachingUnits: input.rules.teachingUnits,
          category: 'management_concept',
          code: 'missing_required_management_anchor',
          section: 'management',
        });
      } else {
        this.addCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.management),
          requiredItems: input.rules.requiredManagementAnchors,
          code: 'missing_required_management_anchor',
          section: 'management',
        });
      }
    }
    if (scores.recallConcepts < 1) {
      input.warnings.add('missing_required_recall_concept');
      if (usesTeachingUnits) {
        this.addUnitCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.recallPrompts),
          teachingUnits: input.rules.teachingUnits,
          category: 'recall_concept',
          code: 'missing_required_recall_concept',
          section: 'recallPrompts',
        });
      } else {
        this.addCoverageWarnings({
          coverageWarnings: input.coverageWarnings,
          sectionText: this.textFrom(input.draft.recallPrompts),
          requiredItems: input.rules.requiredRecallConcepts,
          code: 'missing_required_recall_concept',
          section: 'recallPrompts',
        });
      }
    }

    return {
      ...scores,
      overall: this.average(Object.values(scores)),
    };
  }

  private addCoverageWarnings(input: {
    coverageWarnings: EducationCoverageWarning[];
    sectionText: string;
    requiredItems: string[];
    code: EducationCoverageWarning['code'];
    section: EducationCoverageWarning['section'];
  }): void {
    const normalizedText = this.expandClinicalShorthand(
      this.normalize(input.sectionText),
    );

    for (const item of input.requiredItems) {
      if (this.hasRequiredTeachingConcept(normalizedText, item)) {
        continue;
      }

      input.coverageWarnings.push({
        code: input.code,
        item,
        section: input.section,
        severity: 'warning',
      });
    }
  }

  private addUnitCoverageWarnings(input: {
    coverageWarnings: EducationCoverageWarning[];
    sectionText: string;
    teachingUnits: EducationTeachingRulePack['teachingUnits'];
    code: EducationCoverageWarning['code'];
    section: EducationCoverageWarning['section'];
    category?: EducationTeachingRulePack['teachingUnits'][number]['category'];
  }): void {
    const normalizedText = this.expandClinicalShorthand(
      this.normalize(input.sectionText),
    );
    const teachingUnits = input.category
      ? input.teachingUnits.filter((unit) => unit.category === input.category)
      : input.teachingUnits;

    for (const teachingUnit of teachingUnits) {
      if (!teachingUnit.appliesToEducation) {
        continue;
      }

      if (this.hasTeachingUnitCoverage(normalizedText, teachingUnit)) {
        continue;
      }

      input.coverageWarnings.push({
        code: input.code,
        item: teachingUnit.label,
        section: input.section,
        severity: 'warning',
      });
    }
  }

  private scoreAtomicity(
    draft: Partial<Record<string, unknown>>,
    warnings: Set<string>,
  ): number {
    const fields = [
      'clinicalPattern',
      'keySymptoms',
      'keySigns',
      'examPearls',
      'investigations',
      'differentials',
      'management',
      'pitfalls',
    ];
    const items = fields.flatMap((field) => this.asArray(draft[field]));
    if (!items.length) {
      warnings.add('missing_atomic_knowledge_items');
      return 0;
    }

    const quality = items.map((item) => this.atomicItemScore(item));
    const score = this.average(quality);
    if (score < 0.75) {
      warnings.add('weak_atomic_finding_quality');
    }

    return score;
  }

  private scoreDifferentials(
    draft: Partial<Record<string, unknown>>,
    warnings: Set<string>,
    blockers: string[],
  ): number {
    const items = this.asArray(draft.differentials);
    if (!items.length) {
      warnings.add('missing_differentials');
      return 0;
    }

    let strongComparativeCount = 0;
    const scores = items.map((item) => {
      const pearl = this.educationSchemaContractService.readTypedPearl(item);
      const text = this.educationSchemaContractService.canonicalText(item);
      const overlapText = [
        pearl.content,
        pearl.whyItMatters,
        pearl.trapAvoided,
      ]
        .filter(Boolean)
        .join(' ');
      const hasTarget = Boolean(pearl.title || pearl.content);
      const whyConfused = OVERLAP_REASONING_PATTERN.test(overlapText);
      const hasComparison = DIFFERENTIAL_COMPARISON_PATTERN.test(text);
      const hasStructuredDiscriminator = Boolean(pearl.discriminator);
      const separatorText = pearl.discriminator ?? text;
      const hasGenericSeparator = this.isGenericSeparator(separatorText);
      const managementConsequence = Boolean(
        pearl.managementImplication || pearl.trapAvoided,
      );

      if (!whyConfused) {
        warnings.add('differential_missing_why_confused');
      }
      if (!pearl.discriminator) {
        warnings.add('differential_missing_key_separator');
      }
      if (hasGenericSeparator) {
        warnings.add('differential_generic_separator');
      }
      if (!managementConsequence) {
        warnings.add('differential_missing_management_consequence');
      }
      if (!hasComparison) {
        warnings.add('differential_no_comparative_language');
      }

      if (
        hasTarget &&
        hasComparison &&
        hasStructuredDiscriminator &&
        !hasGenericSeparator
      ) {
        strongComparativeCount += 1;
      }

      return this.scoreParts([
        hasTarget,
        whyConfused,
        hasComparison,
        hasStructuredDiscriminator,
        !hasGenericSeparator,
        managementConsequence,
      ]);
    });
    const score = this.average(scores);
    if (score < 0.75) {
      warnings.add('weak_comparative_differential_quality');
    }
    if (strongComparativeCount === 0) {
      blockers.push('no_comparative_differentials');
    }

    return score;
  }

  private scoreInvestigations(
    draft: Partial<Record<string, unknown>>,
    warnings: Set<string>,
    blockers: string[],
  ): number {
    const items = [
      ...this.asArray(draft.investigations),
      ...this.asArray(draft.scoringSystems),
    ];
    if (!items.length) {
      warnings.add('missing_investigations');
      return 0;
    }

    let interpretedCount = 0;
    const scores = items.map((item) => {
      const object = this.asObject(item);
      const pearl = this.educationSchemaContractService.readTypedPearl(item);
      const canonicalText = this.educationSchemaContractService.canonicalText(
        item,
        ['content', 'whyItMatters', 'managementImplication'],
      );
      const text =
        canonicalText || [object.name, object.use, object.caution].join(' ');
      const scoringSystemUse = this.cleanString(object.use);
      const scoringSystemComponents = this.asArray(object.components);
      const scoringSystemCaution = this.cleanString(object.caution);
      const test = pearl.title || this.cleanString(object.name) || pearl.content;
      const expectedFinding = OBJECTIVE_FINDING_PATTERN.test(
        pearl.content ?? text,
      ) || scoringSystemComponents.length > 0;
      const interpretation = pearl.whyItMatters || scoringSystemUse;
      const operationalUse =
        pearl.managementImplication || scoringSystemCaution || scoringSystemUse;
      const hasInterpretation =
        interpretation !== null && INTERPRETATION_PATTERN.test(interpretation);

      if (!expectedFinding) {
        warnings.add('investigation_missing_expected_finding');
      }
      if (!hasInterpretation) {
        warnings.add('investigation_missing_interpretation');
      }
      if (GENERIC_TEST_USEFULNESS_PATTERN.test(text)) {
        warnings.add('investigation_vague_test_usefulness');
      }
      if (!operationalUse && /\b(?:cbc|wbc|ct|ultrasound|x-ray|crp|procalcitonin|score)\b/i.test(text)) {
        warnings.add('investigation_missing_limitation');
      }
      if (hasInterpretation) {
        interpretedCount += 1;
      }

      return this.scoreParts([
        Boolean(test || this.cleanString(object.content)),
        expectedFinding,
        hasInterpretation,
        INTERPRETATION_PATTERN.test(text),
        !GENERIC_TEST_USEFULNESS_PATTERN.test(text),
        Boolean(operationalUse),
      ]);
    });
    const score = this.average(scores);
    if (score < 0.75) {
      warnings.add('weak_investigation_interpretation');
    }
    if (interpretedCount === 0) {
      blockers.push('investigations_all_missing_interpretation');
    }

    return score;
  }

  private scorePitfalls(
    draft: Partial<Record<string, unknown>>,
    warnings: Set<string>,
  ): number {
    const items = this.asArray(draft.pitfalls);
    if (!items.length) {
      warnings.add('missing_pitfalls');
      return 0;
    }

    const scores = items.map((item) => {
      const pearl = this.educationSchemaContractService.readTypedPearl(item);
      const text = this.educationSchemaContractService.canonicalText(item, [
        'content',
        'whyItMatters',
        'trapAvoided',
      ]);
      const trap = pearl.title || pearl.content;
      const consequence = pearl.whyItMatters;
      const saferHeuristic = pearl.trapAvoided;
      if (text.split(/\s+/).filter(Boolean).length < 8) {
        warnings.add('pitfall_too_short');
      }
      if (!trap || GENERIC_FILLER_PATTERNS.some((pattern) => pattern.test(trap))) {
        warnings.add('pitfall_generic_trap');
      }
      if (!consequence) {
        warnings.add('pitfall_missing_consequence');
      }
      if (!saferHeuristic) {
        warnings.add('pitfall_missing_safer_heuristic');
      }

      return this.scoreParts([
        Boolean(trap),
        Boolean(pearl.content),
        Boolean(consequence),
        Boolean(saferHeuristic),
        PITFALL_SPECIFICITY_PATTERN.test(text),
      ]);
    });
    const score = this.average(scores);
    if (score < 0.75) {
      warnings.add('weak_pitfall_specificity');
    }

    return score;
  }

  private scoreManagement(
    draft: Partial<Record<string, unknown>>,
    warnings: Set<string>,
    blockers: string[],
  ): number {
    const items = this.asArray(draft.management);
    if (!items.length) {
      warnings.add('missing_management_anchors');
      return 0;
    }

    let usefulCount = 0;
    const scores = items.map((item) => {
      const pearl = this.educationSchemaContractService.readTypedPearl(item);
      const text = this.educationSchemaContractService.canonicalText(item, [
        'content',
        'whyItMatters',
        'managementImplication',
        'escalationImplication',
      ]);
      const action = pearl.title || pearl.content;
      const indication = Boolean(
        pearl.content && MANAGEMENT_INDICATION_PATTERN.test(pearl.content),
      );
      const rationale = pearl.whyItMatters || pearl.managementImplication;
      const consequence = pearl.escalationImplication;
      const generic = GENERIC_MANAGEMENT_PATTERN.test(text) && !indication && !rationale;

      if (GENERIC_MANAGEMENT_PATTERN.test(text)) {
        warnings.add('management_generic_action');
      }
      if (!indication) {
        warnings.add('management_missing_indication');
      }
      if (!rationale) {
        warnings.add('management_missing_rationale');
      }
      if (!consequence) {
        warnings.add('management_missing_operational_consequence');
      }
      if (!generic && indication && rationale) {
        usefulCount += 1;
      }

      return this.scoreParts([
        Boolean(action),
        indication,
        Boolean(rationale),
        MANAGEMENT_ANCHOR_PATTERN.test(text),
        !generic,
        Boolean(consequence),
      ]);
    });
    const score = this.average(scores);
    if (score < 0.75) {
      warnings.add('weak_management_anchor_usefulness');
    }
    if (usefulCount === 0) {
      blockers.push('management_section_entirely_generic');
    }

    return score;
  }

  private scoreExamPearls(
    draft: Partial<Record<string, unknown>>,
    warnings: Set<string>,
    blockers: string[],
  ): number {
    const items = this.asArray(draft.examPearls);
    if (!items.length) {
      warnings.add('missing_exam_pearls');
      return 0;
    }

    let mechanismCount = 0;
    const scores = items.map((item) => {
      const pearl = this.educationSchemaContractService.readTypedPearl(item);
      const text = this.educationSchemaContractService.canonicalText(item, [
        'content',
        'whyItMatters',
        'discriminator',
      ]);
      const finding = pearl.title || pearl.content;
      const mechanism = pearl.content;
      const diagnosticImpact = pearl.whyItMatters;
      const genericSupport = /\bsupports (?:the )?diagnosis\b/i.test(text);
      const symptomAsExam = finding ? SYMPTOM_AS_EXAM_PATTERN.test(finding) : false;
      const labAsExam = finding ? LAB_AS_EXAM_PATTERN.test(finding) : false;
      const hasMechanism =
        Boolean(mechanism) &&
        /\b(?:because|due to|from|reflects|suggests|indicates|produces|irritat|reproduc|provok|extension|palpation|maneuver|manoeuvre)\b/i.test(
          mechanism ?? '',
        );

      if (!hasMechanism) {
        warnings.add('exam_missing_mechanism');
      } else {
        mechanismCount += 1;
      }
      if (!diagnosticImpact || this.isGenericWhyLayer(diagnosticImpact)) {
        warnings.add('exam_missing_diagnostic_impact');
      }
      if (genericSupport) {
        warnings.add('exam_generic_supports_diagnosis');
      }
      if (symptomAsExam) {
        warnings.add('exam_symptom_listed_as_exam_pearl');
      }
      if (labAsExam) {
        warnings.add('exam_lab_listed_as_exam_pearl');
      }

      return this.scoreParts([
        Boolean(finding),
        hasMechanism,
        Boolean(diagnosticImpact && !this.isGenericWhyLayer(diagnosticImpact)),
        !genericSupport,
        !symptomAsExam,
        !labAsExam,
        Boolean(pearl.discriminator || DIFFERENTIAL_COMPARISON_PATTERN.test(text)),
      ]);
    });

    const score = this.average(scores);
    if (score < 0.75) {
      warnings.add('weak_exam_pearl_quality');
    }
    if (mechanismCount === 0) {
      blockers.push('exam_pearls_all_missing_mechanism');
    }

    return score;
  }

  private scoreRecallPrompts(
    draft: Partial<Record<string, unknown>>,
    warnings: Set<string>,
  ): number {
    const items = this.asArray(draft.recallPrompts);
    if (!items.length) {
      warnings.add('missing_recall_prompts');
      return 0;
    }

    let reasoningPromptCount = 0;
    const scores = items.map((item) => {
      const object = this.asObject(item);
      const prompt = this.cleanString(object.prompt) ?? this.textFrom(item);
      const answer = this.cleanString(object.answer);
      const type = this.cleanString(object.type);
      const explanation = this.cleanString(object.explanation);
      const isReasoningType =
        type === 'WHY_IT_MATTERS' ||
        type === 'DISTINGUISH' ||
        type === 'TRAP' ||
        type === 'NEXT_STEP';
      const isReasoningPrompt =
        isReasoningType || RECALL_REASONING_PATTERN.test(prompt);
      if (isReasoningPrompt) {
        reasoningPromptCount += 1;
      }
      return this.scoreParts([
        Boolean(prompt),
        Boolean(answer),
        Boolean(isReasoningPrompt),
        Boolean(explanation && INTERPRETATION_PATTERN.test(explanation)),
      ]);
    });
    const score = this.average(scores);
    if (score < 0.75) {
      warnings.add('weak_recall_reasoning_quality');
    }
    if (reasoningPromptCount === 0) {
      warnings.add('recall_prompt_too_trivia_based');
    }

    return score;
  }

  private scoreGenericFiller(text: string, warnings: Set<string>): number {
    const matches = GENERIC_FILLER_PATTERNS.filter((pattern) =>
      pattern.test(text),
    ).length;
    if (matches) {
      warnings.add('generic_filler_detected');
    }

    return this.roundScore(Math.max(0, 1 - matches * 0.2));
  }

  private scoreClinicalSpecificity(input: {
    guidance: EducationKnowledgeRulePack | null;
    normalizedFullText: string;
    genericScore: number;
  }): number {
    if (!input.guidance) {
      return input.genericScore;
    }

    const coverageGroups = [
      input.guidance.expectedNamedSigns,
      input.guidance.expectedScoringSystems,
      input.guidance.expectedInvestigations,
      input.guidance.expectedMimics,
      input.guidance.expectedPitfalls,
      input.guidance.expectedManagementAnchors,
    ];
    const coverage = coverageGroups.map((group) =>
      group.length &&
      this.hasExpectedCoverage(input.normalizedFullText, group)
        ? 1
        : 0,
    );

    return this.roundScore(this.average(coverage) * 0.75 + input.genericScore * 0.25);
  }

  private atomicItemScore(item: unknown): number {
    const text = this.textFrom(item);
    const object = this.asObject(item);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const sentenceCount = (text.match(/[.!?]+/g) ?? []).length || 1;
    const hasSingleFocus =
      wordCount <= 55 && sentenceCount <= 2 && !/;| and (?:fever|pain|cough|dyspnea|vomiting|diarrhea) and /i.test(text);
    const hasWhyLayer = Boolean(
      this.cleanString(object.whyItMatters) ||
        this.cleanString(object.diagnosticImpact) ||
        this.cleanString(object.discriminator) ||
        this.cleanString(object.significance) ||
        this.cleanString(object.interpretation) ||
        this.cleanString(object.rationale) ||
        this.cleanString(object.trapAvoided) ||
        INTERPRETATION_PATTERN.test(text),
    );
    const isSpecific =
      /\b[A-Z][a-z]+(?:'s)?\b/.test(text) ||
      /\b(?:ct|ecg|x-ray|ultrasound|troponin|ketone|lactate|bnp|fev1|nihss|curb-65|alvarado|mcburney|rovsing|psoas|kussmaul)\b/i.test(
        text,
      );

    return this.scoreParts([Boolean(text), hasSingleFocus, hasWhyLayer, isSpecific]);
  }

  private hasExpectedCoverage(text: string, terms: string[]): boolean {
    if (!terms.length) {
      return true;
    }

    const hits = terms.filter((term) => {
      const normalizedTerm = this.normalize(term);
      return Boolean(normalizedTerm && text.includes(normalizedTerm));
    }).length;
    const minimumHits = Math.min(2, terms.length);
    const minimumRatio = terms.length <= 3 ? 1 / terms.length : 0.25;

    return hits >= minimumHits || hits / terms.length >= minimumRatio;
  }

  private coverageScore(text: string, terms: string[]): number {
    if (!terms.length) {
      return 1;
    }

    const normalizedText = this.expandClinicalShorthand(this.normalize(text));
    const hits = terms.filter((term) =>
      this.hasRequiredTeachingConcept(normalizedText, term),
    ).length;

    return this.roundScore(hits / terms.length);
  }

  private unitCoverageScore(
    text: string,
    teachingUnits: EducationTeachingRulePack['teachingUnits'],
    category?: EducationTeachingRulePack['teachingUnits'][number]['category'],
  ): number {
    const relevantUnits = (category
      ? teachingUnits.filter((unit) => unit.category === category)
      : teachingUnits
    ).filter((unit) => unit.appliesToEducation);

    if (!relevantUnits.length) {
      return 1;
    }

    const normalizedText = this.expandClinicalShorthand(this.normalize(text));
    const hits = relevantUnits.filter((unit) =>
      this.hasTeachingUnitCoverage(normalizedText, unit),
    ).length;

    return this.roundScore(hits / relevantUnits.length);
  }

  private hasTeachingUnitCoverage(
    normalizedText: string,
    teachingUnit: EducationTeachingRulePack['teachingUnits'][number],
  ): boolean {
    return teachingUnit.acceptableManifestations.some((manifestation) =>
      this.hasRequiredTeachingConcept(normalizedText, manifestation),
    );
  }

  private hasRequiredTeachingConcept(
    normalizedText: string,
    term: string,
  ): boolean {
    const normalizedTerm = this.expandClinicalShorthand(this.normalize(term));
    if (!normalizedTerm) {
      return true;
    }

    if (normalizedText.includes(normalizedTerm)) {
      return true;
    }

    const termTokens = normalizedTerm
      .split(' ')
      .filter((token) => !this.isCoverageStopword(token));
    if (!termTokens.length) {
      return true;
    }

    const hitCount = termTokens.filter((token) =>
      normalizedText.includes(token),
    ).length;
    const requiredHits = Math.min(
      termTokens.length,
      Math.max(1, Math.ceil(termTokens.length * 0.6)),
    );

    return hitCount >= requiredHits;
  }

  private expandClinicalShorthand(value: string): string {
    return value
      .replace(/\bwbc\b/g, 'white blood cell')
      .replace(/\brlq\b/g, 'right lower quadrant')
      .replace(/\bllq\b/g, 'left lower quadrant')
      .replace(/\bct\b/g, 'computed tomography')
      .replace(/\becg\b/g, 'electrocardiogram')
      .replace(/\bnpo\b/g, 'nothing by mouth');
  }

  private isCoverageStopword(token: string): boolean {
    return [
      'a',
      'an',
      'and',
      'before',
      'can',
      'does',
      'for',
      'from',
      'in',
      'of',
      'or',
      'the',
      'to',
      'with',
    ].includes(token);
  }

  private emptyCoverageScores(): EducationTeachingCoverageScores {
    return {
      differentials: 1,
      pitfalls: 1,
      findings: 1,
      investigations: 1,
      examMechanisms: 1,
      managementAnchors: 1,
      recallConcepts: 1,
      overall: 1,
    };
  }

  private scoreParts(parts: Array<boolean | string | null | undefined>): number {
    if (!parts.length) {
      return 0;
    }

    const hits = parts.filter(Boolean).length;
    return this.roundScore(hits / parts.length);
  }

  private average(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    return this.roundScore(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  private roundScore(value: number): number {
    return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
  }

  private textFrom(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.textFrom(item)).join(' ');
    }

    if (!value || typeof value !== 'object') {
      return '';
    }

    return Object.values(value)
      .map((item) => this.textFrom(item))
      .join(' ');
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private cleanString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private isGenericSeparator(text: string): boolean {
    const compact = text.toLowerCase().replace(/\s+/g, ' ').trim();
    return (
      GENERIC_SEPARATOR_PATTERN.test(compact) ||
      /\b(?:right[- ]sided diverticulitis|diverticulitis).{0,80}\b(?:imaging|ct).{0,40}\b(?:helps|can|may|differentiate|distinguish)\b/i.test(
        compact,
      )
    );
  }

  private isGenericWhyLayer(text: string): boolean {
    return (
      GENERIC_FILLER_PATTERNS.some((pattern) => pattern.test(text)) ||
      /\b(?:important|critical|useful|helpful|supports (?:the )?diagnosis|guides management|guides treatment)\b/i.test(
        text,
      )
    );
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
