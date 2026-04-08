CREATE TABLE "HintContent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HintContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExplanationContent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExplanationContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HintContent_caseId_key" ON "HintContent"("caseId");
CREATE UNIQUE INDEX "ExplanationContent_caseId_key" ON "ExplanationContent"("caseId");
CREATE INDEX "HintContent_caseId_idx" ON "HintContent"("caseId");
CREATE INDEX "ExplanationContent_caseId_idx" ON "ExplanationContent"("caseId");

ALTER TABLE "HintContent"
ADD CONSTRAINT "HintContent_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExplanationContent"
ADD CONSTRAINT "ExplanationContent_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
