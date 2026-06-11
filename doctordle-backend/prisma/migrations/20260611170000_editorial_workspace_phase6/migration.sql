ALTER TYPE "AiDraftReviewStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "AiDraftReviewStatus" ADD VALUE IF NOT EXISTS 'NEEDS_CHANGES';
ALTER TYPE "AiDraftReviewStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

ALTER TABLE "AiDraftRevisionAudit"
  ADD COLUMN "reviewerUserId" TEXT,
  ADD COLUMN "decisionAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "AiDraftRevisionAudit"
  ALTER COLUMN "reviewStatus" SET DEFAULT 'PENDING_REVIEW';

UPDATE "AiDraftRevisionAudit"
SET "reviewStatus" = 'PENDING_REVIEW'
WHERE "reviewStatus" = 'REVIEW_REQUIRED';

ALTER TABLE "AiDraftRevisionAudit"
  ADD CONSTRAINT "AiDraftRevisionAudit_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AiDraftRevisionAudit_reviewerUserId_idx"
  ON "AiDraftRevisionAudit"("reviewerUserId");
