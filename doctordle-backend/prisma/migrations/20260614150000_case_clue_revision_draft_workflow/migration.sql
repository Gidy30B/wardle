ALTER TABLE "CaseClueRevisionDraft"
ADD COLUMN "decisionAt" TIMESTAMP(3),
ADD COLUMN "decisionByUserId" TEXT,
ADD COLUMN "decisionNote" TEXT,
ADD COLUMN "appliedAt" TIMESTAMP(3),
ADD COLUMN "appliedByUserId" TEXT;

CREATE INDEX "CaseClueRevisionDraft_status_idx" ON "CaseClueRevisionDraft"("status");
CREATE INDEX "CaseClueRevisionDraft_decisionByUserId_idx" ON "CaseClueRevisionDraft"("decisionByUserId");
CREATE INDEX "CaseClueRevisionDraft_appliedByUserId_idx" ON "CaseClueRevisionDraft"("appliedByUserId");
