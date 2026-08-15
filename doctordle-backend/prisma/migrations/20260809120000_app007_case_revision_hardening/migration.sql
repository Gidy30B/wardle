-- APP-007 Case Revision Mutation Hardening
-- Additive, nullable migration. Historical rows are not backfilled with
-- fabricated lineage, content hashes, or clue identity.

ALTER TABLE "CaseRevision"
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "createdFromRevisionId" TEXT,
  ADD COLUMN "changeSummary" TEXT,
  ADD COLUMN "changeReason" TEXT,
  ADD COLUMN "materialChange" JSONB;

CREATE TABLE "CaseRevisionCreationCommand" (
  "id" TEXT NOT NULL,
  "commandAction" TEXT NOT NULL,
  "commandIdempotencyKey" TEXT NOT NULL,
  "commandFingerprint" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "expectedRevisionId" TEXT NOT NULL,
  "resultRevisionId" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "CaseRevisionCreationCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseRevisionCreationCommand_commandIdempotencyKey_key"
  ON "CaseRevisionCreationCommand"("commandIdempotencyKey");

CREATE INDEX "CaseRevision_contentHash_idx"
  ON "CaseRevision"("contentHash");

CREATE INDEX "CaseRevision_createdFromRevisionId_idx"
  ON "CaseRevision"("createdFromRevisionId");

CREATE INDEX "CaseRevisionCreationCommand_caseId_idx"
  ON "CaseRevisionCreationCommand"("caseId");

CREATE INDEX "CaseRevisionCreationCommand_expectedRevisionId_idx"
  ON "CaseRevisionCreationCommand"("expectedRevisionId");

CREATE INDEX "CaseRevisionCreationCommand_resultRevisionId_idx"
  ON "CaseRevisionCreationCommand"("resultRevisionId");

CREATE INDEX "CaseRevisionCreationCommand_status_idx"
  ON "CaseRevisionCreationCommand"("status");

ALTER TABLE "CaseRevision"
  ADD CONSTRAINT "CaseRevision_createdFromRevisionId_fkey"
  FOREIGN KEY ("createdFromRevisionId") REFERENCES "CaseRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
