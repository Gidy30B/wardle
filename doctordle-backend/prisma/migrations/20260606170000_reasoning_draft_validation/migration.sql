CREATE TYPE "ReasoningDraftArtifactType" AS ENUM (
  'CASE',
  'TEACHING_RULE',
  'EDUCATION',
  'EDUCATION_SECTION'
);

CREATE TYPE "ReasoningDraftTrustTier" AS ENUM (
  'HIGH_TRUST',
  'REVIEW_REQUIRED',
  'LOW_TRUST',
  'BLOCKED'
);

CREATE TYPE "ReasoningDraftValidationStatus" AS ENUM (
  'PASSED',
  'NEEDS_REVIEW',
  'FAILED'
);

CREATE TABLE "ReasoningDraftValidationRun" (
  "id" TEXT NOT NULL,
  "artifactType" "ReasoningDraftArtifactType" NOT NULL,
  "artifactId" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "reasoningPathId" TEXT,
  "trustScore" INTEGER NOT NULL,
  "trustTier" "ReasoningDraftTrustTier" NOT NULL,
  "validationStatus" "ReasoningDraftValidationStatus" NOT NULL,
  "blockers" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "strengths" JSONB NOT NULL,
  "hallucinationRiskSignals" JSONB NOT NULL,
  "reasoningCoverage" JSONB NOT NULL,
  "evidenceCoverage" JSONB NOT NULL,
  "discriminatorCoverage" JSONB NOT NULL,
  "unsupportedClaimSignals" JSONB NOT NULL,
  "recommendations" JSONB NOT NULL,
  "validatorVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReasoningDraftValidationRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReasoningDraftValidationRun_diagnosisRegistryId_fkey"
    FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReasoningDraftValidationRun_artifactType_artifactId_createdAt_idx"
  ON "ReasoningDraftValidationRun"("artifactType", "artifactId", "createdAt");

CREATE INDEX "ReasoningDraftValidationRun_diagnosisRegistryId_createdAt_idx"
  ON "ReasoningDraftValidationRun"("diagnosisRegistryId", "createdAt");

CREATE INDEX "ReasoningDraftValidationRun_reasoningPathId_idx"
  ON "ReasoningDraftValidationRun"("reasoningPathId");

CREATE INDEX "ReasoningDraftValidationRun_trustTier_idx"
  ON "ReasoningDraftValidationRun"("trustTier");

CREATE INDEX "ReasoningDraftValidationRun_validationStatus_idx"
  ON "ReasoningDraftValidationRun"("validationStatus");
