import {
  detectEducationConceptDuplication,
  EducationDraftQualityValidator,
} from './education-draft-quality-validator.service';
import { EducationEditorialPatternsService } from './education-editorial-patterns.service';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';
import { EducationTeachingRulesService } from './education-teaching-rules.service';

describe('EducationDraftQualityValidator', () => {
  const rules = new EducationKnowledgeRulesService();
  const teachingRules = new EducationTeachingRulesService();
  const validator = new EducationDraftQualityValidator();

  it('does not warn when appendicitis RLQ tenderness is owned by key signs only', () => {
    const warnings = detectEducationConceptDuplication(
      buildQualityDraft({
        summary: {
          definition: 'Appendiceal inflammation.',
          highYieldTakeaway:
            'The key is an evolving surgical abdomen rather than a static diffuse illness.',
        },
        clinicalPattern: [
          {
            id: 'migration-flow',
            type: 'PATTERN_RECOGNITION',
            title: 'Migration flow',
            content:
              'Pain often begins near the umbilicus, then localizes as parietal peritoneal irritation develops and movement becomes uncomfortable.',
            whyItMatters:
              'The tempo separates evolving appendiceal inflammation from a static diffuse mimic.',
          },
        ],
        keySigns: [
          {
            finding: 'Focal right lower quadrant tenderness',
            whyItMatters:
              'Localization supports organ-specific irritation rather than diffuse illness.',
            diagnosticImpact: 'Raises suspicion for appendicitis.',
            discriminator: 'Diffuse tenderness is less specific.',
          },
        ],
        examPearls: [
          {
            id: 'rovsing-mechanism',
            type: 'EXAM',
            title: 'Rovsing sign',
            content:
              'Left-sided palpation produces contralateral pain because inflamed peritoneum is mechanically irritated across the abdomen.',
            whyItMatters:
              'Contralateral provocation adds a mechanism layer beyond simply naming the bedside sign.',
            discriminator:
              'Diffuse gastroenteritis should not produce focal contralateral peritoneal pain.',
          },
        ],
      }),
    );

    expect(warnings).not.toContain(
      'duplicate_concept_rlq_tenderness_in_summary_and_keySigns',
    );
    expect(warnings).not.toContain(
      'duplicate_concept_rlq_tenderness_in_clinicalPattern_and_keySigns',
    );
    expect(warnings).not.toContain(
      'duplicate_concept_rlq_tenderness_in_keySigns_and_examPearls',
    );
  });

  it('warns on duplicated clinical concepts without adding blockers', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        summary: {
          definition: 'Appendiceal inflammation.',
          highYieldTakeaway:
            'Focal RLQ tenderness is the key clue in this condition.',
        },
        keySigns: [
          {
            finding: 'Focal right lower quadrant tenderness',
            whyItMatters:
              'Localization supports organ-specific irritation rather than diffuse illness.',
            diagnosticImpact: 'Raises suspicion for appendicitis.',
            discriminator: 'Diffuse tenderness is less specific.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain(
      'duplicate_concept_rlq_tenderness_in_summary_and_keySigns',
    );
    expect(result.blockers).not.toContain(
      'duplicate_concept_rlq_tenderness_in_summary_and_keySigns',
    );
  });

  it('warns when scoring systems are repeated in exam pearls', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        examPearls: [
          {
            id: 'alvarado-exam-pearl',
            type: 'EXAM',
            title: 'Alvarado score',
            content:
              'Alvarado score groups bedside and laboratory features into an appendicitis risk estimate.',
            whyItMatters:
              'The score should guide probability rather than replace clinical judgment.',
            discriminator:
              'Low scores need reassessment when the story continues to evolve.',
          },
        ],
        scoringSystems: [
          {
            id: 'alvarado-score',
            name: 'Alvarado score',
            use: 'Risk stratifies suspected appendicitis using MANTRELS.',
            components: ['Migration', 'Anorexia', 'Nausea or vomiting'],
            caution:
              'Use alongside clinical judgment rather than as a standalone rule.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain(
      'duplicate_concept_alvarado_in_examPearls_and_scoringSystems',
    );
  });

  it('warns when management repeats the diagnostic pattern', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        clinicalPattern: [
          {
            id: 'migratory-pattern',
            type: 'PATTERN_RECOGNITION',
            title: 'Migratory pain',
            content:
              'Periumbilical pain migrating toward the RLQ reflects evolving peritoneal localization.',
            whyItMatters:
              'Migration separates appendicitis from a static diffuse mimic.',
          },
        ],
        management: [
          {
            id: 'pattern-based-consult',
            type: 'MANAGEMENT',
            title: 'Surgical consultation',
            content:
              'Request surgical consultation when periumbilical pain migrates toward the RLQ and clinical suspicion remains high.',
            whyItMatters:
              'Early source-control planning reduces delay when appendicitis remains likely.',
            managementImplication:
              'Coordinate reassessment, analgesia, and operative readiness.',
            escalationImplication:
              'Delayed consultation can increase perforation risk.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain(
      'duplicate_concept_migration_in_clinicalPattern_and_management',
    );
  });

  it('keeps legacy education shapes accepted by the validator', () => {
    const result = validator.validate({
      draft: {
        summary: 'Inflammation of the appendix.',
        clinicalPattern: [
          'Periumbilical pain can migrate to the right lower quadrant.',
        ],
        keySigns: ['McBurney point tenderness', 'Rovsing sign'],
        examPearls: [
          'Rovsing sign adds evidence of peritoneal irritation.',
        ],
        investigations: [
          'CBC can show leukocytosis but normal early WBC does not exclude disease.',
        ],
        differentials: [
          'Gastroenteritis has more diffuse cramping and diarrhea.',
        ],
        management: ['Surgical review when suspicion remains high.'],
        pitfalls: ['Normal early labs can falsely reassure.'],
        recallPrompts: [
          {
            prompt: 'Why does migration matter?',
            answer: 'It reflects localizing peritoneal irritation.',
          },
        ],
      },
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.scores.graphReadinessScore).toBeGreaterThanOrEqual(0);
  });

  it('warns when appendicitis draft misses expected named signs', () => {
    const result = validator.validate({
      guidance: rules.getGuidance({ canonicalName: 'appendicitis' }),
      draft: buildQualityDraft({
        keySigns: [
          {
            finding: 'Focal right lower quadrant tenderness',
            whyItMatters:
              'Focal tenderness supports appendiceal irritation over diffuse gastroenteritis.',
          },
        ],
        examPearls: [
          {
            id: 'rlq-tenderness',
            type: 'EXAM',
            title: 'RLQ tenderness',
            content:
              'Localized right lower quadrant tenderness supports appendicitis over diffuse gastroenteritis when pain has migrated from the periumbilical area.',
            whyItMatters:
              'Localization raises concern for parietal peritoneal irritation.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('missing_expected_named_signs');
  });

  it('warns when DKA draft misses acidosis, ketones, and potassium traps', () => {
    const result = validator.validate({
      guidance: rules.getGuidance({ canonicalName: 'diabetic ketoacidosis' }),
      draft: buildQualityDraft({
        investigations: [
          {
            id: 'glucose',
            type: 'INVESTIGATION',
            title: 'Glucose',
            content:
              'Marked hyperglycemia supports a metabolic emergency over isolated dehydration.',
            whyItMatters:
              'Glucose severity changes monitoring intensity and fluid planning.',
          },
        ],
        pitfalls: [
          {
            id: 'generic-dka-trap',
            type: 'PITFALL',
            title: 'Generic trap',
            content:
              'Symptoms can look nonspecific early and require careful reassessment.',
            whyItMatters:
              'Nonspecific symptoms can delay recognition of metabolic illness.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('missing_expected_investigations');
    expect(result.warnings).toContain('missing_expected_pitfalls');
  });

  it('warns when pneumonia draft misses consolidation and comparative mimic reasoning', () => {
    const result = validator.validate({
      guidance: rules.getGuidance({ canonicalName: 'pneumonia' }),
      draft: buildQualityDraft({
        investigations: [
          {
            id: 'cbc',
            type: 'INVESTIGATION',
            title: 'CBC',
            content:
              'Leukocytosis supports infection but does not localize the source without respiratory or imaging evidence.',
            whyItMatters:
              'A nonspecific inflammatory marker should not replace source localization.',
          },
        ],
        differentials: [
          {
            id: 'bronchitis',
            type: 'HIGH_YIELD_DISCRIMINATOR',
            title: 'Acute bronchitis',
            content:
              'Acute bronchitis can cause cough and systemic symptoms in outpatient respiratory illness.',
            whyItMatters:
              'Respiratory symptoms overlap and require clinical judgment.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('missing_expected_investigations');
    expect(result.warnings).toContain('weak_comparative_differential_quality');
  });

  it('warns for differential items without explicit comparison language', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        differentials: [
          {
            id: 'gastroenteritis',
            type: 'HIGH_YIELD_DISCRIMINATOR',
            title: 'Gastroenteritis',
            content:
              'Gastroenteritis has abdominal pain, nausea, vomiting, and diarrhea in many patients.',
            whyItMatters:
              'The clinical overlap makes it a common alternative diagnosis.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('weak_comparative_differential_quality');
  });

  it('warns when weak gastroenteritis differential lacks a key separator', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        differentials: [
          {
            mimic: 'Gastroenteritis',
            whyConfused:
              'Both can cause abdominal pain, nausea, and vomiting.',
            content:
              'Gastroenteritis is characterized by diarrhea, unlike appendicitis.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('differential_missing_key_separator');
  });

  it('warns when right-sided diverticulitis separator is generic imaging language', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        differentials: [
          {
            id: 'right-sided-diverticulitis',
            type: 'HIGH_YIELD_DISCRIMINATOR',
            title: 'Right-sided diverticulitis',
            content:
              'Both can cause right lower quadrant pain and inflammatory markers.',
            discriminator:
              'CT imaging can help distinguish right-sided diverticulitis from appendicitis.',
            managementImplication:
              'The distinction changes operative versus nonoperative planning.',
            whyItMatters:
              'The overlap can misdirect early management before focal imaging is interpreted.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('differential_generic_separator');
  });

  it('warns for investigations without interpretation', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        investigations: [
          {
            id: 'cbc',
            type: 'INVESTIGATION',
            title: 'CBC',
            content: 'Order a complete blood count for suspected disease.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('weak_investigation_interpretation');
  });

  it('warns when CBC only says to look for leukocytosis', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        investigations: [
          {
            id: 'cbc',
            type: 'INVESTIGATION',
            title: 'CBC',
            content: 'Order CBC to evaluate suspected disease.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('investigation_missing_expected_finding');
    expect(result.warnings).toContain('investigation_missing_interpretation');
    expect(result.warnings).toContain('investigation_vague_test_usefulness');
  });

  it('warns when Rovsing or McBurney exam pearls omit mechanism', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        examPearls: [
          {
            finding: 'McBurney point tenderness',
            diagnosticImpact: 'Raises suspicion for appendicitis.',
          },
          {
            finding: 'Rovsing sign',
            diagnosticImpact:
              'Favors appendicitis over uncomplicated gastroenteritis.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('exam_missing_mechanism');
  });

  it('warns for generic whyItMatters prose', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        examPearls: [
          {
            id: 'exam',
            type: 'EXAM',
            title: 'Physical examination',
            content:
              'A careful physical examination may reveal findings that are clinically important.',
            whyItMatters:
              'Important for early diagnosis and guides management.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('generic_filler_detected');
  });

  it('scores a high-quality appendicitis draft as graph-ready', () => {
    const result = validator.validate({
      guidance: rules.getGuidance({ canonicalName: 'appendicitis' }),
      draft: buildHighQualityAppendicitisDraft(),
    });

    expect(result.scores.graphReadinessScore).toBeGreaterThanOrEqual(0.85);
    expect(result.warnings).not.toContain('low_graph_readiness');
    expect(result.warnings).not.toContain('missing_expected_named_signs');
    expect(result.warnings).not.toContain('weak_comparative_differential_quality');
  });

  it('passes a strong differential', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        differentials: [
          {
            id: 'gastroenteritis',
            type: 'HIGH_YIELD_DISCRIMINATOR',
            title: 'Gastroenteritis',
            content:
              'Both can cause abdominal pain, nausea, and vomiting early, but progressive right lower quadrant localization with guarding favors appendicitis whereas diffuse cramps with diarrhea favor gastroenteritis.',
            whyItMatters:
              'This overlap makes vomiting an unsafe anchor unless localization and peritoneal findings are tracked.',
            discriminator:
              'Progressive RLQ guarding rather than diffuse cramping with prominent diarrhea.',
            managementImplication:
              'Missing this separator can delay surgical evaluation and increase perforation risk.',
            escalationImplication: null,
            trapAvoided:
              'Anchoring on gastroenteritis when focal peritoneal signs emerge.',
          },
        ],
      }),
    });

    expect(result.warnings).not.toContain('differential_missing_key_separator');
    expect(result.warnings).not.toContain('differential_generic_separator');
    expect(result.sectionScores.differentials).toBeGreaterThanOrEqual(0.8);
    expect(result.patternComplianceScores.differential).toBeGreaterThanOrEqual(
      0.8,
    );
  });

  it('passes a strong investigation', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        investigations: [
          {
            id: 'cbc',
            type: 'INVESTIGATION',
            title: 'CBC',
            content:
              'CBC may show neutrophilic leukocytosis as supportive evidence of appendiceal inflammation.',
            whyItMatters:
              'Leukocytosis supports inflammation, but a normal WBC does not exclude early appendicitis.',
            discriminator: null,
            managementImplication:
              'CBC is supportive rather than definitive and must be interpreted with evolving focal signs.',
            escalationImplication: null,
            trapAvoided: 'Treating a normal early WBC as reassuring.',
          },
        ],
      }),
    });

    expect(result.warnings).not.toContain('investigation_missing_interpretation');
    expect(result.sectionScores.investigations).toBeGreaterThanOrEqual(0.8);
    expect(result.patternComplianceScores.investigation).toBe(1);
  });

  it('passes a strong exam pearl', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        examPearls: [
          {
            id: 'rovsing-sign',
            type: 'EXAM',
            title: 'Rovsing sign',
            content:
              'Left-sided palpation produces right-sided pain because inflamed peritoneum is irritated across the abdomen.',
            whyItMatters:
              'This favors appendicitis over uncomplicated gastroenteritis.',
            discriminator:
              'Diffuse gastroenteritis should not produce focal contralateral peritoneal pain.',
            managementImplication: null,
            escalationImplication: null,
            trapAvoided: null,
          },
        ],
      }),
    });

    expect(result.warnings).not.toContain('exam_missing_mechanism');
    expect(result.warnings).not.toContain('exam_missing_diagnostic_impact');
    expect(result.sectionScores.examPearls).toBeGreaterThanOrEqual(0.8);
  });

  it('recognizes a strong management anchor pattern', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        management: [
          {
            id: 'early-surgical-consult',
            type: 'MANAGEMENT',
            title: 'Early surgical consultation',
            content:
              'Request early surgical consultation when focal peritonism or high clinical suspicion suggests appendicitis.',
            whyItMatters:
              'Source control planning is needed because appendiceal inflammation can progress to perforation.',
            discriminator: null,
            managementImplication:
              'Keep the patient NPO and align imaging, analgesia, and operative planning.',
            escalationImplication:
              'Delay increases perforation risk and broadens operative complexity.',
            trapAvoided: null,
          },
        ],
      }),
    });

    expect(result.warnings).not.toContain('management_missing_indication');
    expect(result.patternComplianceScores.managementAnchor).toBe(1);
  });

  it('uses schema-compatible editorial pattern examples', () => {
    const service = new EducationEditorialPatternsService();
    const forbiddenKeys = [
      'whyConfused',
      'keySeparator',
      'managementConsequence',
      'expectedFinding',
      'interpretation',
      'limitation',
      'mechanism',
      'diagnosticImpact',
      'indication',
      'rationale',
      'consequenceIfDelayed',
      'saferHeuristic',
    ];

    for (const pattern of service.getPromptGuidance()) {
      for (const key of forbiddenKeys) {
        expect(pattern.goodExample).not.toHaveProperty(key);
      }
    }
  });

  it('gives a high-quality appendicitis draft improved section scores', () => {
    const result = validator.validate({
      guidance: rules.getGuidance({ canonicalName: 'appendicitis' }),
      draft: buildHighQualityAppendicitisDraft(),
    });

    expect(result.sectionScores).toEqual(
      expect.objectContaining({
        differentials: expect.any(Number),
        investigations: expect.any(Number),
        examPearls: expect.any(Number),
        pitfalls: expect.any(Number),
        management: expect.any(Number),
        recallPrompts: expect.any(Number),
      }),
    );
    expect(result.sectionScores.differentials).toBeGreaterThanOrEqual(0.8);
    expect(result.sectionScores.investigations).toBeGreaterThanOrEqual(0.8);
    expect(result.sectionScores.examPearls).toBeGreaterThanOrEqual(0.8);
  });

  it('warns when appendicitis is missing required gastroenteritis and renal colic comparisons', () => {
    const result = validator.validate({
      teachingRules: teachingRules.getRules({ canonicalName: 'appendicitis' }),
      draft: buildHighQualityAppendicitisDraft({
        differentials: [
          {
            mimic: 'Ectopic pregnancy',
            whyConfused:
              'Both can cause lower abdominal pain in patients who can become pregnant.',
            keySeparator:
              'Positive pregnancy testing and adnexal features favor ectopic pregnancy rather than appendicitis.',
            managementConsequence:
              'The distinction changes imaging sequence and gynecology involvement.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('missing_required_differential');
    expect(result.coverageWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_required_differential',
          item: 'Gastroenteritis discriminator',
          section: 'differentials',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'missing_required_differential',
          item: 'Renal colic discriminator',
        }),
      ]),
    );
    expect(result.coverageScores.differentials).toBeLessThan(1);
  });

  it('warns when DKA is missing the required potassium pitfall', () => {
    const result = validator.validate({
      teachingRules: teachingRules.getRules({
        canonicalName: 'diabetic ketoacidosis',
      }),
      draft: buildQualityDraft({
        investigations: [
          {
            test: 'Venous blood gas',
            expectedFinding: 'Metabolic acidosis with low bicarbonate.',
            interpretation:
              'Acidosis supports DKA rather than uncomplicated hyperglycemia.',
            limitation:
              'Severity must be interpreted alongside anion gap and mental status.',
          },
          {
            test: 'Blood ketones',
            expectedFinding: 'Elevated beta-hydroxybutyrate.',
            interpretation:
              'Ketones distinguish DKA from isolated dehydration or stress hyperglycemia.',
            limitation:
              'Urine ketones can lag behind clinical improvement.',
          },
        ],
        pitfalls: [
          {
            trap: 'Missing infection trigger',
            whyMissed:
              'Vomiting and dehydration can distract from the precipitating source.',
            consequence:
              'Untreated infection can sustain acidosis and clinical instability.',
            saferHeuristic:
              'Search for infection or missed insulin while correcting the metabolic emergency.',
          },
        ],
      }),
    });

    expect(result.warnings).toContain('missing_required_pitfall');
    expect(result.coverageWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_required_pitfall',
          item: 'Potassium before insulin',
          section: 'pitfalls',
          severity: 'warning',
        }),
      ]),
    );
    expect(result.coverageScores.pitfalls).toBeLessThan(1);
  });

  it('allows different DKA manifestations to satisfy the same teaching unit', () => {
    const result = validator.validate({
      teachingRules: teachingRules.getRules({
        canonicalName: 'diabetic ketoacidosis',
      }),
      draft: buildQualityDraft({
        investigations: [
          {
            test: 'Venous blood gas and beta-hydroxybutyrate',
            expectedFinding:
              'Low bicarbonate with elevated beta-hydroxybutyrate and an anion gap.',
            interpretation:
              'Blood ketones with metabolic acidosis distinguish DKA from isolated hyperglycemia or HHS.',
            limitation:
              'Severity still depends on mental status, potassium, and perfusion.',
          },
        ],
        examPearls: [
          {
            finding: 'Deep labored breathing',
            mechanism:
              'Deep labored breathing reflects respiratory compensation for metabolic acidosis.',
            diagnosticImpact:
              'This supports DKA over uncomplicated dehydration.',
          },
        ],
        management: [
          {
            action: 'Check potassium before insulin',
            indication:
              'Suspected DKA with acidosis and dehydration.',
            rationale:
              'Insulin shifts potassium intracellularly, so normal serum potassium may hide total body depletion.',
            consequenceIfDelayed:
              'Starting insulin before potassium safety can precipitate dangerous hypokalemia.',
          },
          {
            action: 'Initial isotonic fluids',
            indication: 'Hypovolemia from osmotic diuresis.',
            rationale:
              'Fluids restore perfusion before insulin is layered in safely.',
            consequenceIfDelayed:
              'Poor perfusion delays correction of the metabolic emergency.',
          },
        ],
        differentials: [
          {
            mimic: 'Hyperosmolar hyperglycemic state',
            whyConfused:
              'Both can cause severe hyperglycemia and dehydration.',
            keySeparator:
              'Ketosis with acidosis favors DKA, whereas hyperosmolarity without marked ketones favors HHS.',
            managementConsequence:
              'The distinction changes insulin timing and electrolyte monitoring intensity.',
          },
        ],
      }),
    });

    expect(result.coverageWarnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item: 'Potassium before insulin' }),
        expect.objectContaining({
          item: 'Respiratory compensation for metabolic acidosis',
        }),
      ]),
    );
    expect(result.coverageScores.managementAnchors).toBe(1);
    expect(result.coverageScores.examMechanisms).toBe(1);
  });

  it('allows appendicitis peritoneal irritation through alternative manifestations', () => {
    const result = validator.validate({
      teachingRules: teachingRules.getRules({ canonicalName: 'appendicitis' }),
      draft: buildHighQualityAppendicitisDraft({
        examPearls: [
          {
            finding: 'Guarding',
            mechanism:
              'Guarding reflects peritoneal irritation as localized appendiceal inflammation involves the parietal peritoneum.',
            diagnosticImpact:
              'This favors appendicitis over uncomplicated gastroenteritis.',
            discriminator:
              'Diffuse cramps should not produce focal guarding or rebound.',
          },
        ],
      }),
    });

    expect(result.coverageWarnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item: 'Peritoneal irritation' }),
      ]),
    );
  });

  it('passes required teaching coverage for a strong appendicitis draft', () => {
    const result = validator.validate({
      guidance: rules.getGuidance({ canonicalName: 'appendicitis' }),
      teachingRules: teachingRules.getRules({ canonicalName: 'appendicitis' }),
      draft: buildHighQualityAppendicitisDraft(),
    });

    expect(result.warnings).not.toContain('missing_required_differential');
    expect(result.warnings).not.toContain('missing_required_pitfall');
    expect(result.warnings).not.toContain('missing_required_exam_mechanism');
    expect(result.warnings).not.toContain('missing_required_investigation');
    expect(result.warnings).not.toContain(
      'missing_required_management_anchor',
    );
    expect(result.warnings).not.toContain('missing_required_recall_concept');
    expect(result.coverageWarnings).toEqual([]);
    expect(result.coverageScores.overall).toBe(1);
  });
});

function buildQualityDraft(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      definition: 'Diagnosis-level education draft.',
      highYieldTakeaway: 'Reasoning and discriminators matter.',
    },
    clinicalPattern: [
      {
        id: 'pattern',
        type: 'PATTERN_RECOGNITION',
        title: 'Pattern',
        content:
          'Progressive focal symptoms support the target diagnosis rather than a diffuse self-limited syndrome.',
        whyItMatters:
          'Tempo and localization change diagnostic probability and urgency.',
      },
    ],
    keySymptoms: [
      {
        finding: 'Progressive focal pain',
        whyItMatters:
          'Progression favors a localized inflammatory process over transient cramps.',
        diagnosticImpact: 'Raises suspicion for the target diagnosis.',
        discriminator: 'Diffuse symptoms argue against a focal process.',
      },
    ],
    keySigns: [
      {
        finding: 'Focal tenderness',
        whyItMatters:
          'Localization supports organ-specific irritation rather than diffuse illness.',
        diagnosticImpact: 'Raises suspicion for the target diagnosis.',
        discriminator: 'Diffuse tenderness is less specific.',
      },
    ],
    examPearls: [
      {
        id: 'exam-pearl',
        type: 'EXAM',
        title: 'Focused bedside sign',
        content:
          'A focused bedside sign supports local pathology over a diffuse mimic when it reproduces the expected anatomic pain pattern.',
        whyItMatters:
          'Anatomic reproduction changes probability and avoids nonspecific symptom anchoring.',
        discriminator:
          'Reproduced anatomic pain rather than diffuse symptom reporting.',
      },
    ],
    scoringSystems: [],
    investigations: [
      {
        id: 'imaging',
        type: 'INVESTIGATION',
        title: 'Targeted imaging',
        content:
          'Targeted imaging showing anatomy-specific inflammation supports the diagnosis rather than nonspecific symptoms.',
        whyItMatters:
          'Imaging interpretation distinguishes focal disease from mimics.',
        managementImplication:
          'Use the result to decide reassessment, consultation, or alternate workup.',
      },
    ],
    differentials: [
      {
        id: 'mimic',
        type: 'HIGH_YIELD_DISCRIMINATOR',
        title: 'Common mimic',
        content:
          'The mimic may overlap early, unlike the target diagnosis which develops localizing signs and a more specific progression.',
        whyItMatters:
          'Explicit contrast prevents anchoring on shared symptoms.',
        discriminator:
          'Localizing progression rather than persistent diffuse symptoms.',
        managementImplication:
          'Escalate evaluation when the localizing pattern emerges.',
      },
    ],
    management: [
      {
        id: 'management-anchor',
        type: 'MANAGEMENT',
        title: 'Severity-based plan',
        content:
          'Use severity and diagnostic certainty when deciding monitoring, imaging, consultation, and treatment urgency.',
        whyItMatters:
          'A concrete management anchor changes escalation rather than offering generic reassurance.',
        managementImplication:
          'Tie each next step to a finding, risk threshold, or diagnostic uncertainty.',
        escalationImplication:
          'Delayed escalation can miss the window for safer definitive care.',
      },
    ],
    complications: ['Delayed recognition can increase morbidity.'],
    pitfalls: [
      {
        id: 'pitfall',
        type: 'PITFALL',
        title: 'False reassurance',
        content:
          'A normal early test can be falsely reassuring when symptoms are evolving before objective findings peak.',
        whyItMatters:
          'The trap delays reassessment and increases missed-diagnosis risk.',
        trapAvoided:
          'Reassess the clinical trajectory instead of ruling out disease from one early normal test.',
      },
    ],
    recallPrompts: [
      {
        id: 'why-it-matters',
        type: 'WHY_IT_MATTERS',
        prompt: 'Why does progression change diagnostic probability?',
        answer:
          'Progression supports evolving focal pathology rather than a static nonspecific complaint.',
        explanation:
          'Reasoning from tempo helps distinguish target disease from mimics.',
        linkedConcept: 'tempo',
        sourceSection: 'clinicalPattern',
        difficulty: 'INTERMEDIATE',
      },
    ],
    references: ['Educational source label'],
    ...overrides,
  };
}

function buildHighQualityAppendicitisDraft(
  overrides: Record<string, unknown> = {},
) {
  return buildQualityDraft({
    clinicalPattern: [
      {
        id: 'appendicitis-illness-script',
        type: 'PATTERN_RECOGNITION',
        title: 'Classic illness script',
        content:
          'Migratory periumbilical pain to right lower quadrant tenderness favors appendicitis because visceral irritation localizes as parietal peritoneum becomes inflamed.',
        whyItMatters:
          'The tempo distinguishes appendicitis from diffuse gastroenteritis.',
      },
    ],
    keySigns: [
      {
        finding: 'McBurney point tenderness',
        whyItMatters:
          'McBurney point tenderness supports local appendiceal irritation over diffuse abdominal pain.',
        diagnosticImpact: 'Raises suspicion for appendicitis.',
        discriminator: 'Diffuse tenderness argues against classic appendicitis.',
      },
      {
        finding: 'Rovsing sign',
        whyItMatters:
          'Rovsing sign supports peritoneal irritation rather than uncomplicated gastroenteritis.',
        diagnosticImpact: 'Raises concern for appendicitis.',
        discriminator: 'Gastroenteritis is less likely to produce focal peritonism.',
      },
      {
        finding: 'Psoas sign',
        whyItMatters:
          'Psoas sign favors retrocecal appendicitis when hip extension reproduces pain.',
        diagnosticImpact: 'Supports atypical anatomic location.',
        discriminator: 'Renal colic does not typically follow this maneuver.',
      },
    ],
    examPearls: [
      {
        id: 'appendicitis-rovsing',
        type: 'EXAM',
        title: 'Rovsing sign',
        finding: 'Rovsing sign',
        content:
          'Right lower quadrant pain during left lower quadrant palpation supports peritoneal irritation and favors appendicitis over diffuse gastroenteritis.',
        mechanism:
          'Left lower quadrant palpation produces right lower quadrant pain because inflamed peritoneum is irritated.',
        diagnosticImpact:
          'Favors appendicitis over diffuse gastroenteritis when symptoms are localizing.',
        discriminator:
          'Diffuse gastroenteritis should not reproduce focal contralateral peritoneal pain.',
        managementImplication: null,
        escalationImplication: null,
        trapAvoided: null,
        whyItMatters:
          'Contralateral provocation turns vague abdominal pain into localizing peritoneal evidence.',
      },
      {
        id: 'appendicitis-psoas',
        type: 'EXAM',
        title: 'Psoas sign',
        finding: 'Psoas sign',
        content:
          'Pain with hip extension favors retrocecal appendicitis rather than isolated bowel cramps because the inflamed appendix irritates the psoas muscle.',
        mechanism:
          'Hip extension stretches the psoas and produces pain because a retrocecal inflamed appendix irritates the muscle.',
        diagnosticImpact:
          'Favors retrocecal appendicitis when anterior McBurney tenderness is muted.',
        discriminator:
          'Isolated bowel cramps should not be provoked by hip extension.',
        managementImplication: null,
        escalationImplication: null,
        trapAvoided: null,
        whyItMatters:
          'The maneuver prevents false reassurance when McBurney tenderness is muted.',
      },
    ],
    scoringSystems: [
      {
        id: 'alvarado-score',
        name: 'Alvarado score',
        use: 'Risk stratifies suspected appendicitis using MANTRELS features.',
        components: ['Migration', 'Anorexia', 'Nausea or vomiting'],
        caution:
          'Use alongside clinical judgment and imaging rather than as a standalone rule.',
      },
    ],
    investigations: [
      {
        id: 'cbc',
        type: 'INVESTIGATION',
        title: 'CBC',
        test: 'CBC',
        expectedFinding: 'Neutrophilic leukocytosis.',
        interpretation:
          'Leukocytosis supports appendiceal inflammation when paired with migratory focal pain.',
        limitation:
          'A normal early white blood cell count does not exclude appendicitis.',
        content:
          'CBC showing neutrophilic leukocytosis supports appendiceal inflammation when paired with migratory focal pain.',
        whyItMatters:
          'A normal early white blood cell count should not override evolving peritoneal signs.',
        discriminator: null,
        managementImplication:
          'Interpret CBC as supportive evidence and keep reassessing focal signs.',
        escalationImplication: null,
        trapAvoided:
          'Treating a normal early white blood cell count as exclusionary.',
      },
      {
        id: 'ct-abdomen',
        type: 'INVESTIGATION',
        title: 'CT abdomen',
        test: 'CT abdomen',
        expectedFinding:
          'Appendiceal enlargement with periappendiceal inflammation.',
        interpretation:
          'Anatomy-specific inflammation supports appendicitis over renal colic or gastroenteritis.',
        limitation:
          'CT should be balanced against pregnancy status and radiation exposure.',
        content:
          'CT abdomen showing appendiceal enlargement or periappendiceal inflammation supports appendicitis over renal colic or gastroenteritis.',
        whyItMatters:
          'Imaging interpretation confirms anatomy-specific inflammation when bedside findings are equivocal.',
        discriminator: null,
        managementImplication:
          'Use anatomy-specific inflammation to align surgical consultation and operative planning.',
        escalationImplication: null,
        trapAvoided:
          'Using nonspecific abdominal symptoms instead of anatomy-specific imaging findings.',
      },
      {
        id: 'pregnancy-test',
        type: 'INVESTIGATION',
        title: 'Pregnancy test',
        test: 'Pregnancy test',
        expectedFinding:
          'Positive or negative pregnancy status before imaging choices.',
        interpretation:
          'A positive result raises concern for ectopic pregnancy and changes imaging or operative planning.',
        limitation:
          'A negative test does not exclude appendicitis or other non-gynecologic mimics.',
        content:
          'Pregnancy testing showing positive or negative status helps distinguish appendicitis from ectopic pregnancy before imaging and operative planning.',
        whyItMatters:
          'The result changes diagnostic risk and imaging choices.',
        discriminator: null,
        managementImplication:
          'Use pregnancy status to choose safer imaging and gynecology involvement when appropriate.',
        escalationImplication: null,
        trapAvoided:
          'Missing ectopic pregnancy in a patient with right lower quadrant pain.',
      },
    ],
    differentials: [
      {
        id: 'gastroenteritis',
        type: 'HIGH_YIELD_DISCRIMINATOR',
        title: 'Gastroenteritis',
        mimic: 'Gastroenteritis',
        whyConfused:
          'Both can cause abdominal pain, nausea, and vomiting early.',
        keySeparator:
          'Migratory focal right lower quadrant tenderness with peritonism favors appendicitis, whereas diffuse cramping with prominent diarrhea favors gastroenteritis.',
        managementConsequence:
          'Peritoneal signs should prompt surgical evaluation rather than hydration-only management.',
        content:
          'Both can cause early abdominal pain and vomiting, but gastroenteritis favors diffuse cramping and diarrhea unlike appendicitis which develops migratory focal right lower quadrant tenderness.',
        whyItMatters:
          'The contrast prevents anchoring on vomiting alone.',
        discriminator:
          'Localized peritonism rather than diffuse cramping with diarrhea.',
        managementImplication:
          'Peritoneal signs should prompt surgical evaluation rather than hydration-only management.',
        escalationImplication: null,
        trapAvoided:
          'Anchoring on gastroenteritis when focal peritoneal signs emerge.',
      },
      {
        id: 'renal-colic',
        type: 'HIGH_YIELD_DISCRIMINATOR',
        title: 'Renal colic',
        mimic: 'Renal colic',
        whyConfused:
          'Both can present with severe right-sided abdominal pain.',
        keySeparator:
          'Flank-to-groin radiation and hematuria favor renal colic, whereas McBurney tenderness and Rovsing sign favor appendicitis.',
        managementConsequence:
          'Separating urinary obstruction from appendiceal inflammation changes imaging, analgesia, and surgical urgency.',
        content:
          'Both can cause severe right-sided abdominal pain, but renal colic favors flank-to-groin pain and hematuria rather than progressive McBurney point tenderness or Rovsing sign.',
        whyItMatters:
          'Pain radiation and urine findings separate urinary from appendiceal pathology.',
        discriminator:
          'Flank-to-groin radiation and hematuria rather than McBurney tenderness or Rovsing sign.',
        managementImplication:
          'Separating urinary obstruction from appendiceal inflammation changes imaging, analgesia, and surgical urgency.',
        escalationImplication: null,
        trapAvoided:
          'Treating appendiceal peritonism as urinary colic without reassessment.',
      },
    ],
    management: [
      {
        id: 'surgical-consult',
        type: 'MANAGEMENT',
        title: 'Surgical consultation',
        action: 'Surgical consultation',
        indication:
          'Focal peritonism, supportive Alvarado score, or CT evidence of appendicitis.',
        rationale:
          'Early surgical assessment aligns diagnostic certainty with definitive source control.',
        consequenceIfDelayed:
          'Delay increases perforation and abscess risk.',
        content:
          'Request surgical consultation when exam, Alvarado score, or CT abdomen supports appendicitis rather than a benign mimic.',
        whyItMatters:
          'Early consultation changes timing of definitive care and reduces perforation risk.',
        discriminator: null,
        managementImplication:
          'Coordinate NPO status, imaging interpretation, analgesia, and operative planning.',
        escalationImplication:
          'Delay increases perforation and abscess risk.',
        trapAvoided: null,
      },
      {
        id: 'npo-fluids-analgesia',
        type: 'MANAGEMENT',
        title: 'NPO, fluids, and analgesia',
        action: 'NPO status, IV fluids, and analgesia',
        indication:
          'Suspected appendicitis while awaiting imaging, reassessment, or operative planning.',
        rationale:
          'Stabilizes hydration and pain while preserving readiness for operative care.',
        consequenceIfDelayed:
          'Poor preparation can slow definitive care if appendicitis is confirmed.',
        content:
          'Use NPO status, IV fluids, and analgesia when suspected appendicitis is awaiting imaging, reassessment, or operative planning.',
        whyItMatters:
          'These anchors stabilize the patient while the diagnostic pathway is completed.',
        discriminator: null,
        managementImplication:
          'Preserve operative readiness while continuing serial abdominal exams.',
        escalationImplication:
          'Poor preparation can slow definitive care if appendicitis is confirmed.',
        trapAvoided: null,
      },
    ],
    pitfalls: [
      {
        id: 'normal-wbc',
        type: 'PITFALL',
        title: 'Normal early white count',
        trap: 'Normal early white count',
        whyMissed:
          'Clinicians may over-weight a normal CBC before inflammatory markers rise.',
        consequence:
          'False reassurance delays reassessment and can increase perforation risk.',
        saferHeuristic:
          'Reassess evolving focal tenderness even when early labs are normal.',
        content:
          'A normal white blood cell count early can falsely reassure when migratory pain and peritoneal signs are evolving.',
        whyItMatters:
          'The trap delays reassessment and can increase perforation risk.',
        trapAvoided:
          'Reassess evolving focal tenderness even when early labs are normal.',
      },
      {
        id: 'retrocecal-appendix',
        type: 'PITFALL',
        title: 'Retrocecal appendix',
        trap: 'Retrocecal appendix',
        whyMissed:
          'Anterior guarding may be muted when the inflamed appendix sits retrocecally.',
        consequence:
          'A limited exam can miss appendicitis and delay imaging or surgical review.',
        saferHeuristic:
          'Use psoas irritation and pain progression when classic McBurney tenderness is absent.',
        content:
          'Retrocecal appendicitis can mute McBurney tenderness and produce psoas irritation rather than classic anterior guarding.',
        whyItMatters:
          'Atypical anatomy prevents false reassurance from an incomplete abdominal exam.',
        trapAvoided:
          'Use psoas irritation and pain progression when classic McBurney tenderness is absent.',
      },
    ],
    recallPrompts: [
      {
        id: 'distinguish-gastroenteritis',
        type: 'DISTINGUISH',
        prompt:
          'What feature favors appendicitis rather than gastroenteritis?',
        answer:
          'Migratory pain with focal right lower quadrant peritonism favors appendicitis.',
        explanation:
          'Localized peritoneal signs distinguish appendicitis from diffuse diarrheal illness.',
        linkedConcept: 'differential discriminator',
        sourceSection: 'differentials',
        difficulty: 'INTERMEDIATE',
      },
      {
        id: 'why-normal-wbc',
        type: 'WHY_IT_MATTERS',
        prompt: 'Why should a normal early WBC not end the workup?',
        answer:
          'Early appendicitis can precede leukocytosis, so evolving focal signs still matter.',
        explanation:
          'This avoids false reassurance and supports reassessment.',
        linkedConcept: 'pitfall',
        sourceSection: 'pitfalls',
        difficulty: 'INTERMEDIATE',
      },
    ],
    ...overrides,
  });
}
