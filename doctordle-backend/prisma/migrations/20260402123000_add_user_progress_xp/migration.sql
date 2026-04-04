-- Additive economy migration: XP progression + idempotent session XP marker

ALTER TABLE "GameSession"
  ADD COLUMN IF NOT EXISTS "xpAwardedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "UserProgress" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "xpTotal" INTEGER NOT NULL DEFAULT 0,
  "level" INTEGER NOT NULL DEFAULT 1,
  "xpCurrentLevel" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserProgress_xpTotal_idx" ON "UserProgress"("xpTotal");
CREATE INDEX IF NOT EXISTS "GameSession_xpAwardedAt_idx" ON "GameSession"("xpAwardedAt");
