import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class AuthorizeCaseRevisionPublicationDto {
  @IsString()
  @MaxLength(100)
  expectedRevisionId!: string;

  @IsString()
  @MaxLength(100)
  expectedApprovalDecisionId!: string;

  @IsString()
  @MaxLength(200)
  expectedMaterialContextHash!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  expectedValidationRunId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  expectedActivePublicationDecisionId?: string | null;

  @IsString()
  @MaxLength(200)
  commandIdempotencyKey!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorityAssignmentReferences?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rationale?: string;
}
