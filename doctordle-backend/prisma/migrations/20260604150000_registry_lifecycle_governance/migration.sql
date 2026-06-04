-- Phase 13E-A: Registry lifecycle governance metadata.
ALTER TABLE "DiagnosisRegistry"
  ADD COLUMN "activationReviewedByUserId" TEXT,
  ADD COLUMN "activationReviewedAt" TIMESTAMP(3);

CREATE INDEX "DiagnosisRegistry_activationReviewedByUserId_idx"
  ON "DiagnosisRegistry"("activationReviewedByUserId");

ALTER TABLE "DiagnosisRegistry"
  ADD CONSTRAINT "DiagnosisRegistry_activationReviewedByUserId_fkey"
  FOREIGN KEY ("activationReviewedByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
