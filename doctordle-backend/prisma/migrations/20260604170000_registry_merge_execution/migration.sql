-- CreateTable
CREATE TABLE "DiagnosisRegistryMergeLog" (
    "id" TEXT NOT NULL,
    "sourceDiagnosisRegistryId" TEXT NOT NULL,
    "targetDiagnosisRegistryId" TEXT NOT NULL,
    "reason" TEXT,
    "analysisSnapshot" JSONB NOT NULL,
    "reassignmentSummary" JSONB NOT NULL,
    "performedByUserId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosisRegistryMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosisRegistryMergeLog_sourceDiagnosisRegistryId_idx" ON "DiagnosisRegistryMergeLog"("sourceDiagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisRegistryMergeLog_targetDiagnosisRegistryId_idx" ON "DiagnosisRegistryMergeLog"("targetDiagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisRegistryMergeLog_performedByUserId_idx" ON "DiagnosisRegistryMergeLog"("performedByUserId");

-- CreateIndex
CREATE INDEX "DiagnosisRegistryMergeLog_performedAt_idx" ON "DiagnosisRegistryMergeLog"("performedAt");
