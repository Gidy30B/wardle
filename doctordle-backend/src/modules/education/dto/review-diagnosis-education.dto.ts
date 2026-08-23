import { DiagnosisEducationStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ReviewDiagnosisEducationDto {
  @IsEnum(DiagnosisEducationStatus)
  status!: DiagnosisEducationStatus;

  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
