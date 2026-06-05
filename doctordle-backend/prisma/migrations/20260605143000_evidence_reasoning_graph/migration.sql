-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SYMPTOM', 'EXAM', 'LAB', 'IMAGING', 'RISK_FACTOR', 'HISTORY', 'MANAGEMENT', 'COMPLICATION', 'EPIDEMIOLOGY');

-- CreateEnum
CREATE TYPE "ClinicalCategory" AS ENUM ('PAIN', 'BLEEDING', 'INFECTION', 'NEUROLOGIC', 'RESPIRATORY', 'CARDIOVASCULAR', 'GI', 'ENDOCRINE', 'RENAL', 'TRAUMA', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceNodeStatus" AS ENUM ('CANDIDATE', 'ACTIVE', 'REJECTED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "DiagnosisEvidenceRelationshipType" AS ENUM ('SUPPORTS', 'DISCRIMINATES', 'ESCALATES', 'RULES_OUT', 'COMPLICATION_SIGNAL', 'MANAGEMENT_SIGNAL');

-- CreateEnum
CREATE TYPE "DiagnosisEvidenceRelationshipStatus" AS ENUM ('CANDIDATE', 'ACTIVE', 'REJECTED', 'DEPRECATED');

-- CreateTable
CREATE TABLE "EvidenceNode" (
    "id" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "clinicalCategory" "ClinicalCategory" NOT NULL,
    "synonyms" JSONB,
    "status" "EvidenceNodeStatus" NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisEvidenceRelationship" (
    "id" TEXT NOT NULL,
    "diagnosisRegistryId" TEXT NOT NULL,
    "evidenceNodeId" TEXT NOT NULL,
    "relationshipType" "DiagnosisEvidenceRelationshipType" NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 1,
    "discriminatorWeight" INTEGER NOT NULL DEFAULT 0,
    "reasoningSummary" TEXT,
    "contradictoryDiagnosisIds" JSONB,
    "supportingTeachingRelationshipId" TEXT,
    "supportingTeachingRuleId" TEXT,
    "supportingCaseId" TEXT,
    "status" "DiagnosisEvidenceRelationshipStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisEvidenceRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceNode_normalizedKey_key" ON "EvidenceNode"("normalizedKey");

-- CreateIndex
CREATE INDEX "EvidenceNode_evidenceType_idx" ON "EvidenceNode"("evidenceType");

-- CreateIndex
CREATE INDEX "EvidenceNode_clinicalCategory_idx" ON "EvidenceNode"("clinicalCategory");

-- CreateIndex
CREATE INDEX "EvidenceNode_status_idx" ON "EvidenceNode"("status");

-- CreateIndex
CREATE INDEX "EvidenceNode_displayLabel_idx" ON "EvidenceNode"("displayLabel");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEvidenceRelationship_diagnosisRegistryId_evidenceNodeId_relationshipType_key" ON "DiagnosisEvidenceRelationship"("diagnosisRegistryId", "evidenceNodeId", "relationshipType");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_diagnosisRegistryId_idx" ON "DiagnosisEvidenceRelationship"("diagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_evidenceNodeId_idx" ON "DiagnosisEvidenceRelationship"("evidenceNodeId");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_relationshipType_idx" ON "DiagnosisEvidenceRelationship"("relationshipType");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_status_idx" ON "DiagnosisEvidenceRelationship"("status");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_discriminatorWeight_idx" ON "DiagnosisEvidenceRelationship"("discriminatorWeight");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_supportingTeachingRelationshipId_idx" ON "DiagnosisEvidenceRelationship"("supportingTeachingRelationshipId");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_supportingTeachingRuleId_idx" ON "DiagnosisEvidenceRelationship"("supportingTeachingRuleId");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_supportingCaseId_idx" ON "DiagnosisEvidenceRelationship"("supportingCaseId");

-- CreateIndex
CREATE INDEX "DiagnosisEvidenceRelationship_reviewedByUserId_idx" ON "DiagnosisEvidenceRelationship"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "DiagnosisEvidenceRelationship" ADD CONSTRAINT "DiagnosisEvidenceRelationship_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEvidenceRelationship" ADD CONSTRAINT "DiagnosisEvidenceRelationship_evidenceNodeId_fkey" FOREIGN KEY ("evidenceNodeId") REFERENCES "EvidenceNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEvidenceRelationship" ADD CONSTRAINT "DiagnosisEvidenceRelationship_supportingTeachingRelationshipId_fkey" FOREIGN KEY ("supportingTeachingRelationshipId") REFERENCES "DiagnosisTeachingRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEvidenceRelationship" ADD CONSTRAINT "DiagnosisEvidenceRelationship_supportingTeachingRuleId_fkey" FOREIGN KEY ("supportingTeachingRuleId") REFERENCES "DiagnosisTeachingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEvidenceRelationship" ADD CONSTRAINT "DiagnosisEvidenceRelationship_supportingCaseId_fkey" FOREIGN KEY ("supportingCaseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEvidenceRelationship" ADD CONSTRAINT "DiagnosisEvidenceRelationship_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
