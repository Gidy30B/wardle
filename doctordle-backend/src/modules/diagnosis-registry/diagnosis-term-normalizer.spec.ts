import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';

describe('normalizeDiagnosisTerm', () => {
  it('normalizes case, punctuation, and separators conservatively', () => {
    expect(normalizeDiagnosisTerm(' Acute-Respiratory_Distress, Syndrome ')).toBe(
      'acute respiratory distress syndrome',
    );
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeDiagnosisTerm('heart     failure')).toBe('heart failure');
  });
});
