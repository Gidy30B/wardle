import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LinkCaseDiagnosisDto {
  @IsString()
  diagnosisRegistryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosisEditorialNote?: string;
}
