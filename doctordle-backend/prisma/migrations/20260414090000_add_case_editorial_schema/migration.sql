DO $$
BEGIN
  CREATE TYPE "CaseEditorialStatus" AS ENUM (
    'DRAFT',
    'VALIDATING',
    'VALIDATED',
    'REVIEW',
    'NEEDS_EDIT',
    'APPROVED',
    'READY_TO_PUBLISH',
    'PUBLISHED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ValidationOutcome" AS ENUM ('PASSED', 'FAILED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'NEEDS_EDIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CaseSource" AS ENUM ('GENERATED', 'MANUAL', 'ADMIN_EDIT', 'RESTORED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PublishTrack" AS ENUM ('DAILY', 'PREMIUM', 'PRACTICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Case"
ADD COLUMN IF NOT EXISTS "editorialStatus" "CaseEditorialStatus",
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "currentRevisionId" TEXT;

CREATE TABLE IF NOT EXISTS "CaseRevision" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL DEFAULT 1,
  "source" "CaseSource",
  "publishTrack" "PublishTrack",
  "editorialStatus" "CaseEditorialStatus",
  "title" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "difficulty" TEXT NOT NULL,
  "history" TEXT NOT NULL,
  "symptoms" TEXT[] NOT NULL,
  "labs" JSONB,
  "clues" JSONB,
  "explanation" JSONB,
  "differentials" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "diagnosisId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaseValidationRun" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId" TEXT NOT NULL,
  "revisionId" TEXT,
  "source" "CaseSource",
  "publishTrack" "PublishTrack",
  "outcome" "ValidationOutcome",
  "validatorVersion" TEXT,
  "summary" JSONB,
  "findings" JSONB,
  "triggeredByUserId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CaseValidationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaseReview" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId" TEXT NOT NULL,
  "revisionId" TEXT,
  "reviewerUserId" TEXT,
  "decision" "ReviewDecision",
  "notes" TEXT,
  "source" "CaseSource",
  "publishTrack" "PublishTrack",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "CaseReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Case_currentRevisionId_key"
ON "Case"("currentRevisionId");

CREATE UNIQUE INDEX IF NOT EXISTS "CaseRevision_caseId_revisionNumber_key"
ON "CaseRevision"("caseId", "revisionNumber");

CREATE INDEX IF NOT EXISTS "CaseRevision_caseId_idx"
ON "CaseRevision"("caseId");

CREATE INDEX IF NOT EXISTS "CaseRevision_diagnosisId_idx"
ON "CaseRevision"("diagnosisId");

CREATE INDEX IF NOT EXISTS "CaseRevision_createdByUserId_idx"
ON "CaseRevision"("createdByUserId");

CREATE INDEX IF NOT EXISTS "CaseRevision_createdAt_idx"
ON "CaseRevision"("createdAt");

CREATE INDEX IF NOT EXISTS "CaseValidationRun_caseId_idx"
ON "CaseValidationRun"("caseId");

CREATE INDEX IF NOT EXISTS "CaseValidationRun_revisionId_idx"
ON "CaseValidationRun"("revisionId");

CREATE INDEX IF NOT EXISTS "CaseValidationRun_triggeredByUserId_idx"
ON "CaseValidationRun"("triggeredByUserId");

CREATE INDEX IF NOT EXISTS "CaseValidationRun_startedAt_idx"
ON "CaseValidationRun"("startedAt");

CREATE INDEX IF NOT EXISTS "CaseReview_caseId_idx"
ON "CaseReview"("caseId");

CREATE INDEX IF NOT EXISTS "CaseReview_revisionId_idx"
ON "CaseReview"("revisionId");

CREATE INDEX IF NOT EXISTS "CaseReview_reviewerUserId_idx"
ON "CaseReview"("reviewerUserId");

CREATE INDEX IF NOT EXISTS "CaseReview_createdAt_idx"
ON "CaseReview"("createdAt");

DO $$
BEGIN
  ALTER TABLE "Case"
  ADD CONSTRAINT "Case_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseRevision"
  ADD CONSTRAINT "CaseRevision_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseRevision"
  ADD CONSTRAINT "CaseRevision_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseRevision"
  ADD CONSTRAINT "CaseRevision_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Case"
  ADD CONSTRAINT "Case_currentRevisionId_fkey"
  FOREIGN KEY ("currentRevisionId") REFERENCES "CaseRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseValidationRun"
  ADD CONSTRAINT "CaseValidationRun_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseValidationRun"
  ADD CONSTRAINT "CaseValidationRun_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "CaseRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseValidationRun"
  ADD CONSTRAINT "CaseValidationRun_triggeredByUserId_fkey"
  FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseReview"
  ADD CONSTRAINT "CaseReview_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseReview"
  ADD CONSTRAINT "CaseReview_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "CaseRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseReview"
  ADD CONSTRAINT "CaseReview_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
