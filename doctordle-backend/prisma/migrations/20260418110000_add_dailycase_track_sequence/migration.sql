ALTER TABLE "DailyCase"
ADD COLUMN IF NOT EXISTS "track" "PublishTrack" NOT NULL DEFAULT 'DAILY';

ALTER TABLE "DailyCase"
ADD COLUMN IF NOT EXISTS "sequenceIndex" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "DailyCase_date_key";

CREATE UNIQUE INDEX IF NOT EXISTS "DailyCase_date_track_sequenceIndex_key"
ON "DailyCase" ("date", "track", "sequenceIndex");

CREATE INDEX IF NOT EXISTS "DailyCase_date_track_idx"
ON "DailyCase" ("date", "track");

ALTER TABLE "DailyCase"
ALTER COLUMN "track" DROP DEFAULT;

ALTER TABLE "DailyCase"
ALTER COLUMN "sequenceIndex" DROP DEFAULT;
