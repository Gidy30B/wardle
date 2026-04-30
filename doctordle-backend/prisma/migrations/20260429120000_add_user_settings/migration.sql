CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "showTimer" BOOLEAN NOT NULL DEFAULT true,
  "hintsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "autocompleteEnabled" BOOLEAN NOT NULL DEFAULT true,
  "difficultyPreference" TEXT NOT NULL DEFAULT 'STANDARD',
  "spacedRepetitionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE INDEX IF NOT EXISTS "UserSettings_userId_idx" ON "UserSettings"("userId");

DO $$ BEGIN
  ALTER TABLE "UserSettings"
  ADD CONSTRAINT "UserSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
