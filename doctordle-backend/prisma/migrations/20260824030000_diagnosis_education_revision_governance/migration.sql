-- CreateEnum
CREATE TYPE "DiagnosisEducationRevisionApprovalOutcome" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUIRED');

-- CreateEnum
CREATE TYPE "DiagnosisEducationRevisionApprovalStanding" AS ENUM ('STANDING', 'SUPERSEDED', 'NON_STANDING');

-- CreateEnum
CREATE TYPE "DiagnosisEducationPublicationStanding" AS ENUM ('AUTHORIZED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "DiagnosisEducationRevisionApprovalDecision" (
    "id" TEXT NOT NULL,
    "commandAction" TEXT NOT NULL,
    "commandIdempotencyKey" TEXT NOT NULL,
    "commandFingerprint" TEXT NOT NULL,
    "educationId" TEXT NOT NULL,
    "diagnosisRegistryId" TEXT NOT NULL,
    "educationRevisionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "outcome" "DiagnosisEducationRevisionApprovalOutcome" NOT NULL,
    "standing" "DiagnosisEducationRevisionApprovalStanding" NOT NULL DEFAULT 'NON_STANDING',
    "standingReason" TEXT,
    "actorUserId" TEXT,
    "authorityRationale" TEXT NOT NULL,
    "authorityReferences" JSONB,
    "materialContextHash" TEXT NOT NULL,
    "materialContextSnapshot" JSONB NOT NULL,
    "validationContextSnapshot" JSONB,
    "assessmentContextSnapshot" JSONB,
    "compatibilityProjection" JSONB,
    "supersedesDecisionId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosisEducationRevisionApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisEducationPublicationDecision" (
    "id" TEXT NOT NULL,
    "commandAction" TEXT NOT NULL,
    "commandIdempotencyKey" TEXT NOT NULL,
    "commandFingerprint" TEXT NOT NULL,
    "educationId" TEXT NOT NULL,
    "diagnosisRegistryId" TEXT NOT NULL,
    "educationRevisionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "approvalDecisionId" TEXT NOT NULL,
    "expectedApprovalDecisionId" TEXT NOT NULL,
    "expectedActivePublicationId" TEXT,
    "actorUserId" TEXT,
    "authorityRationale" TEXT NOT NULL,
    "authorityReferences" JSONB,
    "publicationChannel" TEXT NOT NULL DEFAULT 'LEARNER',
    "readinessResult" TEXT NOT NULL,
    "readinessSnapshot" JSONB NOT NULL,
    "materialContextHash" TEXT NOT NULL,
    "materialContextSnapshot" JSONB NOT NULL,
    "standing" "DiagnosisEducationPublicationStanding" NOT NULL DEFAULT 'AUTHORIZED',
    "standingReason" TEXT,
    "supersedesPublicationId" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnByUserId" TEXT,
    "withdrawalRationale" TEXT,
    "compatibilityProjection" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosisEducationPublicationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEducationRevisionApprovalDecision_commandIdempotencyKey_key" ON "DiagnosisEducationRevisionApprovalDecision"("commandIdempotencyKey");
CREATE INDEX "DiagnosisEducationRevisionApprovalDecision_educationId_idx" ON "DiagnosisEducationRevisionApprovalDecision"("educationId");
CREATE INDEX "DiagnosisEducationRevisionApprovalDecision_diagnosisRegistryId_idx" ON "DiagnosisEducationRevisionApprovalDecision"("diagnosisRegistryId");
CREATE INDEX "DiagnosisEducationRevisionApprovalDecision_educationRevisionId_idx" ON "DiagnosisEducationRevisionApprovalDecision"("educationRevisionId");
CREATE INDEX "DiagnosisEducationRevisionApprovalDecision_actorUserId_idx" ON "DiagnosisEducationRevisionApprovalDecision"("actorUserId");
CREATE INDEX "DiagnosisEducationRevisionApprovalDecision_outcome_idx" ON "DiagnosisEducationRevisionApprovalDecision"("outcome");
CREATE INDEX "DiagnosisEducationRevisionApprovalDecision_standing_idx" ON "DiagnosisEducationRevisionApprovalDecision"("standing");
CREATE INDEX "DiagnosisEducationRevisionApprovalDecision_occurredAt_idx" ON "DiagnosisEducationRevisionApprovalDecision"("occurredAt");
CREATE UNIQUE INDEX "DiagnosisEducationRevisionApprovalDecision_standing_approved_key" ON "DiagnosisEducationRevisionApprovalDecision"("educationId") WHERE "outcome" = 'APPROVED' AND "standing" = 'STANDING';

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEducationPublicationDecision_commandIdempotencyKey_key" ON "DiagnosisEducationPublicationDecision"("commandIdempotencyKey");
CREATE INDEX "DiagnosisEducationPublicationDecision_educationId_idx" ON "DiagnosisEducationPublicationDecision"("educationId");
CREATE INDEX "DiagnosisEducationPublicationDecision_diagnosisRegistryId_idx" ON "DiagnosisEducationPublicationDecision"("diagnosisRegistryId");
CREATE INDEX "DiagnosisEducationPublicationDecision_educationRevisionId_idx" ON "DiagnosisEducationPublicationDecision"("educationRevisionId");
CREATE INDEX "DiagnosisEducationPublicationDecision_approvalDecisionId_idx" ON "DiagnosisEducationPublicationDecision"("approvalDecisionId");
CREATE INDEX "DiagnosisEducationPublicationDecision_actorUserId_idx" ON "DiagnosisEducationPublicationDecision"("actorUserId");
CREATE INDEX "DiagnosisEducationPublicationDecision_standing_idx" ON "DiagnosisEducationPublicationDecision"("standing");
CREATE INDEX "DiagnosisEducationPublicationDecision_publicationChannel_idx" ON "DiagnosisEducationPublicationDecision"("publicationChannel");
CREATE INDEX "DiagnosisEducationPublicationDecision_occurredAt_idx" ON "DiagnosisEducationPublicationDecision"("occurredAt");
CREATE UNIQUE INDEX "DiagnosisEducationPublicationDecision_authorized_education_key" ON "DiagnosisEducationPublicationDecision"("educationId", "publicationChannel") WHERE "standing" = 'AUTHORIZED';
CREATE UNIQUE INDEX "DiagnosisEducationPublicationDecision_authorized_revision_key" ON "DiagnosisEducationPublicationDecision"("educationRevisionId", "publicationChannel") WHERE "standing" = 'AUTHORIZED';

-- AddForeignKey
ALTER TABLE "DiagnosisEducationRevisionApprovalDecision" ADD CONSTRAINT "DiagnosisEducationRevisionApprovalDecision_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "DiagnosisEducation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationRevisionApprovalDecision" ADD CONSTRAINT "DiagnosisEducationRevisionApprovalDecision_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationRevisionApprovalDecision" ADD CONSTRAINT "DiagnosisEducationRevisionApprovalDecision_educationRevisionId_fkey" FOREIGN KEY ("educationRevisionId") REFERENCES "DiagnosisEducationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationRevisionApprovalDecision" ADD CONSTRAINT "DiagnosisEducationRevisionApprovalDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationRevisionApprovalDecision" ADD CONSTRAINT "DiagnosisEducationRevisionApprovalDecision_supersedesDecisionId_fkey" FOREIGN KEY ("supersedesDecisionId") REFERENCES "DiagnosisEducationRevisionApprovalDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationPublicationDecision" ADD CONSTRAINT "DiagnosisEducationPublicationDecision_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "DiagnosisEducation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationPublicationDecision" ADD CONSTRAINT "DiagnosisEducationPublicationDecision_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationPublicationDecision" ADD CONSTRAINT "DiagnosisEducationPublicationDecision_educationRevisionId_fkey" FOREIGN KEY ("educationRevisionId") REFERENCES "DiagnosisEducationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationPublicationDecision" ADD CONSTRAINT "DiagnosisEducationPublicationDecision_approvalDecisionId_fkey" FOREIGN KEY ("approvalDecisionId") REFERENCES "DiagnosisEducationRevisionApprovalDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationPublicationDecision" ADD CONSTRAINT "DiagnosisEducationPublicationDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationPublicationDecision" ADD CONSTRAINT "DiagnosisEducationPublicationDecision_withdrawnByUserId_fkey" FOREIGN KEY ("withdrawnByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosisEducationPublicationDecision" ADD CONSTRAINT "DiagnosisEducationPublicationDecision_supersedesPublicationId_fkey" FOREIGN KEY ("supersedesPublicationId") REFERENCES "DiagnosisEducationPublicationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
