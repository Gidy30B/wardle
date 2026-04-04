-- Backfill missing GameSession.userId from earliest attempt with non-null userId
UPDATE "GameSession" gs
SET "userId" = src."userId"
FROM (
  SELECT DISTINCT ON (a."sessionId")
    a."sessionId",
    a."userId"
  FROM "Attempt" a
  WHERE a."userId" IS NOT NULL
  ORDER BY a."sessionId", a."createdAt" ASC
) src
WHERE gs."id" = src."sessionId"
  AND gs."userId" IS NULL;

-- Ensure a deterministic legacy fallback user exists for unattributable historical sessions
INSERT INTO "User" ("id", "subscriptionTier")
VALUES ('legacy-unattributed-user', 'free')
ON CONFLICT ("id") DO NOTHING;

-- Final userId fill for sessions with no attributable attempt user
UPDATE "GameSession"
SET "userId" = 'legacy-unattributed-user'
WHERE "userId" IS NULL;

-- Create missing DailyCase rows by UTC day (one per day) from sessions that still need dailyCaseId
INSERT INTO "DailyCase" ("id", "caseId", "date", "createdAt")
SELECT
  gen_random_uuid()::text,
  pick."caseId",
  pick."dayUtc"::date,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (day_utc)
    day_utc AS "dayUtc",
    "caseId"
  FROM (
    SELECT
      gs."caseId",
      (date_trunc('day', gs."startedAt" AT TIME ZONE 'UTC'))::date AS day_utc,
      gs."startedAt"
    FROM "GameSession" gs
    WHERE gs."dailyCaseId" IS NULL
  ) q
  ORDER BY day_utc, "startedAt" ASC
) pick
LEFT JOIN "DailyCase" dc ON dc."date" = pick."dayUtc"::date
WHERE dc."id" IS NULL;

-- Backfill GameSession.dailyCaseId by UTC day
UPDATE "GameSession" gs
SET "dailyCaseId" = dc."id"
FROM "DailyCase" dc
WHERE gs."dailyCaseId" IS NULL
  AND dc."date" = (date_trunc('day', gs."startedAt" AT TIME ZONE 'UTC'))::date;
