ALTER TABLE "DiagnosisRegistryCandidate"
ADD COLUMN "approvedByUserId" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "mergeTargetCandidateId" TEXT,
ADD COLUMN "creationSnapshot" JSONB;

CREATE INDEX "DiagnosisRegistryCandidate_approvedByUserId_idx"
ON "DiagnosisRegistryCandidate"("approvedByUserId");

CREATE INDEX "DiagnosisRegistryCandidate_mergeTargetCandidateId_idx"
ON "DiagnosisRegistryCandidate"("mergeTargetCandidateId");

ALTER TABLE "DiagnosisRegistryCandidate"
ADD CONSTRAINT "DiagnosisRegistryCandidate_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiagnosisRegistryCandidate"
ADD CONSTRAINT "DiagnosisRegistryCandidate_mergeTargetCandidateId_fkey"
FOREIGN KEY ("mergeTargetCandidateId") REFERENCES "DiagnosisRegistryCandidate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
