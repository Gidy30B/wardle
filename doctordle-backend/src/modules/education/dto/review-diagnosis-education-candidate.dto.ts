import { IsEnum, IsString, MinLength } from 'class-validator';
import { DiagnosisEducationCandidateReviewDecision } from '@prisma/client';

export class ReviewDiagnosisEducationCandidateDto {
  @IsEnum(DiagnosisEducationCandidateReviewDecision)
  decision!: DiagnosisEducationCandidateReviewDecision;

  @IsString()
  @MinLength(1)
  rationale!: string;
}
