import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
