-- CreateEnum
CREATE TYPE "DiagnosisEducationStatus" AS ENUM (
  'DRAFT',
  'GENERATED',
  'NEEDS_REVIEW',
  'NEEDS_EDIT',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "DiagnosisEducationSource" AS ENUM (
  'MANUAL',
  'AI_ASSISTED',
  'IMPORTED',
  'HYBRID'
);

-- CreateTable
CREATE TABLE "DiagnosisEducation" (
  "id" TEXT NOT NULL,
  "diagnosisRegistryId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" JSONB NOT NULL,
  "clinicalPattern" JSONB,
  "keySymptoms" JSONB,
  "keySigns" JSONB,
  "examPearls" JSONB,
  "scoringSystems" JSONB,
  "investigations" JSONB,
  "differentials" JSONB,
  "management" JSONB,
  "complications" JSONB,
  "pitfalls" JSONB,
  "recallPrompts" JSONB,
  "references" JSONB,
  "editorialStatus" "DiagnosisEducationStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "DiagnosisEducationSource" NOT NULL DEFAULT 'MANUAL',
  "version" INTEGER NOT NULL DEFAULT 1,
  "generatedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiagnosisEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisEducationRevision" (
  "id" TEXT NOT NULL,
  "educationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "editorialStatus" "DiagnosisEducationStatus" NOT NULL,
  "source" "DiagnosisEducationSource" NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiagnosisEducationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEducation_diagnosisRegistryId_key" ON "DiagnosisEducation"("diagnosisRegistryId");

-- CreateIndex
CREATE INDEX "DiagnosisEducation_editorialStatus_idx" ON "DiagnosisEducation"("editorialStatus");

-- CreateIndex
CREATE INDEX "DiagnosisEducation_source_idx" ON "DiagnosisEducation"("source");

-- CreateIndex
CREATE INDEX "DiagnosisEducation_updatedAt_idx" ON "DiagnosisEducation"("updatedAt");

-- CreateIndex
CREATE INDEX "DiagnosisEducation_reviewedByUserId_idx" ON "DiagnosisEducation"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisEducationRevision_educationId_version_key" ON "DiagnosisEducationRevision"("educationId", "version");

-- CreateIndex
CREATE INDEX "DiagnosisEducationRevision_educationId_idx" ON "DiagnosisEducationRevision"("educationId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationRevision_createdByUserId_idx" ON "DiagnosisEducationRevision"("createdByUserId");

-- CreateIndex
CREATE INDEX "DiagnosisEducationRevision_createdAt_idx" ON "DiagnosisEducationRevision"("createdAt");

-- AddForeignKey
ALTER TABLE "DiagnosisEducation"
ADD CONSTRAINT "DiagnosisEducation_diagnosisRegistryId_fkey"
FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducation"
ADD CONSTRAINT "DiagnosisEducation_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationRevision"
ADD CONSTRAINT "DiagnosisEducationRevision_educationId_fkey"
FOREIGN KEY ("educationId") REFERENCES "DiagnosisEducation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisEducationRevision"
ADD CONSTRAINT "DiagnosisEducationRevision_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
