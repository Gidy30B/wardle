-- Add backend-owned username identity and backfill from legacy displayName.
ALTER TABLE "User"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "normalizedUsername" TEXT;

WITH source AS (
  SELECT
    "id",
    NULLIF(regexp_replace(trim("displayName"), '\s+', ' ', 'g'), '') AS "baseUsername",
    NULLIF(regexp_replace(lower(trim("displayName")), '\s+', ' ', 'g'), '') AS "baseNormalized",
    "createdAt"
  FROM "User"
),
reserved AS (
  SELECT unnest(ARRAY[
    'admin',
    'administrator',
    'api',
    'auth',
    'doctordle',
    'help',
    'moderator',
    'null',
    'root',
    'support',
    'system',
    'user',
    'username',
    'wardle'
  ]) AS "normalizedUsername"
),
candidates AS (
  SELECT
    source."id",
    CASE
      WHEN reserved."normalizedUsername" IS NULL THEN source."baseUsername"
      ELSE source."baseUsername" || ' user'
    END AS "candidateUsername",
    CASE
      WHEN reserved."normalizedUsername" IS NULL THEN source."baseNormalized"
      ELSE source."baseNormalized" || ' user'
    END AS "candidateNormalized",
    source."createdAt"
  FROM source
  LEFT JOIN reserved
    ON reserved."normalizedUsername" = source."baseNormalized"
  WHERE source."baseUsername" IS NOT NULL
    AND source."baseNormalized" IS NOT NULL
),
ranked AS (
  SELECT
    "id",
    "candidateUsername",
    "candidateNormalized",
    row_number() OVER (
      PARTITION BY "candidateNormalized"
      ORDER BY "createdAt", "id"
    ) AS "duplicateIndex"
  FROM candidates
)
UPDATE "User" AS u
SET
  "username" = CASE
    WHEN ranked."duplicateIndex" = 1 THEN ranked."candidateUsername"
    ELSE ranked."candidateUsername" || ' ' || ranked."duplicateIndex"::text
  END,
  "normalizedUsername" = CASE
    WHEN ranked."duplicateIndex" = 1 THEN ranked."candidateNormalized"
    ELSE ranked."candidateNormalized" || ' ' || ranked."duplicateIndex"::text
  END
FROM ranked
WHERE u."id" = ranked."id";

CREATE UNIQUE INDEX "User_normalizedUsername_key" ON "User"("normalizedUsername");
CREATE INDEX "User_normalizedUsername_idx" ON "User"("normalizedUsername");

ALTER TABLE "User" DROP COLUMN "displayName";
