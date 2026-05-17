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

export class CreateAndLinkDiagnosisDto {
  @IsString()
  @MaxLength(255)
  canonicalName!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subspecialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bodySystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organSystem?: string;

  @IsOptional()
  @IsIn(DIAGNOSIS_DIFFICULTY_BANDS)
  difficultyBand?: DiagnosisDifficultyBandValue;

  @IsOptional()
  @IsIn(DIAGNOSIS_RARITY_BANDS)
  rarityBand?: DiagnosisRarityBandValue;

  @IsOptional()
  @IsIn(DIAGNOSIS_CLINICAL_SETTINGS)
  clinicalSetting?: DiagnosisClinicalSettingValue;

  @IsOptional()
  @IsIn(DIAGNOSIS_AGE_GROUPS)
  ageGroup?: DiagnosisAgeGroupValue;

  @IsOptional()
  @IsIn(DIAGNOSIS_URGENCY_LEVELS)
  urgencyLevel?: DiagnosisUrgencyLevelValue;

  @IsOptional()
  @IsBoolean()
  isPlayable?: boolean;

  @IsOptional()
  @IsBoolean()
  isGeneratable?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(DIAGNOSIS_CLUE_TYPES, { each: true })
  preferredClueTypes?: DiagnosisClueTypeValue[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(DIAGNOSIS_CLUE_TYPES, { each: true })
  excludedClueTypes?: DiagnosisClueTypeValue[];

  @IsOptional()
  @IsBoolean()
  isDescriptive?: boolean;

  @IsOptional()
  @IsBoolean()
  isCompositional?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  searchPriority?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosisEditorialNote?: string;
}
