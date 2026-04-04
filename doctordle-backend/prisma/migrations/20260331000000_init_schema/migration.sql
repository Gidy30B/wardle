CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "Diagnosis" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "system" TEXT,
  CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Diagnosis_name_key" ON "Diagnosis"("name");

CREATE TABLE IF NOT EXISTS "DiagnosisEmbedding" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "diagnosisId" TEXT NOT NULL,
  "vector" vector(1536) NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosisEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiagnosisEmbedding_diagnosisId_idx" ON "DiagnosisEmbedding"("diagnosisId");
CREATE INDEX IF NOT EXISTS "DiagnosisEmbedding_type_idx" ON "DiagnosisEmbedding"("type");

CREATE TABLE IF NOT EXISTS "Synonym" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "term" TEXT NOT NULL,
  "diagnosisId" TEXT NOT NULL,
  CONSTRAINT "Synonym_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Synonym_term_key" ON "Synonym"("term");
CREATE INDEX IF NOT EXISTS "Synonym_diagnosisId_idx" ON "Synonym"("diagnosisId");

CREATE TABLE IF NOT EXISTS "Case" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "date" TIMESTAMP(3) NOT NULL,
  "difficulty" TEXT NOT NULL,
  "history" TEXT NOT NULL,
  "symptoms" TEXT[] NOT NULL,
  "labs" JSONB,
  "diagnosisId" TEXT NOT NULL,
  CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Case_date_key" ON "Case"("date");
CREATE INDEX IF NOT EXISTS "Case_diagnosisId_idx" ON "Case"("diagnosisId");

CREATE TABLE IF NOT EXISTS "Attempt" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId" TEXT NOT NULL,
  "userId" TEXT,
  "sessionId" TEXT NOT NULL,
  "guess" TEXT NOT NULL,
  "normalizedGuess" TEXT NOT NULL DEFAULT '',
  "score" DOUBLE PRECISION NOT NULL,
  "result" TEXT NOT NULL,
  "signals" JSONB NOT NULL,
  "evaluatorVersion" TEXT NOT NULL DEFAULT 'v2',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Attempt_sessionId_idx" ON "Attempt"("sessionId");
CREATE INDEX IF NOT EXISTS "Attempt_caseId_idx" ON "Attempt"("caseId");
CREATE INDEX IF NOT EXISTS "Attempt_createdAt_idx" ON "Attempt"("createdAt");
CREATE INDEX IF NOT EXISTS "Attempt_result_guess_idx" ON "Attempt"("result", "guess");

DO $$ BEGIN
  ALTER TABLE "DiagnosisEmbedding"
  ADD CONSTRAINT "DiagnosisEmbedding_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Synonym"
  ADD CONSTRAINT "Synonym_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Case"
  ADD CONSTRAINT "Case_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt"
  ADD CONSTRAINT "Attempt_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
