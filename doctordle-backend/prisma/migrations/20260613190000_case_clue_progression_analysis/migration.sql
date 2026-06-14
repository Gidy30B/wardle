-- Editorial-only clue progression analysis for case debugging.
CREATE TABLE "CaseClueProgressionAnalysis" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "diagnosisRegistryId" TEXT,
    "analysisVersion" TEXT NOT NULL DEFAULT 'heuristic_v1',
    "diagnosticStates" JSONB NOT NULL,
    "mimicCollapses" JSONB NOT NULL,
    "discriminatorEmergences" JSONB NOT NULL,
    "differentialElimination" JSONB NOT NULL DEFAULT '[]',
    "leadingDifferentials" JSONB NOT NULL,
    "remainingMimics" JSONB NOT NULL,
    "discriminatorSignals" JSONB NOT NULL,
    "editorialSignals" JSONB NOT NULL,
    "likelyLockInClue" INTEGER,
    "confidenceEstimate" DOUBLE PRECISION,
    "ambiguityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prematureLeakFlag" BOOLEAN NOT NULL DEFAULT false,
    "unresolvedAmbiguityFlag" BOOLEAN NOT NULL DEFAULT false,
    "totalMimicsTracked" INTEGER NOT NULL DEFAULT 0,
    "eliminatedMimicCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedMimicCount" INTEGER NOT NULL DEFAULT 0,
    "persistentConfusionCount" INTEGER NOT NULL DEFAULT 0,
    "weakEliminationCount" INTEGER NOT NULL DEFAULT 0,
    "editorialNotes" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseClueProgressionAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseClueProgressionAnalysis_caseId_key" ON "CaseClueProgressionAnalysis"("caseId");
CREATE INDEX "CaseClueProgressionAnalysis_diagnosisRegistryId_idx" ON "CaseClueProgressionAnalysis"("diagnosisRegistryId");
CREATE INDEX "CaseClueProgressionAnalysis_likelyLockInClue_idx" ON "CaseClueProgressionAnalysis"("likelyLockInClue");
CREATE INDEX "CaseClueProgressionAnalysis_prematureLeakFlag_unresolvedAmbiguityFlag_idx" ON "CaseClueProgressionAnalysis"("prematureLeakFlag", "unresolvedAmbiguityFlag");

ALTER TABLE "CaseClueProgressionAnalysis"
ADD CONSTRAINT "CaseClueProgressionAnalysis_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseClueProgressionAnalysis"
ADD CONSTRAINT "CaseClueProgressionAnalysis_diagnosisRegistryId_fkey"
FOREIGN KEY ("diagnosisRegistryId") REFERENCES "DiagnosisRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
