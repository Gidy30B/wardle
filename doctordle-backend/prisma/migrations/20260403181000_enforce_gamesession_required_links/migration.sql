-- Phase 7 (breaking after backfill): enforce non-null invariants

DO $$
DECLARE
  null_user_count INTEGER;
  null_daily_case_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_user_count
  FROM "GameSession"
  WHERE "userId" IS NULL;

  IF null_user_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce GameSession.userId NOT NULL. Found % rows with NULL userId.', null_user_count;
  END IF;

  SELECT COUNT(*) INTO null_daily_case_count
  FROM "GameSession"
  WHERE "dailyCaseId" IS NULL;

  IF null_daily_case_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce GameSession.dailyCaseId NOT NULL. Found % rows with NULL dailyCaseId.', null_daily_case_count;
  END IF;
END $$;

ALTER TABLE "GameSession"
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "dailyCaseId" SET NOT NULL;
