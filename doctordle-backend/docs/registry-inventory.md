# Diagnosis Registry Inventory

Curated diagnosis inventory is imported into `DiagnosisRegistry` only. The CSV workflow does not create legacy `Diagnosis` rows and does not change generation, gameplay, or scheduling behavior.

## CSV Format

Use `docs/registry-inventory/top-100-diagnoses.csv` as the template. The importer expects this exact header:

```csv
displayLabel,canonicalName,specialty,subspecialty,bodySystem,organSystem,category,aliases,difficultyBand,rarityBand,clinicalSetting,ageGroup,urgencyLevel,isPlayable,isGeneratable,searchPriority,isDescriptive,isCompositional,notes
```

Required values:

- `displayLabel`
- `canonicalName`
- `specialty`
- `bodySystem`

Optional values are additive. Blank optional cells preserve existing curated metadata on matching registry rows. For new rows, blank booleans and priority use schema-compatible defaults:

- `isPlayable`: `true`
- `isGeneratable`: `true`
- `isDescriptive`: `false`
- `isCompositional`: `false`
- `searchPriority`: `0`

`canonicalNormalized` is generated automatically from `canonicalName`.

## Enum Values

Use uppercase enum values:

- `difficultyBand`: `BASIC`, `INTERMEDIATE`, `ADVANCED`
- `rarityBand`: `COMMON`, `UNCOMMON`, `RARE`
- `clinicalSetting`: `OUTPATIENT`, `EMERGENCY`, `INPATIENT`, `ICU`, `COMMUNITY`
- `ageGroup`: `PEDIATRIC`, `ADULT`, `GERIATRIC`, `ANY`
- `urgencyLevel`: `ROUTINE`, `URGENT`, `EMERGENT`

Invalid enum values reject the row before any write happens.

## Aliases

Put aliases in one semicolon-separated cell:

```csv
Heart attack;MI
```

Each alias becomes a `DiagnosisAlias` with:

- `kind = ACCEPTED`
- `acceptedForMatch = true`
- `active = true`
- `source = curated_csv`

Duplicate aliases in the same row, aliases matching the canonical normalized name, or accepted aliases already attached to another registry row are reported as duplicate aliases.

## Dry Run

Dry-run is the default and performs no writes:

```bash
npx ts-node scripts/import-diagnosis-registry-csv.ts
```

Use a custom file:

```bash
npx ts-node scripts/import-diagnosis-registry-csv.ts --file=docs/registry-inventory/top-100-diagnoses.csv
```

Review the JSON output before applying. Important fields:

- `created`
- `updated`
- `skipped`
- `aliasesCreated`
- `aliasesUpdated`
- `duplicateAliases`
- `invalidRows`
- `duplicateCanonicalNames`

## Apply

Apply writes only after validation passes:

```bash
npx ts-node scripts/import-diagnosis-registry-csv.ts --apply
```

The importer upserts by generated `canonicalNormalized`. It preserves existing curated metadata unless the CSV provides an explicit value.

## Why No Bulk Ontology Import Yet

ICD, SNOMED, and other large ontology imports are intentionally out of scope. Wardle needs playable, clinically useful diagnosis rows with curated aliases and educational metadata, not a raw ontology dump that could create noisy answers, duplicate concepts, or unsafe gameplay mappings.
