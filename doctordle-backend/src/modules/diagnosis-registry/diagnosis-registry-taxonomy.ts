export const DIAGNOSIS_DIFFICULTY_BANDS = [
  'BASIC',
  'INTERMEDIATE',
  'ADVANCED',
] as const;

export const DIAGNOSIS_RARITY_BANDS = ['COMMON', 'UNCOMMON', 'RARE'] as const;

export const DIAGNOSIS_CLINICAL_SETTINGS = [
  'OUTPATIENT',
  'EMERGENCY',
  'INPATIENT',
  'ICU',
  'COMMUNITY',
] as const;

export const DIAGNOSIS_AGE_GROUPS = [
  'PEDIATRIC',
  'ADULT',
  'GERIATRIC',
  'ANY',
] as const;

export const DIAGNOSIS_URGENCY_LEVELS = [
  'ROUTINE',
  'URGENT',
  'EMERGENT',
] as const;

export const DIAGNOSIS_CLUE_TYPES = [
  'history',
  'symptom',
  'vital',
  'lab',
  'exam',
  'imaging',
] as const;

export type DiagnosisDifficultyBandValue =
  (typeof DIAGNOSIS_DIFFICULTY_BANDS)[number];
export type DiagnosisRarityBandValue = (typeof DIAGNOSIS_RARITY_BANDS)[number];
export type DiagnosisClinicalSettingValue =
  (typeof DIAGNOSIS_CLINICAL_SETTINGS)[number];
export type DiagnosisAgeGroupValue = (typeof DIAGNOSIS_AGE_GROUPS)[number];
export type DiagnosisUrgencyLevelValue =
  (typeof DIAGNOSIS_URGENCY_LEVELS)[number];
export type DiagnosisClueTypeValue = (typeof DIAGNOSIS_CLUE_TYPES)[number];
