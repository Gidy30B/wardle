CREATE TYPE "ReasoningGoal" AS ENUM (
  'DIFFERENTIAL_DISCRIMINATION',
  'ESCALATION_RECOGNITION',
  'MANAGEMENT_CONTRAST',
  'COMPLICATION_RECOGNITION',
  'EARLY_PRESENTATION_RECOGNITION',
  'RESOURCE_LIMITED_REASONING'
);

CREATE TYPE "GenerationPurpose" AS ENUM (
  'CASE_GENERATION',
  'TEACHING_RULE_GENERATION',
  'EDUCATION_GENERATION',
  'RECALL_GENERATION'
);

CREATE TYPE "ReasoningPathStatus" AS ENUM (
  'CANDIDATE',
  'ACTIVE',
  'REJECTED',
  'DEPRECATED'
);

CREATE TABLE "ReasoningPath" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reasoningGoal" "ReasoningGoal" NOT NULL,
  "primaryDifferentialIds" JSONB,
  "supportingTeachingRelationshipIds" JSONB,
  "supportingEvidenceRelationshipIds" JSONB,
  "discriminatorEvidenceNodeIds" JSONB,
  "escalationEvidenceNodeIds" JSONB,
  "contradictoryEvidenceNodeIds" JSONB,
  "requiredTeachingPoints" JSONB,
  "forbiddenEvidencePatterns" JSONB,
  "recommendedClueDistribution" JSONB,
  "generationPurpose" "GenerationPurpose" NOT NULL,
  "readinessScore" INTEGER NOT NULL DEFAULT 0,
  "status" "ReasoningPathStatus" NOT NULL DEFAULT 'CANDIDATE',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReasoningPath_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReasoningPath_normalizedKey_key" ON "ReasoningPath"("normalizedKey");
CREATE INDEX "ReasoningPath_diagnosisRegistryId_idx" ON "ReasoningPath"("diagnosisRegistryId");
CREATE INDEX "ReasoningPath_status_idx" ON "ReasoningPath"("status");
CREATE INDEX "ReasoningPath_generationPurpose_idx" ON "ReasoningPath"("generationPurpose");
CREATE INDEX "ReasoningPath_reasoningGoal_idx" ON "ReasoningPath"("reasoningGoal");
CREATE INDEX "ReasoningPath_diagnosisRegistryId_status_generationPurpose_idx" ON "ReasoningPath"("diagnosisRegistryId", "status", "generationPurpose");
CREATE INDEX "ReasoningPath_reviewedByUserId_idx" ON "ReasoningPath"("reviewedByUserId");

ALTER TABLE "ReasoningPath"
  ADD CONSTRAINT "ReasoningPath_diagnosisRegistryId_fkey"
  FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReasoningPath"
  ADD CONSTRAINT "ReasoningPath_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
