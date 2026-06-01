-- CreateTable
CREATE TABLE "DiagnosisEditorialBrief" (
    "id" TEXT NOT NULL,
    "diagnosisRegistryId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "learningGoals" JSONB NOT NULL,
    "requiredTeachingRuleIds" JSONB NOT NULL,
    "requiredMimicIds" JSONB,
    "requiredPitfalls" JSONB,
    "keyInvestigations" JSONB,
    "managementAnchors" JSONB,
    "difficultyGuidance" JSONB,
    "caseGenerationGuidance" JSONB,
    "educationGuidance" JSONB,
    "graphGuidance" JSONB,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisEditorialBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEditorialBrief_diagnosisRegistryId_key" ON "DiagnosisEditorialBrief"("diagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisEditorialBrief_status_idx" ON "DiagnosisEditorialBrief"("status");

-- CreateIndex
CREATE INDEX "DiagnosisEditorialBrief_diagnosisRegistryId_idx" ON "DiagnosisEditorialBrief"("diagnosisRegistryId");

-- AddForeignKey
ALTER TABLE "DiagnosisEditorialBrief" ADD CONSTRAINT "DiagnosisEditorialBrief_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
