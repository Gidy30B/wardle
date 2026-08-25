import { DiagnosisEducationRevisionApprovalOutcome } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class DecideDiagnosisEducationRevisionDto {
  @IsEnum(DiagnosisEducationRevisionApprovalOutcome)
  outcome!: DiagnosisEducationRevisionApprovalOutcome;

  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  rationale!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorityReferences?: string[];
}
