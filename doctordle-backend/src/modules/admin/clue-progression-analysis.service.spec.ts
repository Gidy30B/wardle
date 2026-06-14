import { ClueProgressionAnalysisService } from './clue-progression-analysis.service';

describe('ClueProgressionAnalysisService', () => {
  let service: ClueProgressionAnalysisService;

  beforeEach(() => {
    service = new ClueProgressionAnalysisService();
  });

  it('flags leak-at-clue-1 when the answer appears immediately', () => {
    const analysis = service.analyze({
      caseId: 'case-leak',
      diagnosisName: 'Appendicitis',
      clues: [
        {
          type: 'history',
          value: 'Classic appendicitis with migratory right lower quadrant pain.',
          order: 0,
        },
        { type: 'lab', value: 'Leukocytosis with neutrophilia.', order: 1 },
      ],
      differentials: ['Ovarian torsion', 'Gastroenteritis'],
    });

    expect(analysis.likelyLockInClue).toBe(1);
    expect(analysis.prematureLeakFlag).toBe(true);
    expect(analysis.editorialSignals).toEqual(
      expect.arrayContaining(['premature_lock_in', 'abrupt_giveaway']),
    );
    expect(analysis.diagnosticStates[0]).toEqual(
      expect.objectContaining({
        prematureLeakFlag: true,
        progressionQuality: 'weak',
      }),
    );
  });

  it('flags unresolved ambiguity when mimics survive the final clue', () => {
    const analysis = service.analyze({
      caseId: 'case-ambiguous',
      diagnosisName: 'Cholecystitis',
      clues: [
        { type: 'history', value: 'Abdominal pain after a meal.', order: 0 },
        { type: 'history', value: 'Nausea and malaise.', order: 1 },
        { type: 'exam', value: 'Mild diffuse tenderness.', order: 2 },
      ],
      differentials: ['Pancreatitis', 'Peptic ulcer disease', 'Hepatitis'],
    });

    expect(analysis.unresolvedAmbiguityFlag).toBe(true);
    expect(analysis.remainingMimics.length).toBeGreaterThan(0);
    expect(analysis.editorialSignals).toEqual(
      expect.arrayContaining(['unresolved_mimic', 'insufficient_discrimination']),
    );
  });

  it('flags weak mid clues that do not shift diagnostic confidence', () => {
    const analysis = service.analyze({
      caseId: 'case-weak-mid',
      diagnosisName: 'Pneumonia',
      clues: [
        { type: 'history', value: 'Cough and fever for two days.', order: 0 },
        { type: 'history', value: 'Feels tired.', order: 1 },
        { type: 'history', value: 'Poor appetite.', order: 2 },
        { type: 'imaging', value: 'Chest x-ray shows focal consolidation.', order: 3 },
      ],
      differentials: ['Bronchitis', 'Heart failure'],
    });

    expect(analysis.editorialSignals).toEqual(
      expect.arrayContaining(['weak_transition']),
    );
    expect(
      analysis.diagnosticStates.some(
        (state) => state.editorialConcern === 'This clue adds little new diagnostic information.',
      ),
    ).toBe(true);
  });

  it('flags abrupt giveaway when a late clue carries the whole solve', () => {
    const analysis = service.analyze({
      caseId: 'case-giveaway',
      diagnosisName: 'Myocardial infarction',
      clues: [
        { type: 'history', value: 'Chest discomfort with nausea.', order: 0 },
        { type: 'history', value: 'Diaphoresis after exertion.', order: 1 },
        {
          type: 'lab',
          value: 'Troponin confirms myocardial infarction.',
          order: 2,
        },
      ],
      differentials: ['GERD', 'Panic attack', 'Pulmonary embolism'],
    });

    expect(analysis.editorialSignals).toContain('abrupt_giveaway');
    expect(analysis.likelyLockInClue).toBe(3);
    expect(analysis.diagnosticStates[2].confidenceShift).toBeGreaterThanOrEqual(
      0.45,
    );
  });

  it('tracks GERD eliminated by meal timing discriminator', () => {
    const analysis = service.analyze({
      caseId: 'case-gerd',
      diagnosisName: 'Biliary colic',
      clues: [
        { type: 'history', value: 'Epigastric discomfort after dinner.', order: 0 },
        {
          type: 'history',
          value:
            'Pain is delayed after fatty meals and not tied to reflux or recumbency.',
          order: 1,
        },
        { type: 'exam', value: 'Right upper quadrant tenderness.', order: 2 },
      ],
      differentials: ['GERD'],
      differentialContext: {
        teachingRelationships: [
          {
            targetDiagnosisRegistryId: 'gerd-id',
            relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
            discriminatorSummary: 'delayed post-meal timing without reflux or recumbency pattern',
            strength: 4,
            status: 'ACTIVE',
            targetDiagnosisRegistry: { displayLabel: 'GERD' },
          },
        ],
      },
    });

    expect(analysis.differentialElimination[0]).toEqual(
      expect.objectContaining({
        mimicDiagnosisId: 'gerd-id',
        mimicName: 'GERD',
        finalStatus: 'eliminated',
        eliminatedAtClueIndex: 2,
        eliminationStrength: 'moderate',
        educationalValue: 'high',
      }),
    );
    expect(analysis.eliminatedMimicCount).toBe(1);
  });

  it('keeps mimic unresolved when no discriminator appears', () => {
    const analysis = service.analyze({
      caseId: 'case-unresolved-mimic',
      diagnosisName: 'Gastritis',
      clues: [
        { type: 'history', value: 'Upper abdominal pain after meals.', order: 0 },
        { type: 'history', value: 'Nausea and reduced appetite.', order: 1 },
      ],
      differentials: ['GERD'],
      differentialContext: {
        teachingRelationships: [
          {
            relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
            discriminatorSummary: 'reflux and recumbency pattern',
            targetDiagnosisRegistry: { displayLabel: 'GERD' },
          },
        ],
      },
    });

    expect(analysis.differentialElimination[0]).toEqual(
      expect.objectContaining({
        finalStatus: 'unresolved',
        remainingConfusionRisk: true,
      }),
    );
    expect(analysis.editorialSignals).toEqual(
      expect.arrayContaining(['missing_discriminator_case', 'persistent_confusion']),
    );
  });

  it('marks unresolved must-not-miss mimic as persistent confusion', () => {
    const analysis = service.analyze({
      caseId: 'case-cancer-unresolved',
      diagnosisRegistryId: 'registry-1',
      diagnosisName: 'Peptic ulcer disease',
      clues: [
        { type: 'history', value: 'Burning epigastric discomfort.', order: 0 },
        { type: 'history', value: 'Symptoms fluctuate with meals.', order: 1 },
        { type: 'exam', value: 'Mild epigastric tenderness.', order: 2 },
      ],
      differentials: ['Gastric cancer'],
      differentialContext: {
        linkedDifferentials: [
          {
            diagnosisRegistryId: 'cancer-id',
            displayLabel: 'Gastric cancer',
            role: 'IMPORTANT_EXCLUSION',
            confidence: 0.8,
            sourceText: 'alarm features, weight loss, progressive dysphagia, or anemia',
          },
        ],
      },
    });

    expect(analysis.differentialElimination[0]).toEqual(
      expect.objectContaining({
        finalStatus: 'persistent',
        remainingConfusionRisk: true,
      }),
    );
    expect(analysis.persistentConfusionCount).toBe(1);
    expect(analysis.targetedGenerationOpportunities[0]).toEqual(
      expect.objectContaining({
        generationIntent: 'must_not_miss_separation',
        mimicName: 'Gastric cancer',
      }),
    );
  });

  it('treats vague clue elimination as weak', () => {
    const analysis = service.analyze({
      caseId: 'case-vague-weak',
      diagnosisName: 'Pneumonia',
      clues: [
        { type: 'history', value: 'Cough and fever.', order: 0 },
        { type: 'history', value: 'Feels tired.', order: 1 },
      ],
      differentials: ['Bronchitis'],
    });

    expect(analysis.differentialElimination[0]).toEqual(
      expect.objectContaining({
        finalStatus: 'eliminated',
        eliminationStrength: 'weak',
      }),
    );
    expect(analysis.editorialSignals).toContain('weak_elimination');
  });

  it('sets premature collapse risk when mimic is eliminated before clue three', () => {
    const analysis = service.analyze({
      caseId: 'case-premature-collapse',
      diagnosisName: 'Appendicitis',
      clues: [
        {
          type: 'history',
          value: 'Migratory right lower quadrant pain separates appendicitis from gastroenteritis.',
          order: 0,
        },
        { type: 'history', value: 'Anorexia follows the pain.', order: 1 },
        { type: 'exam', value: 'Localized guarding develops.', order: 2 },
      ],
      differentials: ['Gastroenteritis'],
      differentialContext: {
        teachingRelationships: [
          {
            relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
            discriminatorSummary: 'migratory right lower quadrant pain',
            targetDiagnosisRegistry: { displayLabel: 'Gastroenteritis' },
          },
        ],
      },
    });

    expect(analysis.differentialElimination[0].prematureCollapseRisk).toBe(true);
    expect(analysis.editorialSignals).toContain('premature_mimic_collapse');
  });

  it('eliminates mimics progressively in a well-structured case', () => {
    const analysis = service.analyze({
      caseId: 'case-progressive',
      diagnosisName: 'Appendicitis',
      clues: [
        { type: 'history', value: 'Periumbilical pain with nausea.', order: 0 },
        {
          type: 'history',
          value: 'Pain migrates to the right lower quadrant over several hours.',
          order: 1,
        },
        {
          type: 'exam',
          value: 'Focal right lower quadrant tenderness with guarding.',
          order: 2,
        },
        {
          type: 'lab',
          value: 'Leukocytosis with neutrophilia supports an inflammatory pattern.',
          order: 3,
        },
      ],
      differentials: ['Gastroenteritis', 'Ovarian torsion'],
      differentialContext: {
        teachingRelationships: [
          {
            relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
            discriminatorSummary: 'migration to the right lower quadrant',
            targetDiagnosisRegistry: { displayLabel: 'Gastroenteritis' },
          },
          {
            relationshipType: 'IMPORTANT_EXCLUSION',
            discriminatorSummary: 'focal tenderness with guarding',
            targetDiagnosisRegistry: { displayLabel: 'Ovarian torsion' },
          },
        ],
      },
    });

    expect(analysis.eliminatedMimicCount).toBe(2);
    expect(
      analysis.differentialElimination.map((item) => item.eliminatedAtClueIndex),
    ).toEqual([2, 3]);
  });

  it('uses explicit editorial annotation over heuristic elimination', () => {
    const analysis = service.analyze({
      caseId: 'case-editorial-override',
      diagnosisName: 'Peptic ulcer disease',
      clues: [
        { type: 'history', value: 'Burning epigastric discomfort.', order: 0 },
        {
          type: 'history',
          value: 'Delayed post-meal timing without reflux pattern.',
          order: 1,
        },
      ],
      differentials: ['GERD'],
      clueDiscriminatorAnnotations: [
        {
          id: 'annotation-1',
          clueOrder: 2,
          clueIndex: 2,
          eliminatedDiagnosisName: 'GERD',
          discriminator: 'Delayed post-meal timing separates from reflux-pattern disease',
          reasoning: 'Editor-confirmed discriminator.',
          eliminationStrength: 'strong',
          educationalValue: 'high',
        },
      ],
    });

    expect(analysis.differentialElimination).toEqual([
      expect.objectContaining({
        mimicName: 'GERD',
        finalStatus: 'eliminated',
        annotationSource: 'editorial',
        annotationId: 'annotation-1',
        eliminationStrength: 'strong',
        educationalValue: 'high',
      }),
    ]);
    expect(analysis.explicitDiscriminatorAnnotationCount).toBe(1);
    expect(analysis.heuristicOnlyEliminationCount).toBe(0);
  });

  it('restores heuristic fallback when no annotation is present', () => {
    const analysis = service.analyze({
      caseId: 'case-heuristic-fallback',
      diagnosisRegistryId: 'registry-1',
      diagnosisName: 'Peptic ulcer disease',
      clues: [
        { type: 'history', value: 'Burning epigastric discomfort.', order: 0 },
        {
          type: 'history',
          value: 'Delayed post-meal timing without reflux pattern.',
          order: 1,
        },
      ],
      differentials: ['GERD'],
      differentialContext: {
        teachingRelationships: [
          {
            relationshipType: 'DIFFERENTIAL_DISCRIMINATOR',
            discriminatorSummary: 'delayed post-meal timing without reflux pattern',
            targetDiagnosisRegistry: { displayLabel: 'GERD' },
          },
        ],
      },
    });

    expect(analysis.differentialElimination[0]).toEqual(
      expect.objectContaining({
        mimicName: 'GERD',
        annotationSource: 'heuristic',
        finalStatus: 'eliminated',
      }),
    );
    expect(analysis.heuristicOnlyEliminationCount).toBe(1);
    expect(analysis.targetedGenerationOpportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          generationIntent: 'heuristic_only_repair',
          mimicName: 'GERD',
        }),
      ]),
    );
  });

  it('emits weak discriminator generation opportunities for weak heuristic elimination', () => {
    const analysis = service.analyze({
      caseId: 'case-weak-generation',
      diagnosisRegistryId: 'registry-1',
      diagnosisName: 'Pneumonia',
      clues: [
        { type: 'history', value: 'Cough and fever.', order: 0 },
        { type: 'history', value: 'Feels tired.', order: 1 },
      ],
      differentials: ['Bronchitis'],
    });

    expect(analysis.editorialSignals).toEqual(
      expect.arrayContaining([
        'weak_discriminator_case',
        'heuristic_only_discrimination',
      ]),
    );
    expect(analysis.targetedGenerationOpportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: 'case-weak-generation',
          diagnosisRegistryId: 'registry-1',
          mimicName: 'Bronchitis',
          generationIntent: 'weak_discriminator_case',
        }),
        expect.objectContaining({
          mimicName: 'Bronchitis',
          generationIntent: 'heuristic_only_repair',
        }),
      ]),
    );
  });
});
