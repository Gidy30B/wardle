CREATE TABLE IF NOT EXISTS "GameSession" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GameSession_caseId_idx" ON "GameSession"("caseId");
CREATE INDEX IF NOT EXISTS "GameSession_status_idx" ON "GameSession"("status");
CREATE INDEX IF NOT EXISTS "GameSession_startedAt_idx" ON "GameSession"("startedAt");

DO $$ BEGIN
  ALTER TABLE "GameSession"
  ADD CONSTRAINT "GameSession_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "GameSession" ("id", "caseId", "startedAt", "status")
SELECT
  a."sessionId",
  MIN(a."caseId") AS "caseId",
  COALESCE(MIN(a."createdAt"), CURRENT_TIMESTAMP) AS "startedAt",
  'completed'
FROM "Attempt" a
WHERE NOT EXISTS (
  SELECT 1 FROM "GameSession" gs WHERE gs."id" = a."sessionId"
)
GROUP BY a."sessionId";

DO $$ BEGIN
  ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
