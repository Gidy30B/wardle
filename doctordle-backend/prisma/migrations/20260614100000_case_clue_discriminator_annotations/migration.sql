-- Editorial-only annotations linking case clues to mimic elimination reasoning.
CREATE TABLE IF NOT EXISTS "CaseClueDiscriminatorAnnotation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "clueOrder" INTEGER NOT NULL,
    "clueIndex" INTEGER,
    "eliminatedDiagnosisId" TEXT,
    "eliminatedDiagnosisName" TEXT NOT NULL,
    "discriminator" TEXT NOT NULL,
    "reasoning" TEXT,
    "eliminationStrength" TEXT NOT NULL DEFAULT 'moderate',
    "educationalValue" TEXT NOT NULL DEFAULT 'medium',
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseClueDiscriminatorAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaseClueDiscriminatorAnnotation_caseId_clueOrder_idx"
ON "CaseClueDiscriminatorAnnotation"("caseId", "clueOrder");

CREATE INDEX IF NOT EXISTS "CaseClueDiscriminatorAnnotation_caseId_eliminatedDiagnosisName_idx"
ON "CaseClueDiscriminatorAnnotation"("caseId", "eliminatedDiagnosisName");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CaseClueDiscriminatorAnnotation_caseId_fkey'
  ) THEN
    ALTER TABLE "CaseClueDiscriminatorAnnotation"
    ADD CONSTRAINT "CaseClueDiscriminatorAnnotation_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "CaseClueProgressionAnalysis"
ADD COLUMN IF NOT EXISTS "explicitDiscriminatorAnnotationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "heuristicOnlyEliminationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "missingEditorialAnnotationCount" INTEGER NOT NULL DEFAULT 0;
