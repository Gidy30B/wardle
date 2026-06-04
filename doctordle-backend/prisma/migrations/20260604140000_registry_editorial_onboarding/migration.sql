CREATE TYPE "DiagnosisEditorialOnboardingStatus" AS ENUM (
    'NEW',
    'RULES_STARTED',
    'BRIEF_STARTED',
    'EDUCATION_STARTED',
    'CASE_STARTED',
    'READY_FOR_REVIEW',
    'COMPLETE'
);

ALTER TABLE "DiagnosisRegistry"
ADD COLUMN "onboardingStatus" "DiagnosisEditorialOnboardingStatus",
ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

CREATE INDEX "DiagnosisRegistry_onboardingStatus_idx"
ON "DiagnosisRegistry"("onboardingStatus");
