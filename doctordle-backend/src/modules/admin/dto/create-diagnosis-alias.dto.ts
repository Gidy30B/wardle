import { DiagnosisAliasKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDiagnosisAliasDto {
  @IsString()
  @MaxLength(255)
  alias!: string;

  @IsOptional()
  @IsEnum(DiagnosisAliasKind)
  kind?: DiagnosisAliasKind;

  @IsOptional()
  @IsBoolean()
  acceptedForMatch?: boolean;
}
