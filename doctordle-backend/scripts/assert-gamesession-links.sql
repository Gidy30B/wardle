DO $$
DECLARE
  null_user_count INTEGER;
  null_daily_case_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_user_count
  FROM "GameSession"
  WHERE "userId" IS NULL;

  SELECT COUNT(*) INTO null_daily_case_count
  FROM "GameSession"
  WHERE "dailyCaseId" IS NULL;

  IF null_user_count > 0 OR null_daily_case_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: null userId=%, null dailyCaseId=%', null_user_count, null_daily_case_count;
  END IF;
END $$;
