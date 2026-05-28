import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SmokeExtractGraphDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  diagnosisRegistryIds!: string[];

  @IsOptional()
  @IsBoolean()
  includeCases?: boolean;

  @IsOptional()
  @IsBoolean()
  includeEducation?: boolean;
}
