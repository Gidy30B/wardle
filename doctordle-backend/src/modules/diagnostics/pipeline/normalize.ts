import { normalizeDiagnosisTerm } from '../../diagnosis-registry/diagnosis-term-normalizer.js';

export function normalize(text: string): string {
  return normalizeDiagnosisTerm(text);
}
