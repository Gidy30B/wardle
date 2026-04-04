CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_userId_dailyCaseId_active_unique"
ON "GameSession" ("userId", "dailyCaseId")
WHERE "status" = 'active';
