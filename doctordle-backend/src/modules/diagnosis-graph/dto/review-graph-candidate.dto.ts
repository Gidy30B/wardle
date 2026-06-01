import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RejectGraphCandidateDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class MergeGraphCandidateDto {
  @IsOptional()
  @IsUUID()
  targetCandidateId?: string;

  @IsOptional()
  @IsUUID()
  targetFactId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ResolveMimicCandidateDto {
  @IsIn(['link_existing', 'add_alias_to_existing', 'reject'])
  action!: 'link_existing' | 'add_alias_to_existing' | 'reject';

  @IsOptional()
  @IsUUID()
  targetDiagnosisRegistryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  aliasText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
