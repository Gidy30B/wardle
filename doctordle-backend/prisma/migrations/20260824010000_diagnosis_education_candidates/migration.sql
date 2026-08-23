-- CreateEnum
CREATE TYPE "DiagnosisEducationCandidateScope" AS ENUM ('WHOLE', 'SECTION');

-- CreateEnum
CREATE TYPE "DiagnosisEducationCandidateSection" AS ENUM ('differentials', 'investigations', 'examPearls', 'management');

-- CreateEnum
CREATE TYPE "DiagnosisEducationCandidateStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'NEEDS_CHANGES', 'SUPERSEDED', 'APPLIED');

-- CreateEnum
CREATE TYPE "DiagnosisEducationCandidateReviewDecision" AS ENUM ('ACCEPT', 'REJECT', 'REQUEST_CHANGES');

-- CreateEnum
CREATE TYPE "DiagnosisEducationCandidateApplicationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'SUCCESS', 'CONFLICT');

-- CreateTable
CREATE TABLE "DiagnosisEducationCandidate" (
    "id" TEXT NOT NULL,
    "diagnosisRegistryId" TEXT NOT NULL,
    "educationId" TEXT,
    "scope" "DiagnosisEducationCandidateScope" NOT NULL,
    "section" "DiagnosisEducationCandidateSection",
    "baseEducationVersion" INTEGER,
    "baseEducationRevisionId" TEXT,
    "originalSection" JSONB,
    "proposedEducation" JSONB,
    "proposedSection" JSONB,
    "proposedReferences" JSONB,
    "generationProvider" TEXT NOT NULL,
    "generationModel" TEXT NOT NULL,
    "generatorVersion" TEXT,
    "promptVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationPurpose" TEXT NOT NULL,
    "sourceIssue" JSONB,
    "inputContext" JSONB NOT NULL,
    "contextHash" TEXT NOT NULL,
    "sourceArtifactIds" JSONB,
    "validationStatus" "ValidationOutcome" NOT NULL,
    "validationSummary" JSONB NOT NULL,
    "validationBlockers" JSONB,
    "validationWarnings" JSONB,
    "validationMetadata" JSONB,
    "reviewStatus" "DiagnosisEducationCandidateStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "latestReviewDecisionId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "supersededByCandidateId" TEXT,
    "applicationStatus" "DiagnosisEducationCandidateApplicationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "appliedAt" TIMESTAMP(3),
    "appliedByUserId" TEXT,
    "resultingEducationId" TEXT,
    "resultingEducationVersion" INTEGER,
    "resultingRevisionId" TEXT,
    "applicationFailureReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisEducationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisEducationCandidateReviewDecisionRecord" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "decision" "DiagnosisEducationCandidateReviewDecision" NOT NULL,
    "reviewerUserId" TEXT,
    "rationale" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosisEducationCandidateReviewDecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisEducationCandidateApplicationCommand" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "commandAction" TEXT NOT NULL,
    "commandIdempotencyKey" TEXT NOT NULL,
    "commandFingerprint" TEXT NOT NULL,
    "actorUserId" TEXT,
    "authorityRationale" TEXT NOT NULL,
    "authorityReferences" JSONB,
    "status" "DiagnosisEducationCandidateApplicationStatus" NOT NULL,
    "resultEducationId" TEXT,
    "resultEducationVersion" INTEGER,
    "resultRevisionId" TEXT,
    "conflictReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiagnosisEducationCandidateApplicationCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEducationCandidate_latestReviewDecisionId_key" ON "DiagnosisEducationCandidate"("latestReviewDecisionId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_diagnosisRegistryId_createdAt_idx" ON "DiagnosisEducationCandidate"("diagnosisRegistryId", "createdAt");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_educationId_idx" ON "DiagnosisEducationCandidate"("educationId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_scope_section_idx" ON "DiagnosisEducationCandidate"("scope", "section");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_reviewStatus_idx" ON "DiagnosisEducationCandidate"("reviewStatus");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_applicationStatus_idx" ON "DiagnosisEducationCandidate"("applicationStatus");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_baseEducationVersion_idx" ON "DiagnosisEducationCandidate"("baseEducationVersion");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_baseEducationRevisionId_idx" ON "DiagnosisEducationCandidate"("baseEducationRevisionId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_resultingEducationId_idx" ON "DiagnosisEducationCandidate"("resultingEducationId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_resultingRevisionId_idx" ON "DiagnosisEducationCandidate"("resultingRevisionId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_createdByUserId_idx" ON "DiagnosisEducationCandidate"("createdByUserId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_acceptedByUserId_idx" ON "DiagnosisEducationCandidate"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidate_appliedByUserId_idx" ON "DiagnosisEducationCandidate"("appliedByUserId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateReviewDecisionRecord_candidateId_decidedAt_idx" ON "DiagnosisEducationCandidateReviewDecisionRecord"("candidateId", "decidedAt");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateReviewDecisionRecord_reviewerUserId_idx" ON "DiagnosisEducationCandidateReviewDecisionRecord"("reviewerUserId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateReviewDecisionRecord_decision_idx" ON "DiagnosisEducationCandidateReviewDecisionRecord"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEducationCandidateApplicationCommand_commandIdempotencyKey_key" ON "DiagnosisEducationCandidateApplicationCommand"("commandIdempotencyKey");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateApplicationCommand_candidateId_idx" ON "DiagnosisEducationCandidateApplicationCommand"("candidateId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateApplicationCommand_resultEducationId_idx" ON "DiagnosisEducationCandidateApplicationCommand"("resultEducationId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateApplicationCommand_resultRevisionId_idx" ON "DiagnosisEducationCandidateApplicationCommand"("resultRevisionId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateApplicationCommand_actorUserId_idx" ON "DiagnosisEducationCandidateApplicationCommand"("actorUserId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationCandidateApplicationCommand_status_idx" ON "DiagnosisEducationCandidateApplicationCommand"("status");

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "DiagnosisEducation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_baseEducationRevisionId_fkey" FOREIGN KEY ("baseEducationRevisionId") REFERENCES "DiagnosisEducationRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_resultingRevisionId_fkey" FOREIGN KEY ("resultingRevisionId") REFERENCES "DiagnosisEducationRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_latestReviewDecisionId_fkey" FOREIGN KEY ("latestReviewDecisionId") REFERENCES "DiagnosisEducationCandidateReviewDecisionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidate" ADD CONSTRAINT "DiagnosisEducationCandidate_supersededByCandidateId_fkey" FOREIGN KEY ("supersededByCandidateId") REFERENCES "DiagnosisEducationCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidateReviewDecisionRecord" ADD CONSTRAINT "DiagnosisEducationCandidateReviewDecisionRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiagnosisEducationCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidateReviewDecisionRecord" ADD CONSTRAINT "DiagnosisEducationCandidateReviewDecisionRecord_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidateApplicationCommand" ADD CONSTRAINT "DiagnosisEducationCandidateApplicationCommand_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiagnosisEducationCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationCandidateApplicationCommand" ADD CONSTRAINT "DiagnosisEducationCandidateApplicationCommand_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
