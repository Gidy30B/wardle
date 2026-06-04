CREATE TYPE "DiagnosisRegistryCandidateStatus" AS ENUM (
    'CANDIDATE',
    'NEEDS_REVIEW',
    'REJECTED',
    'MERGED',
    'APPROVED_PENDING_CREATE',
    'CREATED'
);

CREATE TABLE "DiagnosisRegistryCandidate" (
    "id" TEXT NOT NULL,
    "proposedCanonicalName" TEXT NOT NULL,
    "proposedCanonicalNormalized" TEXT NOT NULL,
    "proposedDisplayLabel" TEXT NOT NULL,
    "proposedAliases" JSONB,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceMappingId" TEXT,
    "sourceRawText" TEXT NOT NULL,
    "contextDiagnosisRegistryId" TEXT,
    "duplicateSuggestions" JSONB,
    "status" "DiagnosisRegistryCandidateStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdRegistryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisRegistryCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosisRegistryCandidate_sourceMappingId_proposedCanonicalNormalized_key"
ON "DiagnosisRegistryCandidate"("sourceMappingId", "proposedCanonicalNormalized");

CREATE INDEX "DiagnosisRegistryCandidate_proposedCanonicalNormalized_idx"
ON "DiagnosisRegistryCandidate"("proposedCanonicalNormalized");

CREATE INDEX "DiagnosisRegistryCandidate_sourceType_sourceId_idx"
ON "DiagnosisRegistryCandidate"("sourceType", "sourceId");

CREATE INDEX "DiagnosisRegistryCandidate_sourceMappingId_idx"
ON "DiagnosisRegistryCandidate"("sourceMappingId");

CREATE INDEX "DiagnosisRegistryCandidate_contextDiagnosisRegistryId_idx"
ON "DiagnosisRegistryCandidate"("contextDiagnosisRegistryId");

CREATE INDEX "DiagnosisRegistryCandidate_status_idx"
ON "DiagnosisRegistryCandidate"("status");

CREATE INDEX "DiagnosisRegistryCandidate_reviewerUserId_idx"
ON "DiagnosisRegistryCandidate"("reviewerUserId");

CREATE INDEX "DiagnosisRegistryCandidate_createdRegistryId_idx"
ON "DiagnosisRegistryCandidate"("createdRegistryId");

CREATE INDEX "DiagnosisRegistryCandidate_createdAt_idx"
ON "DiagnosisRegistryCandidate"("createdAt");

ALTER TABLE "DiagnosisRegistryCandidate"
ADD CONSTRAINT "DiagnosisRegistryCandidate_contextDiagnosisRegistryId_fkey"
FOREIGN KEY ("contextDiagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiagnosisRegistryCandidate"
ADD CONSTRAINT "DiagnosisRegistryCandidate_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiagnosisRegistryCandidate"
ADD CONSTRAINT "DiagnosisRegistryCandidate_createdRegistryId_fkey"
FOREIGN KEY ("createdRegistryId") REFERENCES "DiagnosisRegistry"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
