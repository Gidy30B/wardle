ALTER TABLE "Case"
ADD COLUMN IF NOT EXISTS "publicNumber" INTEGER;

WITH numbered_cases AS (
  SELECT
    "id",
    (
      COALESCE((SELECT MAX("publicNumber") FROM "Case"), 0)
      + ROW_NUMBER() OVER (ORDER BY "date" ASC, "id" ASC)
    ) AS public_number
  FROM "Case"
  WHERE "publicNumber" IS NULL
)
UPDATE "Case"
SET "publicNumber" = numbered_cases.public_number
FROM numbered_cases
WHERE "Case"."id" = numbered_cases."id";

CREATE UNIQUE INDEX IF NOT EXISTS "Case_publicNumber_key"
ON "Case" ("publicNumber");
