-- APP-008A Revision-Targeted Publication Governance
-- Additive migration only. No historical READY_TO_PUBLISH or PUBLISHED Case
-- rows are backfilled into canonical publication decisions.

CREATE TYPE "CaseRevisionPublicationStanding" AS ENUM (
  'AUTHORIZED',
  'WITHDRAWN',
  'SUPERSEDED'
);

CREATE TABLE "CaseRevisionPublicationDecision" (
  "id" TEXT NOT NULL,
  "commandAction" TEXT NOT NULL,
  "commandIdempotencyKey" TEXT NOT NULL,
  "commandFingerprint" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "caseRevisionId" TEXT NOT NULL,
  "expectedRevisionId" TEXT NOT NULL,
  "approvalDecisionId" TEXT NOT NULL,
  "expectedApprovalDecisionId" TEXT NOT NULL,
  "materialContextHash" TEXT NOT NULL,
  "expectedMaterialContextHash" TEXT NOT NULL,
  "validationRunId" TEXT,
  "expectedValidationRunId" TEXT,
  "reviewContextIdentity" TEXT,
  "actorUserId" TEXT NOT NULL,
  "approvalRecordId" TEXT NOT NULL,
  "authorityAssignmentId" TEXT NOT NULL,
  "authorityEvidenceReference" TEXT NOT NULL,
  "authorityScopeSnapshot" JSONB NOT NULL,
  "authorityResolvedAt" TIMESTAMP(3) NOT NULL,
  "readinessResult" TEXT NOT NULL,
  "readinessSnapshot" JSONB NOT NULL,
  "contentBoundarySnapshot" JSONB NOT NULL,
  "standing" "CaseRevisionPublicationStanding" NOT NULL DEFAULT 'AUTHORIZED',
  "standingReason" TEXT,
  "supersedesPublicationId" TEXT,
  "withdrawnAt" TIMESTAMP(3),
  "withdrawnByUserId" TEXT,
  "decisionType" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "effectiveAction" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "findings" JSONB NOT NULL,
  "compatibilityProjection" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseRevisionPublicationDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseRevisionPublicationCommand" (
  "id" TEXT NOT NULL,
  "commandAction" TEXT NOT NULL,
  "commandIdempotencyKey" TEXT NOT NULL,
  "commandFingerprint" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "expectedRevisionId" TEXT NOT NULL,
  "expectedApprovalDecisionId" TEXT NOT NULL,
  "resultPublicationDecisionId" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "CaseRevisionPublicationCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseRevisionPublicationDecision_commandIdempotencyKey_key"
  ON "CaseRevisionPublicationDecision"("commandIdempotencyKey");

CREATE UNIQUE INDEX "CaseRevisionPublicationCommand_commandIdempotencyKey_key"
  ON "CaseRevisionPublicationCommand"("commandIdempotencyKey");

CREATE UNIQUE INDEX "CaseRevisionPublicationDecision_case_authorized_key"
  ON "CaseRevisionPublicationDecision"("caseId")
  WHERE "standing" = 'AUTHORIZED';

CREATE UNIQUE INDEX "CaseRevisionPublicationDecision_revision_authorized_key"
  ON "CaseRevisionPublicationDecision"("caseRevisionId")
  WHERE "standing" = 'AUTHORIZED';

CREATE INDEX "CaseRevisionPublicationDecision_caseId_idx"
  ON "CaseRevisionPublicationDecision"("caseId");

CREATE INDEX "CaseRevisionPublicationDecision_caseRevisionId_idx"
  ON "CaseRevisionPublicationDecision"("caseRevisionId");

CREATE INDEX "CaseRevisionPublicationDecision_approvalDecisionId_idx"
  ON "CaseRevisionPublicationDecision"("approvalDecisionId");

CREATE INDEX "CaseRevisionPublicationDecision_actorUserId_idx"
  ON "CaseRevisionPublicationDecision"("actorUserId");

CREATE INDEX "CaseRevisionPublicationDecision_standing_idx"
  ON "CaseRevisionPublicationDecision"("standing");

CREATE INDEX "CaseRevisionPublicationDecision_occurredAt_idx"
  ON "CaseRevisionPublicationDecision"("occurredAt");

CREATE INDEX "CaseRevisionPublicationCommand_caseId_idx"
  ON "CaseRevisionPublicationCommand"("caseId");

CREATE INDEX "CaseRevisionPublicationCommand_expectedRevisionId_idx"
  ON "CaseRevisionPublicationCommand"("expectedRevisionId");

CREATE INDEX "CaseRevisionPublicationCommand_expectedApprovalDecisionId_idx"
  ON "CaseRevisionPublicationCommand"("expectedApprovalDecisionId");

CREATE INDEX "CaseRevisionPublicationCommand_resultPublicationDecisionId_idx"
  ON "CaseRevisionPublicationCommand"("resultPublicationDecisionId");

CREATE INDEX "CaseRevisionPublicationCommand_status_idx"
  ON "CaseRevisionPublicationCommand"("status");

ALTER TABLE "CaseRevisionPublicationDecision"
  ADD CONSTRAINT "CaseRevisionPublicationDecision_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseRevisionPublicationDecision"
  ADD CONSTRAINT "CaseRevisionPublicationDecision_caseRevisionId_fkey"
  FOREIGN KEY ("caseRevisionId") REFERENCES "CaseRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseRevisionPublicationDecision"
  ADD CONSTRAINT "CaseRevisionPublicationDecision_approvalDecisionId_fkey"
  FOREIGN KEY ("approvalDecisionId") REFERENCES "GovernedCaseRevisionApprovalDecision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseRevisionPublicationDecision"
  ADD CONSTRAINT "CaseRevisionPublicationDecision_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseRevisionPublicationDecision"
  ADD CONSTRAINT "CaseRevisionPublicationDecision_supersedesPublicationId_fkey"
  FOREIGN KEY ("supersedesPublicationId") REFERENCES "CaseRevisionPublicationDecision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
