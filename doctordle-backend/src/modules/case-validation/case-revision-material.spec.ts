import {
  buildCaseRevisionMaterialHash,
  canonicalizeRevisionClues,
} from './case-revision-material';
import type { CaseRevisionSnapshot } from './case-validation.types';

const snapshot = (
  overrides: Partial<CaseRevisionSnapshot> = {},
): CaseRevisionSnapshot => ({
  caseId: 'case-1',
  title: 'Asthma case',
  date: new Date('2026-04-20T00:00:00.000Z'),
  difficulty: 'medium',
  history: 'Wheezing after exercise',
  symptoms: ['wheezing', 'cough'],
  labs: { b: 2, a: 1 },
  clues: [
    { key: 'clue-1', type: 'history', value: 'Wheeze' },
    { key: 'clue-2', type: 'lab', value: 'Normal CBC' },
  ],
  explanation: { summary: 'Reactive airway disease' },
  differentials: ['COPD', 'Heart failure'],
  diagnosisId: 'diagnosis-1',
  diagnosisRegistryId: 'registry-1',
  proposedDiagnosisText: 'Asthma',
  diagnosisMappingStatus: 'MATCHED',
  diagnosisMappingMethod: 'EDITOR_SELECTED',
  diagnosisMappingConfidence: 1,
  diagnosisEditorialNote: null,
  ...overrides,
});

describe('case revision material hash', () => {
  it('is stable for JSON key reordering only', () => {
    const left = buildCaseRevisionMaterialHash(snapshot());
    const right = buildCaseRevisionMaterialHash(
      snapshot({ labs: { a: 1, b: 2 } }),
    );

    expect(right).toBe(left);
  });

  it('changes when clue order changes', () => {
    const original = snapshot();
    const reordered = snapshot({
      clues: [...(original.clues as unknown[])].reverse() as never,
    });

    expect(buildCaseRevisionMaterialHash(reordered)).not.toBe(
      buildCaseRevisionMaterialHash(original),
    );
  });

  it('changes when clue wording, diagnosis relation, or difficulty changes', () => {
    const original = buildCaseRevisionMaterialHash(snapshot());

    expect(
      buildCaseRevisionMaterialHash(
        snapshot({
          clues: [{ key: 'clue-1', type: 'history', value: 'Changed' }],
        }),
      ),
    ).not.toBe(original);
    expect(
      buildCaseRevisionMaterialHash(snapshot({ diagnosisRegistryId: 'registry-2' })),
    ).not.toBe(original);
    expect(buildCaseRevisionMaterialHash(snapshot({ difficulty: 'hard' }))).not.toBe(
      original,
    );
  });
});

describe('case revision clue keys', () => {
  it('preserves keys across reorder and assigns keys to new clues', () => {
    const result = canonicalizeRevisionClues({
      baseClues: [
        { key: 'clue-history', type: 'history', value: 'Wheeze' },
        { key: 'clue-lab', type: 'lab', value: 'Normal CBC' },
      ],
      proposedClues: [
        { key: 'clue-lab', type: 'lab', value: 'Normal CBC' },
        { type: 'exam', value: 'Prolonged expiratory phase' },
        { key: 'clue-history', type: 'history', value: 'Wheeze' },
      ],
    });

    expect(result.clues).toEqual([
      { key: 'clue-lab', type: 'lab', value: 'Normal CBC' },
      {
        key: expect.stringMatching(/^clue-/),
        type: 'exam',
        value: 'Prolonged expiratory phase',
      },
      { key: 'clue-history', type: 'history', value: 'Wheeze' },
    ]);
  });

  it('rejects duplicate resulting clue keys', () => {
    expect(() =>
      canonicalizeRevisionClues({
        baseClues: [],
        proposedClues: [
          { key: 'duplicate', type: 'history', value: 'One' },
          { key: 'duplicate', type: 'lab', value: 'Two' },
        ],
      }),
    ).toThrow('Duplicate clue key');
  });
});
