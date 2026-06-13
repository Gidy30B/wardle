import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DIAGNOSIS_AGE_GROUPS,
  DIAGNOSIS_CLINICAL_SETTINGS,
  DIAGNOSIS_CLUE_TYPES,
  DIAGNOSIS_DIFFICULTY_BANDS,
  DIAGNOSIS_RARITY_BANDS,
  DIAGNOSIS_URGENCY_LEVELS,
  type DiagnosisAgeGroupValue,
  type DiagnosisClinicalSettingValue,
  type DiagnosisClueTypeValue,
  type DiagnosisDifficultyBandValue,
  type DiagnosisRarityBandValue,
  type DiagnosisUrgencyLevelValue,
} from '../../diagnosis-registry/diagnosis-registry-taxonomy.js';

export class UpdateDiagnosisRegistryMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialty?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subspecialty?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bodySystem?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organSystem?: string | null;

  @IsOptional()
  @IsIn(DIAGNOSIS_DIFFICULTY_BANDS)
  difficultyBand?: DiagnosisDifficultyBandValue | null;

  @IsOptional()
  @IsIn(DIAGNOSIS_RARITY_BANDS)
  rarityBand?: DiagnosisRarityBandValue | null;

  @IsOptional()
  @IsIn(DIAGNOSIS_CLINICAL_SETTINGS)
  clinicalSetting?: DiagnosisClinicalSettingValue | null;

  @IsOptional()
  @IsIn(DIAGNOSIS_AGE_GROUPS)
  ageGroup?: DiagnosisAgeGroupValue | null;

  @IsOptional()
  @IsIn(DIAGNOSIS_URGENCY_LEVELS)
  urgencyLevel?: DiagnosisUrgencyLevelValue | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(DIAGNOSIS_CLUE_TYPES, { each: true })
  preferredClueTypes?: DiagnosisClueTypeValue[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(DIAGNOSIS_CLUE_TYPES, { each: true })
  excludedClueTypes?: DiagnosisClueTypeValue[] | null;

  @IsOptional()
  @IsBoolean()
  isPlayable?: boolean;

  @IsOptional()
  @IsBoolean()
  isGeneratable?: boolean;

  @IsOptional()
  @IsBoolean()
  isDescriptive?: boolean;

  @IsOptional()
  @IsBoolean()
  isCompositional?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  searchPriority?: number;
}
