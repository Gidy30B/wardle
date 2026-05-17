# Diagnosis Registry Taxonomy

`DiagnosisRegistry` is the long-term clinical taxonomy layer for Wardle. It
currently coexists with the legacy `Diagnosis` table, but the main runtime paths
are registry-native: generation, manual/admin case creation, scheduler
readiness, gameplay correctness, and read payloads now use `DiagnosisRegistry`
as the primary diagnosis identity.

This metadata is intentionally additive and nullable so existing diagnoses,
cases, aliases, and scheduling flows remain backward compatible.

## Identity Fields

- `canonicalName`: normalized clinical identity used internally.
- `canonicalNormalized`: normalized unique key for canonical matching.
- `displayLabel`: user-facing diagnosis label.
- `legacyDiagnosisId`: bridge back to the legacy `Diagnosis` row while the app is
  in dual-write mode.
- `status` / `active`: publication and compatibility status.
- `isDescriptive`: marks rows that are descriptive phrases rather than a compact
  diagnosis.
- `isCompositional`: marks rows that combine multiple clinical entities.
- `searchPriority`: ranking boost for autocomplete and dictionary search.

## Clinical Taxonomy Fields

- `specialty`: broad clinical discipline responsible for the diagnosis.
  Examples: Cardiology, Neurology, Endocrinology, Infectious Disease.
- `subspecialty`: more specific branch inside a specialty.
  Examples: Neuromuscular, Movement Disorders, Heart Failure,
  Electrophysiology.
- `bodySystem`: broad physiological or body system.
  Examples: Cardiovascular, Nervous System, Respiratory, Gastrointestinal.
- `category`: educational or disease grouping.
  Examples: Neurodegenerative, Vascular, Infectious, Autoimmune, Metabolic,
  Neoplastic.
- `organSystem`: more granular organ or anatomic region.
  Examples: Brain, Spinal Cord, Peripheral Nerve, Myocardium, Liver, Kidney.

## Curriculum And Gameplay Planning Fields

- `difficultyBand`: approximate educational difficulty.
  Values: `BASIC`, `INTERMEDIATE`, `ADVANCED`.
- `rarityBand`: approximate prevalence/rarity.
  Values: `COMMON`, `UNCOMMON`, `RARE`.
- `clinicalSetting`: typical clinical setting.
  Values: `OUTPATIENT`, `EMERGENCY`, `INPATIENT`, `ICU`, `COMMUNITY`.
- `ageGroup`: typical age group.
  Values: `PEDIATRIC`, `ADULT`, `GERIATRIC`, `ANY`.
- `urgencyLevel`: typical urgency for case framing.
  Values: `ROUTINE`, `URGENT`, `EMERGENT`.
- `isPlayable`: whether the row can appear as a playable answer. Defaults to
  `true` to preserve existing behavior.
- `isGeneratable`: whether automated generation may create cases for the row.
  Defaults to `true` to preserve existing behavior.

## Generation Guidance Fields

- `preferredClueTypes`: optional ordered/unordered clue-type guidance for future
  generation planning. Expected values are `history`, `symptom`, `vital`, `lab`,
  `exam`, and `imaging`.
- `excludedClueTypes`: optional clue types to avoid or de-emphasize for a
  diagnosis.

These fields are advisory only in this PR. The current generator does not read
them yet.

## Current Compatibility Notes

- `Diagnosis.system` remains the only legacy diagnosis metadata field.
- Existing registry rows may have `specialty` and `category` as `NULL`.
- Read payloads should prefer registry metadata before legacy fallbacks.
- `Case.diagnosisId` and `CaseRevision.diagnosisId` are nullable compatibility
  fields.
- New generated and manual/admin-created cases should be linked through
  `diagnosisRegistryId`.

## Legacy System Backfill

`Diagnosis.system` is transitional compatibility metadata. The registry taxonomy
is the authoritative long-term metadata surface for grouping, balancing,
generation planning, learn filters, and analytics.

The `backfill:registry-taxonomy` script maps known legacy systems into registry
taxonomy fields. It is additive only:

- it only processes registry rows linked to a legacy `Diagnosis`;
- it only fills missing `specialty`, `subspecialty`, `bodySystem`, and
  `category` fields;
- it never overwrites existing curated registry metadata;
- dry-run is the default mode;
- `--apply` is required to write changes;
- unmapped legacy systems are reported separately for manual taxonomy curation.

Generation work should read taxonomy from `DiagnosisRegistry`, not from legacy
`Diagnosis.system`.

## Deferred Legacy Diagnosis Cleanup

Do not delete the legacy diagnosis layer yet. Keep these schema surfaces until
search/retrieval and historical compatibility have been migrated:

- `Diagnosis`
- `Synonym`
- `DiagnosisEmbedding`
- `Case.diagnosisId`
- `CaseRevision.diagnosisId`
- `DiagnosisRegistry.legacyDiagnosisId`

They remain for historical cases, retrieval/search compatibility, seed and
migration compatibility, and admin review fallback paths.

### Cleanup Sequence

1. Migrate registry search.
   Replace `DiagnosisEmbedding`, legacy `Diagnosis`/`Synonym` search, and
   `diagnostics/retrieval.service.ts` dependencies with registry-native
   embeddings and aliases.
2. Migrate seed and migration compatibility.
   Stop creating legacy `Diagnosis` rows in seed/bootstrap flows once registry
   search no longer depends on them.
3. Remove admin compatibility fallbacks.
   Keep registry link/edit workflows, but remove legacy-only rescue paths after
   production data is fully linked and verified.
4. Backfill and verify historical data.
   Confirm every playable/published case and revision has a matched active
   registry row before schema hardening.
5. Drop legacy schema in a later destructive cleanup PR.
   Only after the above are complete should `Diagnosis`, `Synonym`,
   `DiagnosisEmbedding`, nullable legacy FK columns, and
   `DiagnosisRegistry.legacyDiagnosisId` be considered for removal.

## Future Migration Direction

1. Backfill registry taxonomy from curated data and carefully mapped
   `Diagnosis.system` values.
2. Expose registry metadata in gameplay/learn read models.
3. Move generation planning to select a `DiagnosisRegistry` row first.
4. Gate publish readiness on registry linkage and metadata completeness.
5. Make `Case.diagnosisRegistryId` required after historical data verification.
6. Complete the deferred legacy diagnosis cleanup sequence above.
