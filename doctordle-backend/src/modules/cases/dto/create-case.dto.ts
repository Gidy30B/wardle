import { IsArray, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(10)
  history!: string;

  @IsArray()
  @IsString({ each: true })
  symptoms!: string[];

  @IsString()
  diagnosisId!: string;

  @IsOptional()
  @IsString()
  diagnosisRegistryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  proposedDiagnosisText?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
