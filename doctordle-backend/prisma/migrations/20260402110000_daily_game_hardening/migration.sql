-- Safe additive migration for daily game hardening.
-- Backward-compatible: keep legacy columns, add legacy markers, stop writing to them in code.

-- 1) Core user tables
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
  "lastPlayedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "UserStats" (
  "userId" TEXT PRIMARY KEY,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "bestStreak" INTEGER NOT NULL DEFAULT 0,
  "lastPlayedDate" DATE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserStats_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2) Daily case + leaderboard tables
CREATE TABLE IF NOT EXISTS "DailyCase" (
  "id" TEXT PRIMARY KEY,
  "caseId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyCase_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyCase_date_key" ON "DailyCase"("date");
CREATE INDEX IF NOT EXISTS "DailyCase_caseId_idx" ON "DailyCase"("caseId");

CREATE TABLE IF NOT EXISTS "LeaderboardEntry" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dailyCaseId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "attemptsCount" INTEGER NOT NULL,
  "timeToComplete" INTEGER,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "rankLegacy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaderboardEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeaderboardEntry_dailyCaseId_fkey"
    FOREIGN KEY ("dailyCaseId") REFERENCES "DailyCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeaderboardEntry_dailyCaseId_userId_key"
  ON "LeaderboardEntry"("dailyCaseId", "userId");
CREATE INDEX IF NOT EXISTS "LeaderboardEntry_dailyCaseId_score_attemptsCount_completedAt_idx"
  ON "LeaderboardEntry"("dailyCaseId", "score" DESC, "attemptsCount" ASC, "completedAt" ASC);
CREATE INDEX IF NOT EXISTS "LeaderboardEntry_userId_completedAt_idx"
  ON "LeaderboardEntry"("userId", "completedAt" DESC);

-- 3) Existing tables: additive columns only
ALTER TABLE "GameSession"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "userTierAtStart" TEXT,
  ADD COLUMN IF NOT EXISTS "currentClueIndexLegacy" INTEGER DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GameSession_userId_fkey'
  ) THEN
    ALTER TABLE "GameSession"
      ADD CONSTRAINT "GameSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Attempt"
  ADD COLUMN IF NOT EXISTS "clueIndexAtAttempt" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Attempt' AND column_name = 'userId'
  ) THEN
    ALTER TABLE "Attempt" ADD COLUMN "userId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Attempt_userId_fkey'
  ) THEN
    ALTER TABLE "Attempt"
      ADD CONSTRAINT "Attempt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Indexes for atomicity/ranking/idempotency checks
CREATE INDEX IF NOT EXISTS "User_subscriptionTier_idx" ON "User"("subscriptionTier");
CREATE INDEX IF NOT EXISTS "GameSession_userId_idx" ON "GameSession"("userId");
CREATE INDEX IF NOT EXISTS "GameSession_userId_status_completedAt_idx"
  ON "GameSession"("userId", "status", "completedAt");
CREATE INDEX IF NOT EXISTS "Attempt_userId_idx" ON "Attempt"("userId");
CREATE INDEX IF NOT EXISTS "Attempt_sessionId_normalizedGuess_createdAt_idx"
  ON "Attempt"("sessionId", "normalizedGuess", "createdAt");
