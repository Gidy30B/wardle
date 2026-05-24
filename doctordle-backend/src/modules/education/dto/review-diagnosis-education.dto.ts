import { DiagnosisEducationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDiagnosisEducationDto {
  @IsEnum(DiagnosisEducationStatus)
  status!: DiagnosisEducationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
