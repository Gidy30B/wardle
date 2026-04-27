-- Add editable Wardle profile fields to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "trainingLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "individualMode" BOOLEAN NOT NULL DEFAULT true;
