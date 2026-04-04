ALTER TABLE "Attempt"
ADD COLUMN IF NOT EXISTS "normalizedGuess" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "evaluatorVersion" TEXT NOT NULL DEFAULT 'v2';

CREATE INDEX IF NOT EXISTS "Attempt_sessionId_idx" ON "Attempt"("sessionId");
CREATE INDEX IF NOT EXISTS "Attempt_caseId_idx" ON "Attempt"("caseId");
