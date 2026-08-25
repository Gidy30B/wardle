# WEOS SCAFFOLD-BOOT-001 Diagnosis Scaffold Bootstrap

Status: Implemented runtime slice
Date: 2026-08-25
Starting HEAD: `29f90830b8501b32e74ea632ed46a9d361c085af`

## Runtime Invariant

Diagnosis-specific educational generation now follows a scaffold readiness
ladder:

1. diagnosis metadata readiness;
2. Editorial Brief bootstrap readiness;
3. approved or active Editorial Brief;
4. generated Teaching Rule candidate review;
5. approved scaffold Teaching Rules;
6. Education candidate generation readiness;
7. Clinical Case generation readiness.

`DiagnosisRegistry.isGeneratable` remains necessary for generator selection,
but it is no longer sufficient by itself for Education or Case generation.

## Backend Gates

`DiagnosisRegistryLifecyclePolicyService` owns scaffold readiness projection
and hard assertions for:

- Editorial Brief bootstrap;
- Teaching Rule candidate generation;
- Diagnosis Education generation;
- Clinical Case generation.

Education generation and section-independent Clinical Case generation call the
policy before invoking provider-backed generation. Planner-selected and
explicit Case targets are additionally filtered through scaffold case-generation
readiness so an empty registry cannot bypass the ladder through
`isGeneratable`.

## Scaffold Sources

Teaching Rule candidate generation now requires an approved or active
Editorial Brief and derives generated candidates from that educational intent.
Unconstrained reasoning recommendations are no longer converted into Teaching
Rule candidates by themselves.

Editorial Brief bootstrap remains candidate/review oriented through the
existing `DiagnosisEditorialBrief` lifecycle. This package did not add a new
external AI bootstrap call; provider egress for a new brief-generation path was
not introduced. Bootstrap payloads are validated to reject generic-only output
and may be enriched from existing local/static education knowledge where
available.

## Workspace

The diagnosis workspace read model exposes scaffold readiness and uses it for
readiness rows, recommended actions and action availability. Generate buttons
for Teaching Rules, Education and targeted Cases surface backend readiness
messages rather than implying generation is available from empty context.

Legacy Education panel generation uses workspace projection readiness when
available. Backend gates remain authoritative for callers that bypass the
dashboard.

## Out Of Scope

No schema migration, historical backfill, new generic governance record model,
learner API redesign, Education approval/publication redesign, graph authority
redesign or Case lifecycle redesign was included.
