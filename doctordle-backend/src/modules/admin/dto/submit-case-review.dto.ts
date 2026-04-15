import { ReviewDecision } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCaseReviewDto {
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
