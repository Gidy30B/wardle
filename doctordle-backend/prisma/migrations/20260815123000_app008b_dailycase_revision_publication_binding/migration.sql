-- APP-008B DailyCase Revision / Publication Binding
-- Additive migration only. Existing DailyCase rows remain legacy-compatible;
-- no historical publication decisions or revision bindings are fabricated.

ALTER TABLE "DailyCase"
  ADD COLUMN "caseRevisionId" TEXT,
  ADD COLUMN "publicationDecisionId" TEXT;

CREATE INDEX "DailyCase_caseRevisionId_idx"
  ON "DailyCase"("caseRevisionId");

CREATE INDEX "DailyCase_publicationDecisionId_idx"
  ON "DailyCase"("publicationDecisionId");

ALTER TABLE "DailyCase"
  ADD CONSTRAINT "DailyCase_caseRevisionId_fkey"
  FOREIGN KEY ("caseRevisionId") REFERENCES "CaseRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCase"
  ADD CONSTRAINT "DailyCase_publicationDecisionId_fkey"
  FOREIGN KEY ("publicationDecisionId") REFERENCES "CaseRevisionPublicationDecision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
