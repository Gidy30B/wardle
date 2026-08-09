import { ReviewDecision } from '@prisma/client';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SubmitCaseReviewDto {
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @ValidateIf((dto: SubmitCaseReviewDto) => dto.decision === ReviewDecision.APPROVED)
  @IsDefined({
    message: 'expectedRevisionId is required when approving a case revision',
  })
  @IsString({
    message: 'expectedRevisionId is required when approving a case revision',
  })
  @MaxLength(100)
  expectedRevisionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  expectedReviewId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  commandIdempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorityAssignmentReferences?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
