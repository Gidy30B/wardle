import { Injectable } from '@nestjs/common';

export type RankTier =
  | 'Intern'
  | 'Resident'
  | 'Registrar'
  | 'Consultant';

@Injectable()
export class RankService {
  getRank(level: number): RankTier {
    if (level >= 21) return 'Consultant';
    if (level >= 11) return 'Registrar';
    if (level >= 6) return 'Resident';
    return 'Intern';
  }
}
