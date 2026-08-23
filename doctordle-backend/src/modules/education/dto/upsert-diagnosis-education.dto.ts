import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertDiagnosisEducationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  summary?: unknown;

  @IsOptional()
  clinicalPattern?: unknown;

  @IsOptional()
  keySymptoms?: unknown;

  @IsOptional()
  keySigns?: unknown;

  @IsOptional()
  examPearls?: unknown;

  @IsOptional()
  scoringSystems?: unknown;

  @IsOptional()
  investigations?: unknown;

  @IsOptional()
  differentials?: unknown;

  @IsOptional()
  management?: unknown;

  @IsOptional()
  complications?: unknown;

  @IsOptional()
  pitfalls?: unknown;

  @IsOptional()
  recallPrompts?: unknown;

  @IsOptional()
  references?: unknown;
}
