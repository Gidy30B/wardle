-- Extend DiagnosisRegistry from identity/canonicalization into a clinical taxonomy layer.
-- All classification fields are nullable so existing registry rows remain valid.
-- Existing rows are marked playable/generatable by default to preserve current behavior.

CREATE TYPE "DiagnosisDifficultyBand" AS ENUM (
  'BASIC',
  'INTERMEDIATE',
  'ADVANCED'
);

CREATE TYPE "DiagnosisRarityBand" AS ENUM (
  'COMMON',
  'UNCOMMON',
  'RARE'
);

CREATE TYPE "DiagnosisClinicalSetting" AS ENUM (
  'OUTPATIENT',
  'EMERGENCY',
  'INPATIENT',
  'ICU',
  'COMMUNITY'
);

CREATE TYPE "DiagnosisAgeGroup" AS ENUM (
  'PEDIATRIC',
  'ADULT',
  'GERIATRIC',
  'ANY'
);

CREATE TYPE "DiagnosisUrgencyLevel" AS ENUM (
  'ROUTINE',
  'URGENT',
  'EMERGENT'
);

ALTER TABLE "DiagnosisRegistry"
ADD COLUMN "subspecialty" TEXT,
ADD COLUMN "bodySystem" TEXT,
ADD COLUMN "organSystem" TEXT,
ADD COLUMN "difficultyBand" "DiagnosisDifficultyBand",
ADD COLUMN "rarityBand" "DiagnosisRarityBand",
ADD COLUMN "clinicalSetting" "DiagnosisClinicalSetting",
ADD COLUMN "ageGroup" "DiagnosisAgeGroup",
ADD COLUMN "urgencyLevel" "DiagnosisUrgencyLevel",
ADD COLUMN "isPlayable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isGeneratable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "preferredClueTypes" JSONB,
ADD COLUMN "excludedClueTypes" JSONB;

CREATE INDEX "DiagnosisRegistry_specialty_idx" ON "DiagnosisRegistry"("specialty");
CREATE INDEX "DiagnosisRegistry_bodySystem_idx" ON "DiagnosisRegistry"("bodySystem");
CREATE INDEX "DiagnosisRegistry_category_idx" ON "DiagnosisRegistry"("category");
CREATE INDEX "DiagnosisRegistry_difficultyBand_idx" ON "DiagnosisRegistry"("difficultyBand");
CREATE INDEX "DiagnosisRegistry_rarityBand_idx" ON "DiagnosisRegistry"("rarityBand");
CREATE INDEX "DiagnosisRegistry_clinicalSetting_idx" ON "DiagnosisRegistry"("clinicalSetting");
