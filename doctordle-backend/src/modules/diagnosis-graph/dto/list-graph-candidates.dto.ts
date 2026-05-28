import {
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphSourceType,
} from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListGraphCandidatesDto {
  @IsOptional()
  @IsUUID()
  diagnosisRegistryId?: string;

  @IsOptional()
  @IsEnum(DiagnosisGraphCandidateType)
  type?: DiagnosisGraphCandidateType;

  @IsOptional()
  @IsEnum(DiagnosisGraphCandidateStatus)
  status?: DiagnosisGraphCandidateStatus;

  @IsOptional()
  @IsEnum(DiagnosisGraphSourceType)
  sourceType?: DiagnosisGraphSourceType;
}
