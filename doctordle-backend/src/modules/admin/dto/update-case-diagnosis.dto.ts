import { IsString, MaxLength } from 'class-validator';

export class UpdateCaseDiagnosisDto {
  @IsString()
  @MaxLength(255)
  canonicalDiagnosis!: string;

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
}
