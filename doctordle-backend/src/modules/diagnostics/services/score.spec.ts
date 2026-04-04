import { computeScore, mapLabel } from './score';

describe('score utilities', () => {
  it('computes weighted score from signals', () => {
    const score = computeScore({
      exact: false,
      synonym: true,
      fuzzy: 0.5,
      embedding: 0.5,
      ontology: {
        score: 0.6,
        reason: 'same_system',
      },
    });

    expect(score).toBeCloseTo(1.9, 5);
  });

  it('maps labels based on score threshold', () => {
    expect(mapLabel(0.9)).toBe('correct');
    expect(mapLabel(0.7)).toBe('close');
    expect(mapLabel(0.4)).toBe('wrong');
  });
});
