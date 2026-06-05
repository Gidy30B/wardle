-- CreateEnum
CREATE TYPE "DiagnosisTeachingRelationshipType" AS ENUM (
    'DIFFERENTIAL_DISCRIMINATOR',
    'MIMIC_CONFUSION',
    'SHARED_PRESENTATION',
    'ESCALATION_CONTRAST',
    'MANAGEMENT_CONTRAST',
    'INVESTIGATION_CONTRAST',
    'COMPLICATION_RELATIONSHIP'
);

-- CreateEnum
CREATE TYPE "DiagnosisTeachingRelationshipPurpose" AS ENUM (
    'TEACH_DISCRIMINATOR',
    'PREVENT_COMMON_ERROR',
    'BUILD_DDX_CLUSTER',
    'SUPPORT_CASE_GENERATION',
    'SUPPORT_EDUCATION',
    'SUPPORT_RECALL'
);

-- CreateEnum
CREATE TYPE "DiagnosisTeachingRelationshipStatus" AS ENUM (
    'CANDIDATE',
    'NEEDS_REVIEW',
    'ACTIVE',
    'REJECTED',
    'DEPRECATED'
);

-- CreateTable
CREATE TABLE "DiagnosisTeachingRelationship" (
    "id" TEXT NOT NULL,
    "sourceDiagnosisRegistryId" TEXT NOT NULL,
    "targetDiagnosisRegistryId" TEXT NOT NULL,
    "relationshipType" "DiagnosisTeachingRelationshipType" NOT NULL,
    "teachingPurpose" "DiagnosisTeachingRelationshipPurpose" NOT NULL,
    "discriminatorSummary" TEXT,
    "commonConfusionReason" TEXT,
    "learnerPitfall" TEXT,
    "suggestedTeachingRuleStableKey" TEXT,
    "supportingGraphFactId" TEXT,
    "supportingDifferentialLinkId" TEXT,
    "supportingTeachingRuleId" TEXT,
    "strength" INTEGER NOT NULL DEFAULT 1,
    "status" "DiagnosisTeachingRelationshipStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisTeachingRelationship_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DiagnosisTeachingRelationship_distinct_diagnoses_check" CHECK ("sourceDiagnosisRegistryId" <> "targetDiagnosisRegistryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisTeachingRelationship_sourceDiagnosisRegistryId_targetDiagnosisRegistryId_relationshipType_teachingPurpose_key" ON "DiagnosisTeachingRelationship"("sourceDiagnosisRegistryId", "targetDiagnosisRegistryId", "relationshipType", "teachingPurpose");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_sourceDiagnosisRegistryId_idx" ON "DiagnosisTeachingRelationship"("sourceDiagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_targetDiagnosisRegistryId_idx" ON "DiagnosisTeachingRelationship"("targetDiagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_status_idx" ON "DiagnosisTeachingRelationship"("status");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_relationshipType_idx" ON "DiagnosisTeachingRelationship"("relationshipType");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_teachingPurpose_idx" ON "DiagnosisTeachingRelationship"("teachingPurpose");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_supportingGraphFactId_idx" ON "DiagnosisTeachingRelationship"("supportingGraphFactId");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_supportingDifferentialLinkId_idx" ON "DiagnosisTeachingRelationship"("supportingDifferentialLinkId");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_supportingTeachingRuleId_idx" ON "DiagnosisTeachingRelationship"("supportingTeachingRuleId");

-- CreateIndex
CREATE INDEX "DiagnosisTeachingRelationship_reviewedByUserId_idx" ON "DiagnosisTeachingRelationship"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "DiagnosisTeachingRelationship" ADD CONSTRAINT "DiagnosisTeachingRelationship_sourceDiagnosisRegistryId_fkey" FOREIGN KEY ("sourceDiagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisTeachingRelationship" ADD CONSTRAINT "DiagnosisTeachingRelationship_targetDiagnosisRegistryId_fkey" FOREIGN KEY ("targetDiagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisTeachingRelationship" ADD CONSTRAINT "DiagnosisTeachingRelationship_supportingGraphFactId_fkey" FOREIGN KEY ("supportingGraphFactId") REFERENCES "DiagnosisGraphFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisTeachingRelationship" ADD CONSTRAINT "DiagnosisTeachingRelationship_supportingTeachingRuleId_fkey" FOREIGN KEY ("supportingTeachingRuleId") REFERENCES "DiagnosisTeachingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisTeachingRelationship" ADD CONSTRAINT "DiagnosisTeachingRelationship_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
