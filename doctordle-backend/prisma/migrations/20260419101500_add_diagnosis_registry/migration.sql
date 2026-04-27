CREATE TYPE "DiagnosisAliasKind" AS ENUM ('CANONICAL', 'ACCEPTED', 'ABBREVIATION', 'SEARCH_ONLY');

CREATE TABLE "DiagnosisRegistry" (
  "id" TEXT NOT NULL,
  "legacyDiagnosisId" TEXT,
  "canonicalName" TEXT NOT NULL,
  "canonicalNormalized" TEXT NOT NULL,
  "displayLabel" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiagnosisRegistry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosisAlias" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "normalizedTerm" TEXT NOT NULL,
  "kind" "DiagnosisAliasKind" NOT NULL,
  "acceptedForMatch" BOOLEAN NOT NULL DEFAULT false,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiagnosisAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosisRegistry_legacyDiagnosisId_key" ON "DiagnosisRegistry"("legacyDiagnosisId");
CREATE UNIQUE INDEX "DiagnosisRegistry_canonicalNormalized_key" ON "DiagnosisRegistry"("canonicalNormalized");
CREATE INDEX "DiagnosisRegistry_active_idx" ON "DiagnosisRegistry"("active");
CREATE INDEX "DiagnosisRegistry_displayLabel_idx" ON "DiagnosisRegistry"("displayLabel");

CREATE UNIQUE INDEX "DiagnosisAlias_diagnosisRegistryId_normalizedTerm_key"
  ON "DiagnosisAlias"("diagnosisRegistryId", "normalizedTerm");
CREATE INDEX "DiagnosisAlias_normalizedTerm_active_idx"
  ON "DiagnosisAlias"("normalizedTerm", "active");
CREATE INDEX "DiagnosisAlias_diagnosisRegistryId_active_acceptedForMatch_idx"
  ON "DiagnosisAlias"("diagnosisRegistryId", "active", "acceptedForMatch");

ALTER TABLE "Case"
  ADD COLUMN "diagnosisRegistryId" TEXT;

ALTER TABLE "CaseRevision"
  ADD COLUMN "diagnosisRegistryId" TEXT;

ALTER TABLE "Attempt"
  ADD COLUMN "selectedDiagnosisId" TEXT,
  ADD COLUMN "selectedAliasId" TEXT,
  ADD COLUMN "strictMatchedDiagnosisId" TEXT,
  ADD COLUMN "strictMatchedAliasId" TEXT,
  ADD COLUMN "strictMatchOutcome" TEXT;

CREATE INDEX "Case_diagnosisRegistryId_idx" ON "Case"("diagnosisRegistryId");
CREATE INDEX "CaseRevision_diagnosisRegistryId_idx" ON "CaseRevision"("diagnosisRegistryId");
CREATE INDEX "Attempt_selectedDiagnosisId_idx" ON "Attempt"("selectedDiagnosisId");
CREATE INDEX "Attempt_selectedAliasId_idx" ON "Attempt"("selectedAliasId");
CREATE INDEX "Attempt_strictMatchedDiagnosisId_idx" ON "Attempt"("strictMatchedDiagnosisId");
CREATE INDEX "Attempt_strictMatchedAliasId_idx" ON "Attempt"("strictMatchedAliasId");

ALTER TABLE "DiagnosisRegistry"
  ADD CONSTRAINT "DiagnosisRegistry_legacyDiagnosisId_fkey"
  FOREIGN KEY ("legacyDiagnosisId") REFERENCES "Diagnosis"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiagnosisAlias"
  ADD CONSTRAINT "DiagnosisAlias_diagnosisRegistryId_fkey"
  FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Case"
  ADD CONSTRAINT "Case_diagnosisRegistryId_fkey"
  FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseRevision"
  ADD CONSTRAINT "CaseRevision_diagnosisRegistryId_fkey"
  FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_selectedDiagnosisId_fkey"
  FOREIGN KEY ("selectedDiagnosisId") REFERENCES "DiagnosisRegistry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_selectedAliasId_fkey"
  FOREIGN KEY ("selectedAliasId") REFERENCES "DiagnosisAlias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_strictMatchedDiagnosisId_fkey"
  FOREIGN KEY ("strictMatchedDiagnosisId") REFERENCES "DiagnosisRegistry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_strictMatchedAliasId_fkey"
  FOREIGN KEY ("strictMatchedAliasId") REFERENCES "DiagnosisAlias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
