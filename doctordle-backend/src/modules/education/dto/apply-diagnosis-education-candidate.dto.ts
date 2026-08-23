import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class ApplyDiagnosisEducationCandidateDto {
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  @IsString()
  @MinLength(1)
  rationale!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorityReferences?: string[];
}
