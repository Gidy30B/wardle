import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AuthorizeDiagnosisEducationPublicationDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MinLength(1)
  expectedApprovalDecisionId!: string;

  @IsOptional()
  @IsString()
  expectedActivePublicationDecisionId?: string | null;

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
