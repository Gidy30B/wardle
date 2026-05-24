import {
  getDiagnosisTermNormalizedCandidates,
  normalizeDiagnosisTerm,
} from './diagnosis-term-normalizer';

describe('normalizeDiagnosisTerm', () => {
  it('normalizes case, punctuation, and separators conservatively', () => {
    expect(normalizeDiagnosisTerm(' Acute-Respiratory_Distress, Syndrome ')).toBe(
      'acute respiratory distress syndrome',
    );
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeDiagnosisTerm('heart     failure')).toBe('heart failure');
  });

  it('extracts parenthetical core terms as duplicate-match candidates', () => {
    expect(
      getDiagnosisTermNormalizedCandidates(
        'Primary brain tumor (glioblastoma multiforme)',
      ),
    ).toEqual([
      'primary brain tumor glioblastoma multiforme',
      'glioblastoma multiforme',
    ]);
  });
});
