-- CreateTable
CREATE TABLE "GovernedCaseRevisionApprovalDecision" (
    "id" TEXT NOT NULL,
    "commandAction" TEXT NOT NULL,
    "commandIdempotencyKey" TEXT NOT NULL,
    "commandFingerprint" TEXT NOT NULL,
    "envelopeSchemaVersion" TEXT NOT NULL,
    "extensionType" TEXT NOT NULL,
    "extensionSchemaVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "validatedEnvelope" JSONB NOT NULL,
    "extensionPayload" JSONB NOT NULL,
    "primaryTarget" JSONB NOT NULL,
    "targetReferences" JSONB NOT NULL,
    "actorType" TEXT NOT NULL,
    "approvalRecordId" TEXT NOT NULL,
    "authorityAssignmentId" TEXT NOT NULL,
    "authorityEvidenceReference" TEXT NOT NULL,
    "authorityScopeSnapshot" JSONB NOT NULL,
    "authorityResolvedAt" TIMESTAMP(3) NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "targetRevisionId" TEXT NOT NULL,
    "expectedRevisionId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "effectiveAction" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "reviewBasis" JSONB NOT NULL,
    "obligations" JSONB NOT NULL,
    "compatibilityProjection" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernedCaseRevisionApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialAuthorityAssignment" (
    "id" TEXT NOT NULL,
    "assignmentSchemaVersion" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "authorityType" TEXT NOT NULL,
    "authorityTypeSchemaVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scopeMode" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "allowedDecisionTypes" TEXT[] NOT NULL,
    "authorityEvidenceReference" TEXT NOT NULL,
    "grantingAuthoritySnapshot" JSONB NOT NULL,
    "grantedByActorType" TEXT NOT NULL,
    "grantedByActorId" TEXT NOT NULL,
    "grantingAuthorityAssignmentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "rationale" TEXT NOT NULL,
    "delegationAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maximumDelegationDepth" INTEGER NOT NULL DEFAULT 0,
    "parentAssignmentId" TEXT,
    "humanAuthorityActorId" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByActorId" TEXT,
    "supersededByAssignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialAuthorityAssignment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CaseReview" ADD COLUMN "materialContextHash" TEXT,
ADD COLUMN "reviewContextIdentity" TEXT;

-- AlterTable
ALTER TABLE "CaseValidationRun" ADD COLUMN "materialContextHash" TEXT,
ADD COLUMN "reviewContextIdentity" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GovernedCaseRevisionApprovalDecision_commandIdempotencyKey_key" ON "GovernedCaseRevisionApprovalDecision"("commandIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GovernedCaseRevisionApprovalDecision_reviewId_key" ON "GovernedCaseRevisionApprovalDecision"("reviewId");

-- CreateIndex
CREATE INDEX "GovernedCaseRevisionApprovalDecision_caseId_idx" ON "GovernedCaseRevisionApprovalDecision"("caseId");

-- CreateIndex
CREATE INDEX "GovernedCaseRevisionApprovalDecision_targetRevisionId_idx" ON "GovernedCaseRevisionApprovalDecision"("targetRevisionId");

-- CreateIndex
CREATE INDEX "GovernedCaseRevisionApprovalDecision_actorUserId_idx" ON "GovernedCaseRevisionApprovalDecision"("actorUserId");

-- CreateIndex
CREATE INDEX "GovernedCaseRevisionApprovalDecision_approvalRecordId_idx" ON "GovernedCaseRevisionApprovalDecision"("approvalRecordId");

-- CreateIndex
CREATE INDEX "GovernedCaseRevisionApprovalDecision_occurredAt_idx" ON "GovernedCaseRevisionApprovalDecision"("occurredAt");

-- CreateIndex
CREATE INDEX "EditorialAuthorityAssignment_subjectId_idx" ON "EditorialAuthorityAssignment"("subjectId");

-- CreateIndex
CREATE INDEX "EditorialAuthorityAssignment_authorityType_idx" ON "EditorialAuthorityAssignment"("authorityType");

-- CreateIndex
CREATE INDEX "EditorialAuthorityAssignment_status_idx" ON "EditorialAuthorityAssignment"("status");

-- CreateIndex
CREATE INDEX "EditorialAuthorityAssignment_validFrom_idx" ON "EditorialAuthorityAssignment"("validFrom");

-- CreateIndex
CREATE INDEX "EditorialAuthorityAssignment_validUntil_idx" ON "EditorialAuthorityAssignment"("validUntil");

-- CreateIndex
CREATE INDEX "CaseReview_materialContextHash_idx" ON "CaseReview"("materialContextHash");

-- CreateIndex
CREATE INDEX "CaseValidationRun_materialContextHash_idx" ON "CaseValidationRun"("materialContextHash");

-- AddForeignKey
ALTER TABLE "GovernedCaseRevisionApprovalDecision" ADD CONSTRAINT "GovernedCaseRevisionApprovalDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernedCaseRevisionApprovalDecision" ADD CONSTRAINT "GovernedCaseRevisionApprovalDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernedCaseRevisionApprovalDecision" ADD CONSTRAINT "GovernedCaseRevisionApprovalDecision_targetRevisionId_fkey" FOREIGN KEY ("targetRevisionId") REFERENCES "CaseRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernedCaseRevisionApprovalDecision" ADD CONSTRAINT "GovernedCaseRevisionApprovalDecision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CaseReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialAuthorityAssignment" ADD CONSTRAINT "EditorialAuthorityAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
