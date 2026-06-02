-- CreateEnum
CREATE TYPE "DifferentialResolutionStatus" AS ENUM ('RESOLVED', 'AMBIGUOUS', 'UNRESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CaseDifferentialMapping" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "revisionId" TEXT,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "resolvedDiagnosisRegistryId" TEXT,
    "status" "DifferentialResolutionStatus" NOT NULL,
    "matchType" TEXT,
    "confidence" DOUBLE PRECISION,
    "suggestions" JSONB,
    "sourcePath" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDifferentialMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationDifferentialMapping" (
    "id" TEXT NOT NULL,
    "educationId" TEXT NOT NULL,
    "revisionId" TEXT,
    "diagnosisRegistryId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "resolvedDiagnosisRegistryId" TEXT,
    "status" "DifferentialResolutionStatus" NOT NULL,
    "matchType" TEXT,
    "confidence" DOUBLE PRECISION,
    "suggestions" JSONB,
    "sourcePath" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationDifferentialMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseDifferentialMapping_dedupeKey_key" ON "CaseDifferentialMapping"("dedupeKey");
CREATE UNIQUE INDEX "CaseDifferentialMapping_caseId_revisionId_sourcePath_normalizedText_key" ON "CaseDifferentialMapping"("caseId", "revisionId", "sourcePath", "normalizedText");
CREATE INDEX "CaseDifferentialMapping_caseId_idx" ON "CaseDifferentialMapping"("caseId");
CREATE INDEX "CaseDifferentialMapping_revisionId_idx" ON "CaseDifferentialMapping"("revisionId");
CREATE INDEX "CaseDifferentialMapping_normalizedText_idx" ON "CaseDifferentialMapping"("normalizedText");
CREATE INDEX "CaseDifferentialMapping_resolvedDiagnosisRegistryId_idx" ON "CaseDifferentialMapping"("resolvedDiagnosisRegistryId");
CREATE INDEX "CaseDifferentialMapping_status_idx" ON "CaseDifferentialMapping"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EducationDifferentialMapping_dedupeKey_key" ON "EducationDifferentialMapping"("dedupeKey");
CREATE UNIQUE INDEX "EducationDifferentialMapping_educationId_revisionId_sourcePath_normalizedText_key" ON "EducationDifferentialMapping"("educationId", "revisionId", "sourcePath", "normalizedText");
CREATE INDEX "EducationDifferentialMapping_educationId_idx" ON "EducationDifferentialMapping"("educationId");
CREATE INDEX "EducationDifferentialMapping_revisionId_idx" ON "EducationDifferentialMapping"("revisionId");
CREATE INDEX "EducationDifferentialMapping_diagnosisRegistryId_idx" ON "EducationDifferentialMapping"("diagnosisRegistryId");
CREATE INDEX "EducationDifferentialMapping_normalizedText_idx" ON "EducationDifferentialMapping"("normalizedText");
CREATE INDEX "EducationDifferentialMapping_resolvedDiagnosisRegistryId_idx" ON "EducationDifferentialMapping"("resolvedDiagnosisRegistryId");
CREATE INDEX "EducationDifferentialMapping_status_idx" ON "EducationDifferentialMapping"("status");

-- AddForeignKey
ALTER TABLE "CaseDifferentialMapping" ADD CONSTRAINT "CaseDifferentialMapping_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseDifferentialMapping" ADD CONSTRAINT "CaseDifferentialMapping_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CaseRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseDifferentialMapping" ADD CONSTRAINT "CaseDifferentialMapping_resolvedDiagnosisRegistryId_fkey" FOREIGN KEY ("resolvedDiagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseDifferentialMapping" ADD CONSTRAINT "CaseDifferentialMapping_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationDifferentialMapping" ADD CONSTRAINT "EducationDifferentialMapping_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "DiagnosisEducation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationDifferentialMapping" ADD CONSTRAINT "EducationDifferentialMapping_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DiagnosisEducationRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationDifferentialMapping" ADD CONSTRAINT "EducationDifferentialMapping_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationDifferentialMapping" ADD CONSTRAINT "EducationDifferentialMapping_resolvedDiagnosisRegistryId_fkey" FOREIGN KEY ("resolvedDiagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EducationDifferentialMapping" ADD CONSTRAINT "EducationDifferentialMapping_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
