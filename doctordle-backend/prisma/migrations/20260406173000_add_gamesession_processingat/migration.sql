ALTER TABLE "GameSession"
ADD COLUMN "processingAt" TIMESTAMP(3);

CREATE INDEX "GameSession_processingAt_idx" ON "GameSession"("processingAt");
