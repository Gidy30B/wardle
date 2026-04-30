import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const DIFFICULTY_PREFERENCES = [
  'BEGINNER',
  'STANDARD',
  'HARD',
  'EXPERT',
] as const;

export type DifficultyPreference = (typeof DIFFICULTY_PREFERENCES)[number];

export class UpdateMySettingsDto {
  @IsOptional()
  @IsBoolean()
  showTimer?: boolean;

  @IsOptional()
  @IsBoolean()
  hintsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autocompleteEnabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(DIFFICULTY_PREFERENCES)
  difficultyPreference?: DifficultyPreference;

  @IsOptional()
  @IsBoolean()
  spacedRepetitionEnabled?: boolean;
}
