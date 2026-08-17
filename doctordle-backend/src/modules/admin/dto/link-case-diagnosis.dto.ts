import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LinkCaseDiagnosisDto {
  @IsString()
  diagnosisRegistryId!: string;

  @IsString()
  expectedRevisionId!: string;

  @IsString()
  commandIdempotencyKey!: string;

  @IsString()
  @MaxLength(5000)
  changeReason!: string;

  @IsString()
  @MaxLength(5000)
  changeSummary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosisEditorialNote?: string;
}
