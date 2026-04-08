ALTER TABLE "GameSession"
ADD COLUMN "processedAt" TIMESTAMP(3);

CREATE INDEX "GameSession_processedAt_idx" ON "GameSession"("processedAt");
