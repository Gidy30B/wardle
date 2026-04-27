DO $$
BEGIN
  CREATE TYPE "DiagnosisRegistryStatus" AS ENUM (
    'ACTIVE',
    'HIDDEN',
    'DEPRECATED',
    'DRAFT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DiagnosisMappingStatus" AS ENUM (
    'MATCHED',
    'REVIEW_REQUIRED',
    'UNRESOLVED',
    'NEW_REGISTRY_ENTRY_NEEDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DiagnosisMappingMethod" AS ENUM (
    'EXACT_ALIAS',
    'NORMALIZED_ALIAS',
    'EDITOR_SELECTED',
    'MANUAL_CREATED',
    'LEGACY_BACKFILL',
    'NONE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DiagnosisRegistry"
ADD COLUMN IF NOT EXISTS "status" "DiagnosisRegistryStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "isDescriptive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isCompositional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "searchPriority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "icd10Code" TEXT,
ADD COLUMN IF NOT EXISTS "icd11Code" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "specialty" TEXT,
ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "DiagnosisRegistry"
SET "status" = CASE
  WHEN "active" = true THEN 'ACTIVE'::"DiagnosisRegistryStatus"
  ELSE 'HIDDEN'::"DiagnosisRegistryStatus"
END;

CREATE INDEX IF NOT EXISTS "DiagnosisRegistry_status_idx"
ON "DiagnosisRegistry"("status");

CREATE INDEX IF NOT EXISTS "DiagnosisRegistry_searchPriority_idx"
ON "DiagnosisRegistry"("searchPriority");

ALTER TABLE "Case"
ADD COLUMN IF NOT EXISTS "proposedDiagnosisText" TEXT,
ADD COLUMN IF NOT EXISTS "diagnosisMappingStatus" "DiagnosisMappingStatus",
ADD COLUMN IF NOT EXISTS "diagnosisMappingMethod" "DiagnosisMappingMethod",
ADD COLUMN IF NOT EXISTS "diagnosisMappingConfidence" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "diagnosisEditorialNote" TEXT;

ALTER TABLE "CaseRevision"
ADD COLUMN IF NOT EXISTS "proposedDiagnosisText" TEXT,
ADD COLUMN IF NOT EXISTS "diagnosisMappingStatus" "DiagnosisMappingStatus",
ADD COLUMN IF NOT EXISTS "diagnosisMappingMethod" "DiagnosisMappingMethod",
ADD COLUMN IF NOT EXISTS "diagnosisMappingConfidence" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "diagnosisEditorialNote" TEXT;

UPDATE "Case" c
SET
  "proposedDiagnosisText" = COALESCE(c."proposedDiagnosisText", d."name"),
  "diagnosisMappingStatus" = COALESCE(
    c."diagnosisMappingStatus",
    CASE
      WHEN c."diagnosisRegistryId" IS NOT NULL THEN 'MATCHED'::"DiagnosisMappingStatus"
      ELSE 'UNRESOLVED'::"DiagnosisMappingStatus"
    END
  ),
  "diagnosisMappingMethod" = COALESCE(
    c."diagnosisMappingMethod",
    CASE
      WHEN c."diagnosisRegistryId" IS NOT NULL THEN 'LEGACY_BACKFILL'::"DiagnosisMappingMethod"
      ELSE 'NONE'::"DiagnosisMappingMethod"
    END
  ),
  "diagnosisMappingConfidence" = CASE
    WHEN c."diagnosisMappingConfidence" IS NOT NULL THEN c."diagnosisMappingConfidence"
    WHEN c."diagnosisRegistryId" IS NOT NULL THEN 1
    ELSE NULL
  END
FROM "Diagnosis" d
WHERE d."id" = c."diagnosisId";

UPDATE "CaseRevision" cr
SET
  "proposedDiagnosisText" = COALESCE(cr."proposedDiagnosisText", d."name"),
  "diagnosisMappingStatus" = COALESCE(
    cr."diagnosisMappingStatus",
    CASE
      WHEN cr."diagnosisRegistryId" IS NOT NULL THEN 'MATCHED'::"DiagnosisMappingStatus"
      ELSE 'UNRESOLVED'::"DiagnosisMappingStatus"
    END
  ),
  "diagnosisMappingMethod" = COALESCE(
    cr."diagnosisMappingMethod",
    CASE
      WHEN cr."diagnosisRegistryId" IS NOT NULL THEN 'LEGACY_BACKFILL'::"DiagnosisMappingMethod"
      ELSE 'NONE'::"DiagnosisMappingMethod"
    END
  ),
  "diagnosisMappingConfidence" = CASE
    WHEN cr."diagnosisMappingConfidence" IS NOT NULL THEN cr."diagnosisMappingConfidence"
    WHEN cr."diagnosisRegistryId" IS NOT NULL THEN 1
    ELSE NULL
  END
FROM "Diagnosis" d
WHERE d."id" = cr."diagnosisId";

ALTER TABLE "Case"
ALTER COLUMN "proposedDiagnosisText" SET NOT NULL,
ALTER COLUMN "diagnosisMappingStatus" SET NOT NULL,
ALTER COLUMN "diagnosisMappingMethod" SET NOT NULL;

ALTER TABLE "CaseRevision"
ALTER COLUMN "proposedDiagnosisText" SET NOT NULL,
ALTER COLUMN "diagnosisMappingStatus" SET NOT NULL,
ALTER COLUMN "diagnosisMappingMethod" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Case_diagnosisMappingStatus_idx"
ON "Case"("diagnosisMappingStatus");

CREATE INDEX IF NOT EXISTS "CaseRevision_diagnosisMappingStatus_idx"
ON "CaseRevision"("diagnosisMappingStatus");
