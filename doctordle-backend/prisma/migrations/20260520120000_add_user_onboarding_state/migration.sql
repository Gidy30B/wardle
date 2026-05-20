-- Add durable backend-owned onboarding state.
-- Existing users are backfilled conservatively from current profile and membership data.

CREATE TYPE "UserOnboardingStatus" AS ENUM (
  'PROFILE_REQUIRED',
  'ORGANIZATION_REQUIRED',
  'COMPLETE'
);

ALTER TABLE "User"
ADD COLUMN "onboardingStatus" "UserOnboardingStatus" NOT NULL DEFAULT 'PROFILE_REQUIRED',
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN "primaryOrganizationId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User"
ADD CONSTRAINT "User_primaryOrganizationId_fkey"
FOREIGN KEY ("primaryOrganizationId")
REFERENCES "Organization"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "User_onboardingStatus_idx" ON "User"("onboardingStatus");
CREATE INDEX "User_primaryOrganizationId_idx" ON "User"("primaryOrganizationId");

WITH first_active_membership AS (
  SELECT DISTINCT ON ("userId")
    "userId",
    "organizationId"
  FROM "UserOrganization"
  WHERE "status" = 'ACTIVE'
  ORDER BY "userId", "createdAt" ASC
)
UPDATE "User" u
SET
  "primaryOrganizationId" = CASE
    WHEN NULLIF(BTRIM(u."displayName"), '') IS NOT NULL
      AND u."individualMode" IS NOT TRUE
      AND fam."organizationId" IS NOT NULL
    THEN fam."organizationId"
    ELSE u."primaryOrganizationId"
  END,
  "onboardingStatus" = CASE
    WHEN NULLIF(BTRIM(u."displayName"), '') IS NULL THEN 'PROFILE_REQUIRED'::"UserOnboardingStatus"
    WHEN u."individualMode" IS TRUE THEN 'COMPLETE'::"UserOnboardingStatus"
    WHEN fam."organizationId" IS NOT NULL THEN 'COMPLETE'::"UserOnboardingStatus"
    ELSE 'ORGANIZATION_REQUIRED'::"UserOnboardingStatus"
  END,
  "onboardingCompletedAt" = CASE
    WHEN NULLIF(BTRIM(u."displayName"), '') IS NOT NULL
      AND (u."individualMode" IS TRUE OR fam."organizationId" IS NOT NULL)
    THEN COALESCE(u."onboardingCompletedAt", CURRENT_TIMESTAMP)
    ELSE NULL
  END
FROM first_active_membership fam
WHERE fam."userId" = u."id";

UPDATE "User" u
SET
  "onboardingStatus" = CASE
    WHEN NULLIF(BTRIM(u."displayName"), '') IS NULL THEN 'PROFILE_REQUIRED'::"UserOnboardingStatus"
    WHEN u."individualMode" IS TRUE THEN 'COMPLETE'::"UserOnboardingStatus"
    ELSE 'ORGANIZATION_REQUIRED'::"UserOnboardingStatus"
  END,
  "onboardingCompletedAt" = CASE
    WHEN NULLIF(BTRIM(u."displayName"), '') IS NOT NULL
      AND u."individualMode" IS TRUE
    THEN COALESCE(u."onboardingCompletedAt", CURRENT_TIMESTAMP)
    ELSE NULL
  END
WHERE NOT EXISTS (
  SELECT 1
  FROM "UserOrganization" uo
  WHERE uo."userId" = u."id"
    AND uo."status" = 'ACTIVE'
);
