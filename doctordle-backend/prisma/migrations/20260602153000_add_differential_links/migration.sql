-- CreateEnum
CREATE TYPE "DifferentialLinkRole" AS ENUM ('PRIMARY_MIMIC', 'DIFFERENTIAL', 'IMPORTANT_EXCLUSION', 'TEACHING_DIFFERENTIAL');

-- CreateTable
CREATE TABLE "CaseDifferentialLink" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseRevisionId" TEXT,
    "sourceMappingId" TEXT,
    "diagnosisRegistryId" TEXT NOT NULL,
    "role" "DifferentialLinkRole" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "sourceText" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDifferentialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationDifferentialLink" (
    "id" TEXT NOT NULL,
    "educationId" TEXT NOT NULL,
    "educationRevisionId" TEXT,
    "sourceMappingId" TEXT,
    "diagnosisRegistryId" TEXT NOT NULL,
    "role" "DifferentialLinkRole" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "sourceText" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationDifferentialLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseDifferentialLink_dedupeKey_key" ON "CaseDifferentialLink"("dedupeKey");
CREATE UNIQUE INDEX "CaseDifferentialLink_caseId_caseRevisionId_diagnosisRegistryId_key" ON "CaseDifferentialLink"("caseId", "caseRevisionId", "diagnosisRegistryId");
CREATE INDEX "CaseDifferentialLink_caseId_idx" ON "CaseDifferentialLink"("caseId");
CREATE INDEX "CaseDifferentialLink_caseRevisionId_idx" ON "CaseDifferentialLink"("caseRevisionId");
CREATE INDEX "CaseDifferentialLink_sourceMappingId_idx" ON "CaseDifferentialLink"("sourceMappingId");
CREATE INDEX "CaseDifferentialLink_diagnosisRegistryId_idx" ON "CaseDifferentialLink"("diagnosisRegistryId");
CREATE INDEX "CaseDifferentialLink_role_idx" ON "CaseDifferentialLink"("role");

-- CreateIndex
CREATE UNIQUE INDEX "EducationDifferentialLink_dedupeKey_key" ON "EducationDifferentialLink"("dedupeKey");
CREATE UNIQUE INDEX "EducationDifferentialLink_educationId_educationRevisionId_diagnosisRegistryId_key" ON "EducationDifferentialLink"("educationId", "educationRevisionId", "diagnosisRegistryId");
CREATE INDEX "EducationDifferentialLink_educationId_idx" ON "EducationDifferentialLink"("educationId");
CREATE INDEX "EducationDifferentialLink_educationRevisionId_idx" ON "EducationDifferentialLink"("educationRevisionId");
CREATE INDEX "EducationDifferentialLink_sourceMappingId_idx" ON "EducationDifferentialLink"("sourceMappingId");
CREATE INDEX "EducationDifferentialLink_diagnosisRegistryId_idx" ON "EducationDifferentialLink"("diagnosisRegistryId");
CREATE INDEX "EducationDifferentialLink_role_idx" ON "EducationDifferentialLink"("role");

-- AddForeignKey
ALTER TABLE "CaseDifferentialLink" ADD CONSTRAINT "CaseDifferentialLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseDifferentialLink" ADD CONSTRAINT "CaseDifferentialLink_caseRevisionId_fkey" FOREIGN KEY ("caseRevisionId") REFERENCES "CaseRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseDifferentialLink" ADD CONSTRAINT "CaseDifferentialLink_sourceMappingId_fkey" FOREIGN KEY ("sourceMappingId") REFERENCES "CaseDifferentialMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseDifferentialLink" ADD CONSTRAINT "CaseDifferentialLink_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationDifferentialLink" ADD CONSTRAINT "EducationDifferentialLink_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "DiagnosisEducation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationDifferentialLink" ADD CONSTRAINT "EducationDifferentialLink_educationRevisionId_fkey" FOREIGN KEY ("educationRevisionId") REFERENCES "DiagnosisEducationRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationDifferentialLink" ADD CONSTRAINT "EducationDifferentialLink_sourceMappingId_fkey" FOREIGN KEY ("sourceMappingId") REFERENCES "EducationDifferentialMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EducationDifferentialLink" ADD CONSTRAINT "EducationDifferentialLink_diagnosisRegistryId_fkey" FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
