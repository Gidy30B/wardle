WITH ranked_sessions AS (
  SELECT
    "id",
    "userId",
    "dailyCaseId",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "dailyCaseId"
      ORDER BY
        CASE WHEN "status" = 'active' THEN 0 ELSE 1 END,
        "startedAt" ASC,
        "id" ASC
    ) AS session_rank,
    FIRST_VALUE("id") OVER (
      PARTITION BY "userId", "dailyCaseId"
      ORDER BY
        CASE WHEN "status" = 'active' THEN 0 ELSE 1 END,
        "startedAt" ASC,
        "id" ASC
    ) AS keeper_id
  FROM "GameSession"
)
UPDATE "Attempt" AS attempt
SET "sessionId" = ranked_sessions.keeper_id
FROM ranked_sessions
WHERE attempt."sessionId" = ranked_sessions."id"
  AND ranked_sessions.session_rank > 1;

WITH ranked_sessions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "dailyCaseId"
      ORDER BY
        CASE WHEN "status" = 'active' THEN 0 ELSE 1 END,
        "startedAt" ASC,
        "id" ASC
    ) AS session_rank
  FROM "GameSession"
)
DELETE FROM "GameSession" AS session
USING ranked_sessions
WHERE session."id" = ranked_sessions."id"
  AND ranked_sessions.session_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_userId_dailyCaseId_key"
ON "GameSession" ("userId", "dailyCaseId");
