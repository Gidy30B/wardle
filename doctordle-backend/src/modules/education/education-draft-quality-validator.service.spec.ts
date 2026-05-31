import { EducationDraftQualityValidator } from './education-draft-quality-validator.service';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';

describe('EducationDraftQualityValidator', () => {
  const rules = new EducationKnowledgeRulesService();
  const validator = new EducationDraftQualityValidator();

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
            mimic: 'Right-sided diverticulitis',
            whyConfused:
              'Both can cause right lower quadrant pain and inflammatory markers.',
            keySeparator:
              'CT imaging can help distinguish right-sided diverticulitis from appendicitis.',
            managementConsequence:
              'The distinction changes operative versus nonoperative planning.',
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
            test: 'CBC',
            content: 'Look for leukocytosis.',
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
            mimic: 'Gastroenteritis',
            whyConfused:
              'Both can cause abdominal pain, nausea, and vomiting early.',
            keySeparator:
              'Progressive right lower quadrant localization with rebound or guarding favors appendicitis, whereas diffuse cramping with prominent diarrhea favors gastroenteritis.',
            managementConsequence:
              'Missing this separator can delay surgical evaluation and increase perforation risk.',
          },
        ],
      }),
    });

    expect(result.warnings).not.toContain('differential_missing_key_separator');
    expect(result.warnings).not.toContain('differential_generic_separator');
    expect(result.sectionScores.differentials).toBeGreaterThanOrEqual(0.8);
  });

  it('passes a strong investigation', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        investigations: [
          {
            test: 'CBC',
            expectedFinding: 'Neutrophilic leukocytosis',
            interpretation:
              'Leukocytosis supports inflammation, but a normal WBC does not exclude early appendicitis.',
            limitation:
              'CBC is supportive rather than definitive and must be interpreted with evolving focal signs.',
          },
        ],
      }),
    });

    expect(result.warnings).not.toContain('investigation_missing_interpretation');
    expect(result.sectionScores.investigations).toBeGreaterThanOrEqual(0.8);
  });

  it('passes a strong exam pearl', () => {
    const result = validator.validate({
      draft: buildQualityDraft({
        examPearls: [
          {
            finding: 'Rovsing sign',
            mechanism:
              'Left-sided palpation produces right-sided pain because inflamed peritoneum is irritated across the abdomen.',
            diagnosticImpact:
              'This favors appendicitis over uncomplicated gastroenteritis.',
            discriminator:
              'Diffuse gastroenteritis should not produce focal contralateral peritoneal pain.',
          },
        ],
      }),
    });

    expect(result.warnings).not.toContain('exam_missing_mechanism');
    expect(result.warnings).not.toContain('exam_missing_diagnostic_impact');
    expect(result.sectionScores.examPearls).toBeGreaterThanOrEqual(0.8);
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
      },
    ],
    scoringSystems: [],
    investigations: [
      {
        id: 'imaging',
        type: 'INVESTIGATION',
        title: 'Targeted imaging',
        content:
          'Targeted imaging supports the diagnosis when it identifies anatomy-specific inflammation rather than nonspecific symptoms.',
        whyItMatters:
          'Imaging interpretation distinguishes focal disease from mimics.',
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
      },
    ],
    management: [
      {
        id: 'management-anchor',
        type: 'MANAGEMENT',
        title: 'Severity-based plan',
        content:
          'Use severity and diagnostic certainty to decide monitoring, imaging, consultation, and treatment urgency.',
        whyItMatters:
          'A concrete management anchor changes escalation rather than offering generic reassurance.',
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

function buildHighQualityAppendicitisDraft() {
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
          'Pregnancy testing helps distinguish appendicitis from ectopic pregnancy before imaging and operative planning.',
        whyItMatters:
          'The result changes diagnostic risk and imaging choices.',
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
          'Gastroenteritis favors diffuse cramping and diarrhea, unlike appendicitis which develops migratory focal right lower quadrant tenderness.',
        whyItMatters:
          'The contrast prevents anchoring on vomiting alone.',
        discriminator: 'Localized peritonism argues against gastroenteritis.',
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
          'Renal colic favors flank-to-groin pain and hematuria rather than progressive McBurney point tenderness or Rovsing sign.',
        whyItMatters:
          'Pain radiation and urine findings separate urinary from appendiceal pathology.',
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
          'Surgical consultation anchors management when exam, Alvarado score, or CT abdomen supports appendicitis rather than a benign mimic.',
        whyItMatters:
          'Early consultation changes timing of definitive care and reduces perforation risk.',
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
          'NPO status, IV fluids, and analgesia support operative readiness without masking meaningful peritoneal findings.',
        whyItMatters:
          'These anchors stabilize the patient while the diagnostic pathway is completed.',
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
  });
}
