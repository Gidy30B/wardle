CREATE TYPE "AiDraftReviewStatus" AS ENUM (
  'DRAFT',
  'REVIEW_REQUIRED',
  'ACCEPTED',
  'REJECTED'
);

CREATE TABLE "CaseLearningGoalCoverage" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "learningGoalId" TEXT NOT NULL,
  "learningGoal" TEXT NOT NULL,
  "coverageStrength" INTEGER NOT NULL DEFAULT 0,
  "coveredDiscriminators" JSONB,
  "missingDiscriminators" JSONB,
  "coveredMimics" JSONB,
  "missingMimics" JSONB,
  "evidenceSource" TEXT NOT NULL DEFAULT 'editorial_annotation',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaseLearningGoalCoverage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CaseLearningGoalCoverage_diagnosisRegistryId_fkey"
    FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CaseLearningGoalCoverage_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CaseEscalationAnnotation" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "escalationType" TEXT NOT NULL,
  "covered" BOOLEAN NOT NULL DEFAULT false,
  "evidenceStrength" INTEGER NOT NULL DEFAULT 0,
  "reasoningPathId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaseEscalationAnnotation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CaseEscalationAnnotation_diagnosisRegistryId_fkey"
    FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CaseEscalationAnnotation_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CaseEscalationAnnotation_reasoningPathId_fkey"
    FOREIGN KEY ("reasoningPathId") REFERENCES "ReasoningPath"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AiDraftRevisionAudit" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "caseId" TEXT,
  "actionType" TEXT NOT NULL,
  "sourceIssue" JSONB NOT NULL,
  "inputContext" JSONB NOT NULL,
  "generatedOutput" JSONB NOT NULL,
  "editorDecision" TEXT,
  "affectedArtifactType" TEXT NOT NULL,
  "affectedArtifactId" TEXT NOT NULL,
  "reviewStatus" "AiDraftReviewStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiDraftRevisionAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiDraftRevisionAudit_diagnosisRegistryId_fkey"
    FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiDraftRevisionAudit_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiDraftRevisionAudit_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CaseLearningGoalCoverage_caseId_learningGoalId_key"
  ON "CaseLearningGoalCoverage"("caseId", "learningGoalId");
CREATE INDEX "CaseLearningGoalCoverage_diagnosisRegistryId_idx"
  ON "CaseLearningGoalCoverage"("diagnosisRegistryId");
CREATE INDEX "CaseLearningGoalCoverage_learningGoalId_idx"
  ON "CaseLearningGoalCoverage"("learningGoalId");
CREATE INDEX "CaseLearningGoalCoverage_caseId_idx"
  ON "CaseLearningGoalCoverage"("caseId");

CREATE UNIQUE INDEX "CaseEscalationAnnotation_caseId_escalationType_key"
  ON "CaseEscalationAnnotation"("caseId", "escalationType");
CREATE INDEX "CaseEscalationAnnotation_diagnosisRegistryId_idx"
  ON "CaseEscalationAnnotation"("diagnosisRegistryId");
CREATE INDEX "CaseEscalationAnnotation_caseId_idx"
  ON "CaseEscalationAnnotation"("caseId");
CREATE INDEX "CaseEscalationAnnotation_reasoningPathId_idx"
  ON "CaseEscalationAnnotation"("reasoningPathId");
CREATE INDEX "CaseEscalationAnnotation_covered_idx"
  ON "CaseEscalationAnnotation"("covered");

CREATE INDEX "AiDraftRevisionAudit_diagnosisRegistryId_createdAt_idx"
  ON "AiDraftRevisionAudit"("diagnosisRegistryId", "createdAt");
CREATE INDEX "AiDraftRevisionAudit_actionType_idx"
  ON "AiDraftRevisionAudit"("actionType");
CREATE INDEX "AiDraftRevisionAudit_affectedArtifactType_affectedArtifactId_idx"
  ON "AiDraftRevisionAudit"("affectedArtifactType", "affectedArtifactId");
CREATE INDEX "AiDraftRevisionAudit_reviewStatus_idx"
  ON "AiDraftRevisionAudit"("reviewStatus");
CREATE INDEX "AiDraftRevisionAudit_createdByUserId_idx"
  ON "AiDraftRevisionAudit"("createdByUserId");
