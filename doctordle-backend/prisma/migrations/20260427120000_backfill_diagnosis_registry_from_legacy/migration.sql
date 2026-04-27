-- Backfill DiagnosisRegistry and DiagnosisAlias from legacy Diagnosis and Synonym tables.
-- Also links Case and CaseRevision records to their corresponding DiagnosisRegistry entries.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Helper function
CREATE OR REPLACE FUNCTION normalize_diagnosis_term(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower(unaccent(input)),
                '[-_/]+', ' ', 'g'
              ),
              '[.]+', '', 'g'
            ),
            '[^a-z0-9\s]', ' ', 'g'
          ),
          '\s+', ' ', 'g'
        ),
        '^\s+|\s+$', '', 'g'
      )
    );
$$;

-- ─────────────────────────────────────────────────────────
-- Step 1: DiagnosisRegistry
-- ─────────────────────────────────────────────────────────
INSERT INTO "DiagnosisRegistry" (
  "id",
  "legacyDiagnosisId",
  "canonicalName",
  "canonicalNormalized",
  "displayLabel",
  "status",
  "active",
  "isDescriptive",
  "isCompositional",
  "searchPriority",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  d."id",
  d."name",
  normalize_diagnosis_term(d."name"),
  d."name",
  'ACTIVE'::"DiagnosisRegistryStatus",
  true,
  false,
  false,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Diagnosis" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "DiagnosisRegistry" dr
  WHERE dr."legacyDiagnosisId" = d."id"
)
ON CONFLICT ("canonicalNormalized") DO NOTHING;

UPDATE "DiagnosisRegistry" dr
SET "legacyDiagnosisId" = d."id"
FROM "Diagnosis" d
WHERE dr."legacyDiagnosisId" IS NULL
  AND dr."canonicalNormalized" = normalize_diagnosis_term(d."name")
  AND NOT EXISTS (
    SELECT 1
    FROM "DiagnosisRegistry" dr2
    WHERE dr2."legacyDiagnosisId" = d."id"
  );

-- ─────────────────────────────────────────────────────────
-- Step 2: Canonical aliases
-- ─────────────────────────────────────────────────────────
INSERT INTO "DiagnosisAlias" (
  "id",
  "diagnosisRegistryId",
  "term",
  "normalizedTerm",
  "kind",
  "acceptedForMatch",
  "rank",
  "source",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  dr."id",
  dr."canonicalName",
  dr."canonicalNormalized",
  'CANONICAL'::"DiagnosisAliasKind",
  true,
  0,
  'legacy_canonical',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "DiagnosisRegistry" dr
WHERE dr."legacyDiagnosisId" IS NOT NULL
ON CONFLICT ("diagnosisRegistryId", "normalizedTerm") DO UPDATE
SET
  "term" = EXCLUDED."term",
  "kind" = 'CANONICAL',
  "acceptedForMatch" = true,
  "rank" = 0,
  "source" = 'legacy_canonical',
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- ─────────────────────────────────────────────────────────
-- Step 3: Synonyms (FIXED SECTION)
-- ─────────────────────────────────────────────────────────

WITH synonym_normalized AS (
  SELECT
    s."id"          AS synonym_id,
    s."term"        AS synonym_term,
    s."diagnosisId" AS diagnosis_id,
    normalize_diagnosis_term(s."term") AS normalized_term,
    dr."id"         AS registry_id
  FROM "Synonym" s
  JOIN "DiagnosisRegistry" dr ON dr."legacyDiagnosisId" = s."diagnosisId"
  WHERE normalize_diagnosis_term(s."term") <> ''
    AND normalize_diagnosis_term(s."term") <> dr."canonicalNormalized"
),

-- ✅ FIXED: proper aggregation (no illegal references)
term_owner_counts AS (
  SELECT
    normalized_term,
    COUNT(DISTINCT owner_id) AS owner_count
  FROM (
    SELECT
      sn.normalized_term,
      sn.diagnosis_id AS owner_id
    FROM synonym_normalized sn

    UNION

    SELECT
      dr."canonicalNormalized",
      dr."legacyDiagnosisId"
    FROM "DiagnosisRegistry" dr
  ) owners
  GROUP BY normalized_term
),

synonym_decisions AS (
  SELECT
    sn.synonym_id,
    sn.synonym_term,
    sn.diagnosis_id,
    sn.normalized_term,
    sn.registry_id,
    toc.owner_count,
    CASE
      WHEN toc.owner_count > 1 THEN 'SEARCH_ONLY'
      WHEN
        length(regexp_replace(sn.synonym_term, '[^A-Za-z0-9]', '', 'g')) BETWEEN 2 AND 5
        AND sn.synonym_term NOT SIMILAR TO '%[[:space:]]%'
      THEN 'ABBREVIATION'
      ELSE 'SEARCH_ONLY'
    END AS alias_kind,
    CASE
      WHEN toc.owner_count > 1 THEN false
      WHEN
        length(regexp_replace(sn.synonym_term, '[^A-Za-z0-9]', '', 'g')) BETWEEN 2 AND 5
        AND sn.synonym_term NOT SIMILAR TO '%[[:space:]]%'
      THEN true
      ELSE false
    END AS accepted_for_match,
    CASE
      WHEN toc.owner_count > 1 THEN 'legacy_synonym_ambiguous'
      WHEN
        length(regexp_replace(sn.synonym_term, '[^A-Za-z0-9]', '', 'g')) BETWEEN 2 AND 5
        AND sn.synonym_term NOT SIMILAR TO '%[[:space:]]%'
      THEN 'legacy_synonym_abbreviation'
      ELSE 'legacy_synonym_search_only'
    END AS alias_source
  FROM synonym_normalized sn
  JOIN term_owner_counts toc ON toc.normalized_term = sn.normalized_term
)

INSERT INTO "DiagnosisAlias" (
  "id",
  "diagnosisRegistryId",
  "term",
  "normalizedTerm",
  "kind",
  "acceptedForMatch",
  "rank",
  "source",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  sd.registry_id,
  sd.synonym_term,
  sd.normalized_term,
  sd.alias_kind,
  sd.accepted_for_match,
  10,
  sd.alias_source,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM synonym_decisions sd
ON CONFLICT ("diagnosisRegistryId", "normalizedTerm") DO UPDATE
SET
  "term" = EXCLUDED."term",
  "kind" = EXCLUDED."kind",
  "acceptedForMatch" = EXCLUDED."acceptedForMatch",
  "rank" = 10,
  "source" = EXCLUDED."source",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- ─────────────────────────────────────────────────────────
-- Step 4: Link Case
-- ─────────────────────────────────────────────────────────
UPDATE "Case" c
SET
  "diagnosisRegistryId" = dr."id",
  "diagnosisMappingStatus" = 'MATCHED',
  "diagnosisMappingMethod" = 'LEGACY_BACKFILL',
  "diagnosisMappingConfidence" = COALESCE(c."diagnosisMappingConfidence", 1.0)
FROM "DiagnosisRegistry" dr
WHERE dr."legacyDiagnosisId" = c."diagnosisId";

-- ─────────────────────────────────────────────────────────
-- Step 5: Link CaseRevision
-- ─────────────────────────────────────────────────────────
UPDATE "CaseRevision" cr
SET
  "diagnosisRegistryId" = dr."id",
  "diagnosisMappingStatus" = 'MATCHED',
  "diagnosisMappingMethod" = 'LEGACY_BACKFILL',
  "diagnosisMappingConfidence" = COALESCE(cr."diagnosisMappingConfidence", 1.0)
FROM "DiagnosisRegistry" dr
WHERE dr."legacyDiagnosisId" = cr."diagnosisId";

-- Cleanup
DROP FUNCTION IF EXISTS normalize_diagnosis_term(TEXT);
