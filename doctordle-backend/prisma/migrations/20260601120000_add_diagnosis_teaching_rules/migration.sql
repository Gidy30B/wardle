-- CreateTable
CREATE TABLE "DiagnosisTeachingRule" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "importance" TEXT NOT NULL,
  "rationale" TEXT,
  "acceptableManifestations" JSONB,
  "requiredDifferentials" JSONB,
  "expectedEvidence" JSONB,
  "difficultyHints" JSONB,
  "avoidTooEarly" BOOLEAN NOT NULL DEFAULT false,
  "appliesToEducation" BOOLEAN NOT NULL DEFAULT true,
  "appliesToCaseGeneration" BOOLEAN NOT NULL DEFAULT true,
  "appliesToGraph" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiagnosisTeachingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisTeachingRule_diagnosisRegistryId_stableKey_key" ON "DiagnosisTeachingRule"("diagnosisRegistryId", "stableKey");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRule_diagnosisRegistryId_idx" ON "DiagnosisTeachingRule"("diagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRule_status_idx" ON "DiagnosisTeachingRule"("status");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRule_category_idx" ON "DiagnosisTeachingRule"("category");

-- AddForeignKey
ALTER TABLE "DiagnosisTeachingRule"
ADD CONSTRAINT "DiagnosisTeachingRule_diagnosisRegistryId_fkey"
FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
