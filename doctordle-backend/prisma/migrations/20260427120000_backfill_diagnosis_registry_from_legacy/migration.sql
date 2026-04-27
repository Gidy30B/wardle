-- Backfill DiagnosisRegistry and DiagnosisAlias from legacy Diagnosis and Synonym tables.
-- Also links Case and CaseRevision records to their corresponding DiagnosisRegistry entries.
--
-- Normalization mirrors the TypeScript normalizeDiagnosisTerm() function:
--   1. Unaccent (strip combining diacritics via unaccent extension or manual NFKD-like approach)
--   2. Lowercase
--   3. Replace connectors (-, _, /) with space
--   4. Remove periods
--   5. Replace remaining non-alphanumeric/non-space chars with space
--   6. Collapse whitespace and trim

-- Ensure the unaccent extension is available (used in the helper function below).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Helper function: normalize a diagnosis term the same way as the TS normalizeDiagnosisTerm()
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
                lower(
                  -- Strip combining diacritical marks (U+0300–U+036F) after NFKD decomposition.
                  -- PostgreSQL does not expose NFKD natively, but unaccent handles the common cases.
                  -- We use translate for the connector/period steps below, so we apply unaccent first.
                  unaccent(input)
                ),
                '[-_/]+', ' ', 'g'   -- connectors → space
              ),
              '[.]+', '', 'g'         -- periods → removed
            ),
            '[^a-z0-9\s]', ' ', 'g'  -- remaining non-alphanumeric/non-space → space
          ),
          '\s+', ' ', 'g'            -- collapse whitespace
        ),
        '^\s+|\s+$', '', 'g'         -- trim
      )
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Insert DiagnosisRegistry rows for every Diagnosis that doesn't
--         already have one.  We use gen_random_uuid() for the id and
--         CURRENT_TIMESTAMP for updatedAt (Prisma @updatedAt convention).
-- ─────────────────────────────────────────────────────────────────────────────
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
-- Skip if the normalized canonical name already exists in the registry
-- (prevents unique constraint violation on canonicalNormalized).
ON CONFLICT ("canonicalNormalized") DO NOTHING;

-- For any Diagnosis whose normalized name collided above (ON CONFLICT DO NOTHING),
-- we still want a registry entry linked to the legacy id.  Those are rare edge
-- cases (two diagnoses that normalize to the same string); we link them to the
-- existing registry row so the FK is satisfied.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Insert CANONICAL DiagnosisAlias for every DiagnosisRegistry entry
--         that was just created (or already existed without a canonical alias).
-- ─────────────────────────────────────────────────────────────────────────────
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
    "term"            = EXCLUDED."term",
    "kind"            = 'CANONICAL'::"DiagnosisAliasKind",
    "acceptedForMatch" = true,
    "rank"            = 0,
    "source"          = 'legacy_canonical',
    "active"          = true,
    "updatedAt"       = CURRENT_TIMESTAMP;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Insert SYNONYM DiagnosisAlias entries from the Synonym table.
--
-- Ambiguity check: a synonym term is "ambiguous" when its normalized form
-- matches more than one Diagnosis (either as a synonym of multiple diagnoses,
-- or as the canonical name of a different diagnosis).
--
-- Ambiguous  → kind = SEARCH_ONLY,  acceptedForMatch = false,  source = legacy_synonym_ambiguous
-- Short token (2-5 non-space chars, no whitespace) → kind = ABBREVIATION, acceptedForMatch = true, source = legacy_synonym_abbreviation
-- Otherwise  → kind = SEARCH_ONLY,  acceptedForMatch = false,  source = legacy_synonym_search_only
-- ─────────────────────────────────────────────────────────────────────────────

-- Build a temporary view of synonym ambiguity counts.
-- A normalized synonym term is ambiguous when it appears as a synonym for
-- more than one distinct Diagnosis, OR when it matches the canonical
-- normalized name of a *different* Diagnosis.
WITH synonym_normalized AS (
  SELECT
    s."id"          AS synonym_id,
    s."term"        AS synonym_term,
    s."diagnosisId" AS diagnosis_id,
    normalize_diagnosis_term(s."term") AS normalized_term,
    dr."id"         AS registry_id,
    dr."canonicalNormalized" AS canonical_normalized
  FROM "Synonym" s
  JOIN "DiagnosisRegistry" dr ON dr."legacyDiagnosisId" = s."diagnosisId"
  -- Skip synonyms whose normalized form is empty or equals the canonical
  WHERE normalize_diagnosis_term(s."term") <> ''
    AND normalize_diagnosis_term(s."term") <> dr."canonicalNormalized"
),
-- Count how many distinct diagnoses "own" each normalized synonym term
-- (either as a synonym or as a canonical name of another diagnosis).
term_owner_counts AS (
  SELECT
    sn.normalized_term,
    COUNT(DISTINCT sn.diagnosis_id) +
      -- Add 1 if another registry entry has this as its canonical normalized name
      (SELECT COUNT(*)
       FROM "DiagnosisRegistry" dr2
       WHERE dr2."canonicalNormalized" = sn.normalized_term
         AND dr2."legacyDiagnosisId" <> sn.diagnosis_id
      ) AS owner_count
  FROM synonym_normalized sn
  GROUP BY sn.normalized_term
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
      WHEN toc.owner_count > 1 THEN
        'SEARCH_ONLY'::"DiagnosisAliasKind"
      WHEN
        -- Short abbreviation: compact form (strip non-alphanumeric) is 2-5 chars
        -- and the original term has no whitespace.
        length(regexp_replace(sn.synonym_term, '[^A-Za-z0-9]', '', 'g')) BETWEEN 2 AND 5
        AND sn.synonym_term NOT SIMILAR TO '%[[:space:]]%'
      THEN
        'ABBREVIATION'::"DiagnosisAliasKind"
      ELSE
        'SEARCH_ONLY'::"DiagnosisAliasKind"
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
    "term"            = EXCLUDED."term",
    "kind"            = EXCLUDED."kind",
    "acceptedForMatch" = EXCLUDED."acceptedForMatch",
    "rank"            = 10,
    "source"          = EXCLUDED."source",
    "active"          = true,
    "updatedAt"       = CURRENT_TIMESTAMP;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Link Case records to their DiagnosisRegistry entry.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE "Case" c
SET
  "diagnosisRegistryId"    = dr."id",
  "diagnosisMappingStatus" = 'MATCHED'::"DiagnosisMappingStatus",
  "diagnosisMappingMethod" = 'LEGACY_BACKFILL'::"DiagnosisMappingMethod",
  "diagnosisMappingConfidence" = COALESCE(c."diagnosisMappingConfidence", 1.0)
FROM "DiagnosisRegistry" dr
WHERE dr."legacyDiagnosisId" = c."diagnosisId"
  AND (
    c."diagnosisRegistryId" IS NULL
    OR c."diagnosisRegistryId" <> dr."id"
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Link CaseRevision records to their DiagnosisRegistry entry.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE "CaseRevision" cr
SET
  "diagnosisRegistryId"    = dr."id",
  "diagnosisMappingStatus" = 'MATCHED'::"DiagnosisMappingStatus",
  "diagnosisMappingMethod" = 'LEGACY_BACKFILL'::"DiagnosisMappingMethod",
  "diagnosisMappingConfidence" = COALESCE(cr."diagnosisMappingConfidence", 1.0)
FROM "DiagnosisRegistry" dr
WHERE dr."legacyDiagnosisId" = cr."diagnosisId"
  AND (
    cr."diagnosisRegistryId" IS NULL
    OR cr."diagnosisRegistryId" <> dr."id"
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup: drop the helper function (it was only needed for this migration).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS normalize_diagnosis_term(TEXT);
