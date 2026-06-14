CREATE TABLE "CaseClueRevisionDraft" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceAuditId" TEXT NOT NULL,
    "clueOrder" INTEGER,
    "clueIndex" INTEGER,
    "originalClue" TEXT,
    "revisedClue" TEXT,
    "addedClue" TEXT,
    "rationale" TEXT,
    "expectedEffect" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseClueRevisionDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseClueRevisionDraft_sourceAuditId_key" ON "CaseClueRevisionDraft"("sourceAuditId");
CREATE INDEX "CaseClueRevisionDraft_caseId_idx" ON "CaseClueRevisionDraft"("caseId");
CREATE INDEX "CaseClueRevisionDraft_sourceAuditId_idx" ON "CaseClueRevisionDraft"("sourceAuditId");

ALTER TABLE "CaseClueRevisionDraft"
ADD CONSTRAINT "CaseClueRevisionDraft_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
