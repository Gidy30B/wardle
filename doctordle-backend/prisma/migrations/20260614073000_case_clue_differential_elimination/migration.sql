-- Additive Phase 7F-B payload fields for already-applied clue progression tables.
ALTER TABLE "CaseClueProgressionAnalysis"
ADD COLUMN IF NOT EXISTS "differentialElimination" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "totalMimicsTracked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "eliminatedMimicCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "unresolvedMimicCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "persistentConfusionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "weakEliminationCount" INTEGER NOT NULL DEFAULT 0;
