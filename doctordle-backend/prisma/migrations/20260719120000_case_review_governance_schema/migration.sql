CREATE TYPE "CaseReviewContextSnapshotPurpose" AS ENUM (
  'REVIEW_OPENING',
  'DECISION_SUBMISSION',
  'PUBLICATION_READINESS'
);

CREATE TYPE "CaseEditorialDecisionType" AS ENUM (
  'APPROVE',
  'REJECT',
  'REQUEST_CHANGES',
  'MARK_READY_TO_PUBLISH'
);

CREATE TYPE "CaseReviewEventType" AS ENUM (
  'REVIEW_OPENED',
  'REVIEW_REFRESHED',
  'REVIEW_ASSIGNED',
  'REVIEW_CANCELLED',
  'DECISION_SUBMITTED',
  'PUBLICATION_READINESS_DECIDED',
  'SNAPSHOT_INVALIDATED'
);

CREATE TYPE "PublicationReadinessOutcome" AS ENUM (
  'READY',
  'BLOCKED',
  'STALE'
);

CREATE TYPE "CaseReviewStalenessReason" AS ENUM (
  'CASE_REVISION_CHANGED',
  'VALIDATION_CHANGED',
  'VALIDATION_FAILED',
  'VALIDATION_POLICY_CHANGED',
  'DIAGNOSIS_READINESS_CHANGED',
  'EVIDENCE_CHANGED',
  'REASONING_CHANGED',
  'TEACHING_DEPENDENCIES_CHANGED',
  'AI_PROVENANCE_CHANGED',
  'CLUE_DRAFT_STATE_CHANGED',
  'BLOCKERS_CHANGED',
  'WARNINGS_CHANGED'
);

CREATE TABLE "CaseReviewContextSnapshot" (
  "id" TEXT NOT NULL,
  "caseReviewId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "purpose" "CaseReviewContextSnapshotPurpose" NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "context" JSONB NOT NULL,
  "componentHashes" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invalidatedAt" TIMESTAMP(3),
  "invalidationReason" "CaseReviewStalenessReason",

  CONSTRAINT "CaseReviewContextSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseEditorialDecision" (
  "id" TEXT NOT NULL,
  "caseReviewId" TEXT NOT NULL,
  "contextSnapshotId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "decisionType" "CaseEditorialDecisionType" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "previousEditorialStatus" "CaseEditorialStatus",
  "resultingEditorialStatus" "CaseEditorialStatus",
  "supportingValidationRunId" TEXT,
  "readinessOutcome" "PublicationReadinessOutcome",
  "blockers" JSONB,
  "warnings" JSONB,
  "approvingDecisionId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseEditorialDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseReviewEvent" (
  "id" TEXT NOT NULL,
  "caseReviewId" TEXT,
  "caseId" TEXT NOT NULL,
  "revisionId" TEXT,
  "eventType" "CaseReviewEventType" NOT NULL,
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "payload" JSONB,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseReviewContextSnapshot_caseId_createdAt_idx" ON "CaseReviewContextSnapshot"("caseId", "createdAt");
CREATE INDEX "CaseReviewContextSnapshot_caseReviewId_createdAt_idx" ON "CaseReviewContextSnapshot"("caseReviewId", "createdAt");
CREATE INDEX "CaseReviewContextSnapshot_revisionId_createdAt_idx" ON "CaseReviewContextSnapshot"("revisionId", "createdAt");
CREATE INDEX "CaseReviewContextSnapshot_contentHash_idx" ON "CaseReviewContextSnapshot"("contentHash");

CREATE INDEX "CaseEditorialDecision_caseId_createdAt_idx" ON "CaseEditorialDecision"("caseId", "createdAt");
CREATE INDEX "CaseEditorialDecision_caseReviewId_createdAt_idx" ON "CaseEditorialDecision"("caseReviewId", "createdAt");
CREATE INDEX "CaseEditorialDecision_contextSnapshotId_idx" ON "CaseEditorialDecision"("contextSnapshotId");
CREATE INDEX "CaseEditorialDecision_revisionId_createdAt_idx" ON "CaseEditorialDecision"("revisionId", "createdAt");
CREATE INDEX "CaseEditorialDecision_decisionType_createdAt_idx" ON "CaseEditorialDecision"("decisionType", "createdAt");
CREATE INDEX "CaseEditorialDecision_supportingValidationRunId_idx" ON "CaseEditorialDecision"("supportingValidationRunId");
CREATE INDEX "CaseEditorialDecision_approvingDecisionId_idx" ON "CaseEditorialDecision"("approvingDecisionId");
CREATE INDEX "CaseEditorialDecision_correlationId_idx" ON "CaseEditorialDecision"("correlationId");

CREATE INDEX "CaseReviewEvent_caseId_createdAt_idx" ON "CaseReviewEvent"("caseId", "createdAt");
CREATE INDEX "CaseReviewEvent_caseReviewId_createdAt_idx" ON "CaseReviewEvent"("caseReviewId", "createdAt");
CREATE INDEX "CaseReviewEvent_revisionId_createdAt_idx" ON "CaseReviewEvent"("revisionId", "createdAt");
CREATE INDEX "CaseReviewEvent_eventType_createdAt_idx" ON "CaseReviewEvent"("eventType", "createdAt");
CREATE INDEX "CaseReviewEvent_actorUserId_createdAt_idx" ON "CaseReviewEvent"("actorUserId", "createdAt");
CREATE INDEX "CaseReviewEvent_correlationId_idx" ON "CaseReviewEvent"("correlationId");

ALTER TABLE "CaseReviewContextSnapshot"
  ADD CONSTRAINT "CaseReviewContextSnapshot_caseReviewId_fkey"
  FOREIGN KEY ("caseReviewId") REFERENCES "CaseReview"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseReviewContextSnapshot"
  ADD CONSTRAINT "CaseReviewContextSnapshot_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseReviewContextSnapshot"
  ADD CONSTRAINT "CaseReviewContextSnapshot_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "CaseRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseReviewContextSnapshot"
  ADD CONSTRAINT "CaseReviewContextSnapshot_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseEditorialDecision"
  ADD CONSTRAINT "CaseEditorialDecision_caseReviewId_fkey"
  FOREIGN KEY ("caseReviewId") REFERENCES "CaseReview"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseEditorialDecision"
  ADD CONSTRAINT "CaseEditorialDecision_contextSnapshotId_fkey"
  FOREIGN KEY ("contextSnapshotId") REFERENCES "CaseReviewContextSnapshot"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseEditorialDecision"
  ADD CONSTRAINT "CaseEditorialDecision_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseEditorialDecision"
  ADD CONSTRAINT "CaseEditorialDecision_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "CaseRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseEditorialDecision"
  ADD CONSTRAINT "CaseEditorialDecision_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseEditorialDecision"
  ADD CONSTRAINT "CaseEditorialDecision_supportingValidationRunId_fkey"
  FOREIGN KEY ("supportingValidationRunId") REFERENCES "CaseValidationRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseEditorialDecision"
  ADD CONSTRAINT "CaseEditorialDecision_approvingDecisionId_fkey"
  FOREIGN KEY ("approvingDecisionId") REFERENCES "CaseEditorialDecision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseReviewEvent"
  ADD CONSTRAINT "CaseReviewEvent_caseReviewId_fkey"
  FOREIGN KEY ("caseReviewId") REFERENCES "CaseReview"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseReviewEvent"
  ADD CONSTRAINT "CaseReviewEvent_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseReviewEvent"
  ADD CONSTRAINT "CaseReviewEvent_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "CaseRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseReviewEvent"
  ADD CONSTRAINT "CaseReviewEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
