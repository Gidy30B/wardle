import { IsInt, IsOptional, Min } from 'class-validator';

export class GenerateDiagnosisEducationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
