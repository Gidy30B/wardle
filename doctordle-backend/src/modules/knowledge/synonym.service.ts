import { Injectable } from '@nestjs/common';

@Injectable()
export class SynonymService {
  private readonly aliasToCanonical = new Map<string, string>([
    ['mi', 'myocardial infarction'],
    ['heart attack', 'myocardial infarction'],
    ['tb', 'tuberculosis'],
    ['lung infection', 'pneumonia'],
  ]);

  resolve(term: string): string {
    const normalized = this.normalizeTerm(term);
    return this.aliasToCanonical.get(normalized) ?? normalized;
  }

  isExact(guess: string, diagnosis: string): boolean {
    return this.resolve(guess) === this.resolve(diagnosis);
  }

  private normalizeTerm(term: string): string {
    return term.toLowerCase().trim().replace(/[^\w\s]/g, '');
  }
}
