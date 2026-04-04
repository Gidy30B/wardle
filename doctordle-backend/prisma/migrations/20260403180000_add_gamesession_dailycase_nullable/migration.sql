-- Phase 1 (additive): add dailyCaseId to sessions without breaking runtime

ALTER TABLE "GameSession"
  ADD COLUMN IF NOT EXISTS "dailyCaseId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GameSession_dailyCaseId_fkey'
  ) THEN
    ALTER TABLE "GameSession"
      ADD CONSTRAINT "GameSession_dailyCaseId_fkey"
      FOREIGN KEY ("dailyCaseId") REFERENCES "DailyCase"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GameSession_dailyCaseId_idx"
  ON "GameSession"("dailyCaseId");
