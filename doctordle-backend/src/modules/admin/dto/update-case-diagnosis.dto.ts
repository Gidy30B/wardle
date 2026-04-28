import { IsString, MaxLength } from 'class-validator';

export class UpdateCaseDiagnosisDto {
  @IsString()
  @MaxLength(255)
  canonicalDiagnosis!: string;
}
