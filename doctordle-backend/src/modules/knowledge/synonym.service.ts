import { Injectable } from '@nestjs/common';
import { normalizeDiagnosisTerm } from '../diagnosis-registry/diagnosis-term-normalizer.js';

@Injectable()
export class SynonymService {
  resolve(term: string): string {
    return this.normalizeTerm(term);
  }

  isExact(guess: string, diagnosis: string): boolean {
    return this.resolve(guess) === this.resolve(diagnosis);
  }

  private normalizeTerm(term: string): string {
    return normalizeDiagnosisTerm(term);
  }
}
