-- Add optional email to local User for Clerk sync updates.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "email" TEXT;
