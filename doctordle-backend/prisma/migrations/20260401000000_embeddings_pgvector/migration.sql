CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "DiagnosisEmbedding"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "DiagnosisEmbedding_vector_ivfflat_idx"
ON "DiagnosisEmbedding"
USING ivfflat ("vector" vector_cosine_ops)
WITH (lists = 100);
