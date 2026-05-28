-- CreateEnum
CREATE TYPE "DiagnosisGraphCandidateType" AS ENUM (
  'FINDING',
  'INVESTIGATION',
  'MIMIC',
  'PITFALL',
  'MANAGEMENT',
  'COMPLICATION',
  'RECALL_PROMPT',
  'CASE_REASONING'
);

-- CreateEnum
CREATE TYPE "DiagnosisGraphSourceType" AS ENUM (
  'CASE',
  'DIAGNOSIS_EDUCATION'
);

-- CreateEnum
CREATE TYPE "DiagnosisGraphCandidateStatus" AS ENUM (
  'CANDIDATE',
  'APPROVED',
  'REJECTED',
  'MERGED'
);

-- CreateEnum
CREATE TYPE "DiagnosisGraphFactStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

-- CreateTable
CREATE TABLE "DiagnosisGraphCandidate" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "type" "DiagnosisGraphCandidateType" NOT NULL,
  "status" "DiagnosisGraphCandidateStatus" NOT NULL DEFAULT 'CANDIDATE',
  "sourceType" "DiagnosisGraphSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceVersion" INTEGER,
  "sourcePath" TEXT NOT NULL,
  "rawText" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "payload" JSONB,
  "targetDiagnosisRegistryId" TEXT,
  "unresolvedTargetText" TEXT,
  "confidence" DOUBLE PRECISION,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "mergedIntoId" TEXT,
  "promotedFactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiagnosisGraphCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisGraphFact" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "type" "DiagnosisGraphCandidateType" NOT NULL,
  "label" TEXT NOT NULL,
  "normalizedLabel" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "payload" JSONB,
  "targetDiagnosisRegistryId" TEXT,
  "status" "DiagnosisGraphFactStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceCandidateId" TEXT,
  "provenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiagnosisGraphFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisGraphCandidate_diagnosisRegistryId_type_sourceT_key"
ON "DiagnosisGraphCandidate"("diagnosisRegistryId", "type", "sourceType", "sourceId", "sourcePath", "normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisGraphCandidate_dedupeKey_key"
ON "DiagnosisGraphCandidate"("dedupeKey");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_dedupeKey_idx"
ON "DiagnosisGraphCandidate"("dedupeKey");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_diagnosisRegistryId_idx"
ON "DiagnosisGraphCandidate"("diagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_type_idx"
ON "DiagnosisGraphCandidate"("type");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_status_idx"
ON "DiagnosisGraphCandidate"("status");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_sourceType_sourceId_idx"
ON "DiagnosisGraphCandidate"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_normalizedText_idx"
ON "DiagnosisGraphCandidate"("normalizedText");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_targetDiagnosisRegistryId_idx"
ON "DiagnosisGraphCandidate"("targetDiagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisGraphCandidate_reviewedByUserId_idx"
ON "DiagnosisGraphCandidate"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisGraphFact_sourceCandidateId_key"
ON "DiagnosisGraphFact"("sourceCandidateId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisGraphFact_dedupeKey_key"
ON "DiagnosisGraphFact"("dedupeKey");

-- CreateIndex
CREATE INDEX "DiagnosisGraphFact_dedupeKey_idx"
ON "DiagnosisGraphFact"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisGraphFact_diagnosisRegistryId_type_normalized_key"
ON "DiagnosisGraphFact"("diagnosisRegistryId", "type", "normalizedLabel", "targetDiagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisGraphFact_diagnosisRegistryId_idx"
ON "DiagnosisGraphFact"("diagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisGraphFact_type_idx"
ON "DiagnosisGraphFact"("type");

-- CreateIndex
CREATE INDEX "DiagnosisGraphFact_status_idx"
ON "DiagnosisGraphFact"("status");

-- CreateIndex
CREATE INDEX "DiagnosisGraphFact_normalizedLabel_idx"
ON "DiagnosisGraphFact"("normalizedLabel");

-- CreateIndex
CREATE INDEX "DiagnosisGraphFact_targetDiagnosisRegistryId_idx"
ON "DiagnosisGraphFact"("targetDiagnosisRegistryId");

-- AddForeignKey
ALTER TABLE "DiagnosisGraphCandidate"
ADD CONSTRAINT "DiagnosisGraphCandidate_diagnosisRegistryId_fkey"
FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisGraphCandidate"
ADD CONSTRAINT "DiagnosisGraphCandidate_targetDiagnosisRegistryId_fkey"
FOREIGN KEY ("targetDiagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisGraphCandidate"
ADD CONSTRAINT "DiagnosisGraphCandidate_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisGraphCandidate"
ADD CONSTRAINT "DiagnosisGraphCandidate_mergedIntoId_fkey"
FOREIGN KEY ("mergedIntoId") REFERENCES "DiagnosisGraphCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisGraphCandidate"
ADD CONSTRAINT "DiagnosisGraphCandidate_promotedFactId_fkey"
FOREIGN KEY ("promotedFactId") REFERENCES "DiagnosisGraphFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisGraphFact"
ADD CONSTRAINT "DiagnosisGraphFact_diagnosisRegistryId_fkey"
FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisGraphFact"
ADD CONSTRAINT "DiagnosisGraphFact_targetDiagnosisRegistryId_fkey"
FOREIGN KEY ("targetDiagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisGraphFact"
ADD CONSTRAINT "DiagnosisGraphFact_sourceCandidateId_fkey"
FOREIGN KEY ("sourceCandidateId") REFERENCES "DiagnosisGraphCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
