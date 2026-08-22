CREATE TYPE "ClinicalCaseDraftStatus" AS ENUM (
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'SUPERSEDED',
  'APPLIED'
);

CREATE TYPE "ClinicalCaseDraftReviewDecision" AS ENUM (
  'ACCEPT',
  'REJECT',
  'REQUEST_CHANGES'
);

CREATE TYPE "ClinicalCaseDraftApplicationStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'CONFLICT'
);

CREATE TABLE "ClinicalCaseDraft" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "artifactFamily" TEXT NOT NULL DEFAULT 'CLINICAL_CASE',
  "generationPurpose" TEXT NOT NULL DEFAULT 'AI_CLINICAL_CASE_GENERATION',
  "generationMethod" TEXT NOT NULL DEFAULT 'registry_target',
  "selectionSource" TEXT,
  "sourceIssue" JSONB,
  "generationContext" JSONB NOT NULL,
  "generationContextHash" TEXT NOT NULL,
  "generatedContent" JSONB NOT NULL,
  "validationStatus" "ValidationOutcome" NOT NULL,
  "validationSummary" JSONB NOT NULL,
  "validationFindings" JSONB NOT NULL,
  "blockingFindings" JSONB,
  "warningFindings" JSONB,
  "reviewStatus" "ClinicalCaseDraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "latestReviewDecisionId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "acceptedByUserId" TEXT,
  "appliedAt" TIMESTAMP(3),
  "appliedByUserId" TEXT,
  "resultingCaseId" TEXT,
  "resultingCaseRevisionId" TEXT,
  "supersededByDraftId" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalCaseDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalCaseDraftReviewDecisionRecord" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "decision" "ClinicalCaseDraftReviewDecision" NOT NULL,
  "reviewerUserId" TEXT,
  "rationale" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicalCaseDraftReviewDecisionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalCaseDraftApplicationCommand" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "commandAction" TEXT NOT NULL,
  "commandIdempotencyKey" TEXT NOT NULL,
  "commandFingerprint" TEXT NOT NULL,
  "actorUserId" TEXT,
  "status" "ClinicalCaseDraftApplicationStatus" NOT NULL,
  "resultCaseId" TEXT,
  "resultCaseRevisionId" TEXT,
  "conflictReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ClinicalCaseDraftApplicationCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicalCaseDraft_latestReviewDecisionId_key" ON "ClinicalCaseDraft"("latestReviewDecisionId");
CREATE INDEX "ClinicalCaseDraft_diagnosisRegistryId_createdAt_idx" ON "ClinicalCaseDraft"("diagnosisRegistryId", "createdAt");
CREATE INDEX "ClinicalCaseDraft_reviewStatus_idx" ON "ClinicalCaseDraft"("reviewStatus");
CREATE INDEX "ClinicalCaseDraft_validationStatus_idx" ON "ClinicalCaseDraft"("validationStatus");
CREATE INDEX "ClinicalCaseDraft_generationPurpose_idx" ON "ClinicalCaseDraft"("generationPurpose");
CREATE INDEX "ClinicalCaseDraft_generationContextHash_idx" ON "ClinicalCaseDraft"("generationContextHash");
CREATE INDEX "ClinicalCaseDraft_resultingCaseId_idx" ON "ClinicalCaseDraft"("resultingCaseId");
CREATE INDEX "ClinicalCaseDraft_resultingCaseRevisionId_idx" ON "ClinicalCaseDraft"("resultingCaseRevisionId");
CREATE INDEX "ClinicalCaseDraft_createdByUserId_idx" ON "ClinicalCaseDraft"("createdByUserId");
CREATE INDEX "ClinicalCaseDraft_acceptedByUserId_idx" ON "ClinicalCaseDraft"("acceptedByUserId");
CREATE INDEX "ClinicalCaseDraft_appliedByUserId_idx" ON "ClinicalCaseDraft"("appliedByUserId");

CREATE INDEX "ClinicalCaseDraftReviewDecisionRecord_draftId_decidedAt_idx" ON "ClinicalCaseDraftReviewDecisionRecord"("draftId", "decidedAt");
CREATE INDEX "ClinicalCaseDraftReviewDecisionRecord_reviewerUserId_idx" ON "ClinicalCaseDraftReviewDecisionRecord"("reviewerUserId");
CREATE INDEX "ClinicalCaseDraftReviewDecisionRecord_decision_idx" ON "ClinicalCaseDraftReviewDecisionRecord"("decision");

CREATE UNIQUE INDEX "ClinicalCaseDraftApplicationCommand_commandIdempotencyKey_key" ON "ClinicalCaseDraftApplicationCommand"("commandIdempotencyKey");
CREATE INDEX "ClinicalCaseDraftApplicationCommand_draftId_idx" ON "ClinicalCaseDraftApplicationCommand"("draftId");
CREATE INDEX "ClinicalCaseDraftApplicationCommand_resultCaseId_idx" ON "ClinicalCaseDraftApplicationCommand"("resultCaseId");
CREATE INDEX "ClinicalCaseDraftApplicationCommand_resultCaseRevisionId_idx" ON "ClinicalCaseDraftApplicationCommand"("resultCaseRevisionId");
CREATE INDEX "ClinicalCaseDraftApplicationCommand_actorUserId_idx" ON "ClinicalCaseDraftApplicationCommand"("actorUserId");
CREATE INDEX "ClinicalCaseDraftApplicationCommand_status_idx" ON "ClinicalCaseDraftApplicationCommand"("status");

ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_latestReviewDecisionId_fkey" FOREIGN KEY ("latestReviewDecisionId") REFERENCES "ClinicalCaseDraftReviewDecisionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_resultingCaseId_fkey" FOREIGN KEY ("resultingCaseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_resultingCaseRevisionId_fkey" FOREIGN KEY ("resultingCaseRevisionId") REFERENCES "CaseRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraft" ADD CONSTRAINT "ClinicalCaseDraft_supersededByDraftId_fkey" FOREIGN KEY ("supersededByDraftId") REFERENCES "ClinicalCaseDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClinicalCaseDraftReviewDecisionRecord" ADD CONSTRAINT "ClinicalCaseDraftReviewDecisionRecord_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClinicalCaseDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraftReviewDecisionRecord" ADD CONSTRAINT "ClinicalCaseDraftReviewDecisionRecord_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClinicalCaseDraftApplicationCommand" ADD CONSTRAINT "ClinicalCaseDraftApplicationCommand_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClinicalCaseDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalCaseDraftApplicationCommand" ADD CONSTRAINT "ClinicalCaseDraftApplicationCommand_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
