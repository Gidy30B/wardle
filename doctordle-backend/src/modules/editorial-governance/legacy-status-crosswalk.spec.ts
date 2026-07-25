import {
  AiDraftReviewStatus,
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipStatus,
  DifferentialResolutionStatus,
  EvidenceNodeStatus,
  ReasoningDraftValidationStatus,
  ReasoningPathStatus,
  ReviewDecision,
  ValidationOutcome,
} from '@prisma/client';

import { WEOS_ARTIFACT_TYPES } from './canonical-artifact-catalogue';
import {
  WEOS_VALIDATION_OUTCOMES,
  WEOS_VERIFICATION_CONFIDENCE,
} from './canonical-concepts';
import {
  legacyCrosswalkLifecycleStateExists,
  WEOS_LEGACY_STATUS_CROSSWALK,
  WEOS_LEGACY_STATUS_CROSSWALK_BY_SOURCE,
} from './legacy-status-crosswalk';

const exhaustiveEnums = {
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisRegistryStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryCandidateStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphFactStatus,
  DiagnosisTeachingRelationshipStatus,
  EvidenceNodeStatus,
  DiagnosisEvidenceRelationshipStatus,
  ReasoningPathStatus,
  ReasoningDraftValidationStatus,
  AiDraftReviewStatus,
  DifferentialResolutionStatus,
  ReviewDecision,
  ValidationOutcome,
} as const;

function entriesFor(sourceEnumOrField: string, sourceValue: string) {
  return WEOS_LEGACY_STATUS_CROSSWALK_BY_SOURCE[
    `${sourceEnumOrField}.${sourceValue}`
  ];
}

const conceptsFor = (sourceEnumOrField: string, sourceValue: string) =>
  entriesFor(sourceEnumOrField, sourceValue)?.flatMap(
    (entry) => entry.canonicalInterpretations,
  ) ?? [];

describe('WEOS legacy status crosswalk', () => {
  it('covers every exhaustive Prisma enum value with one or more entries', () => {
    for (const [sourceEnumOrField, enumObject] of Object.entries(
      exhaustiveEnums,
    )) {
      for (const value of Object.values(enumObject)) {
        expect(
          entriesFor(sourceEnumOrField, value)?.length ?? 0,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('does not contain duplicate exact crosswalk entries', () => {
    const keys = WEOS_LEGACY_STATUS_CROSSWALK.map((entry) =>
      [
        entry.sourcePath,
        entry.sourceEnumOrField,
        entry.sourceValue,
        entry.sourceArtifactType,
        entry.legacyDimension,
        entry.canonicalInterpretations
          .map(
            (item) =>
              `${item.canonicalConcept}:${item.targetArtifactType ?? ''}:${
                item.lifecycleFamily ?? ''
              }:${item.lifecycleState ?? ''}`,
          )
          .join(','),
      ].join('|'),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('references registered source and target artifact types and confidence values', () => {
    const artifactTypes = Object.values(WEOS_ARTIFACT_TYPES);
    const confidenceValues = Object.values(WEOS_VERIFICATION_CONFIDENCE);

    for (const entry of WEOS_LEGACY_STATUS_CROSSWALK) {
      expect(artifactTypes).toContain(entry.sourceArtifactType);
      expect(confidenceValues).toContain(entry.verificationConfidence);
      expect(typeof entry.semanticMappingSafe).toBe('boolean');
      expect(typeof entry.recordMigrationSafe).toBe('boolean');
      for (const interpretation of entry.canonicalInterpretations) {
        if (interpretation.targetArtifactType !== undefined) {
          expect(artifactTypes).toContain(interpretation.targetArtifactType);
        }
      }
    }
  });

  it('distinguishes semantic mapping safety from record migration safety', () => {
    const semanticSafe = WEOS_LEGACY_STATUS_CROSSWALK.filter(
      (entry) => entry.semanticMappingSafe,
    );
    const recordSafe = WEOS_LEGACY_STATUS_CROSSWALK.filter(
      (entry) => entry.recordMigrationSafe,
    );

    expect(semanticSafe.length).toBeGreaterThan(0);
    expect(recordSafe).toHaveLength(0);
    expect(
      entriesFor('DiagnosisRegistryStatus', DiagnosisRegistryStatus.DRAFT)?.[0]
        .semanticMappingSafe,
    ).toBe(true);
    expect(
      entriesFor('DiagnosisRegistryStatus', DiagnosisRegistryStatus.DRAFT)?.[0]
        .recordMigrationSafe,
    ).toBe(false);
  });

  it('requires record-unsafe entries to explain ambiguity or treatment', () => {
    const unsafe = WEOS_LEGACY_STATUS_CROSSWALK.filter(
      (entry) => !entry.recordMigrationSafe,
    );

    expect(unsafe.length).toBeGreaterThan(0);
    for (const entry of unsafe) {
      expect(
        [entry.ambiguity, entry.compatibilityProjectionTreatment]
          .filter(Boolean)
          .join(' '),
      ).not.toHaveLength(0);
      expect(entry.requiredLiveDataQueries.length).toBeGreaterThan(0);
      expect(entry.recommendedMigrationTreatment).toMatch(/LEGACY|UNKNOWN/i);
    }
  });

  it('marks editorial string-status vocabularies non-exhaustive', () => {
    for (const sourceEnumOrField of [
      'DiagnosisEditorialBrief.status',
      'DiagnosisTeachingRule.status',
      'CaseClueRevisionDraft.status',
    ]) {
      const entries = WEOS_LEGACY_STATUS_CROSSWALK.filter(
        (entry) => entry.sourceEnumOrField === sourceEnumOrField,
      );

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((entry) => !entry.exhaustiveSourceVocabulary)).toBe(
        true,
      );
      expect(entries.every((entry) => !entry.recordMigrationSafe)).toBe(true);
    }
  });

  it('supports multiple canonical interpretations for combined legacy projections', () => {
    expect(
      entriesFor('CaseEditorialStatus', CaseEditorialStatus.VALIDATING)?.[0]
        .canonicalInterpretations.length,
    ).toBeGreaterThan(1);
  });

  it('protects ambiguous CaseEditorialStatus projections', () => {
    expect(
      conceptsFor('CaseEditorialStatus', CaseEditorialStatus.VALIDATED).some(
        (item) => item.canonicalConcept === 'DECISION_PROJECTION',
      ),
    ).toBe(false);
    expect(
      conceptsFor(
        'CaseEditorialStatus',
        CaseEditorialStatus.READY_TO_PUBLISH,
      ).some((item) => item.lifecycleFamily === 'case-revision'),
    ).toBe(false);
    expect(
      conceptsFor(
        'CaseEditorialStatus',
        CaseEditorialStatus.READY_TO_PUBLISH,
      ).some(
        (item) =>
          item.targetArtifactType === WEOS_ARTIFACT_TYPES.PUBLICATION_DECISION,
      ),
    ).toBe(false);
    expect(
      conceptsFor('CaseEditorialStatus', CaseEditorialStatus.PUBLISHED).some(
        (item) => item.canonicalConcept === 'LIFECYCLE_STATE',
      ),
    ).toBe(false);
    expect(
      conceptsFor('CaseEditorialStatus', CaseEditorialStatus.PUBLISHED).some(
        (item) =>
          item.targetArtifactType ===
          WEOS_ARTIFACT_TYPES.LEARNER_EXPOSURE_REFERENCE,
      ),
    ).toBe(false);
  });

  it('uses lifecycle dimensions for registry statuses', () => {
    for (const value of Object.values(DiagnosisRegistryStatus)) {
      expect(
        entriesFor('DiagnosisRegistryStatus', value)?.[0].legacyDimension,
      ).toBe('IDENTITY_LIFECYCLE');
    }
  });

  it('keeps validation outcome distinct from validation standing', () => {
    const failed = conceptsFor('ValidationOutcome', ValidationOutcome.FAILED);
    const error = conceptsFor('ValidationOutcome', ValidationOutcome.ERROR);
    const reasoningFailed = conceptsFor(
      'ReasoningDraftValidationStatus',
      ReasoningDraftValidationStatus.FAILED,
    );

    expect(failed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          validationOutcome: WEOS_VALIDATION_OUTCOMES.FAILED,
          validationStanding: 'CURRENT',
        }),
      ]),
    );
    expect(reasoningFailed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          validationOutcome: WEOS_VALIDATION_OUTCOMES.FAILED,
          validationStanding: 'CURRENT',
        }),
      ]),
    );
    expect(error).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          validationOutcome: WEOS_VALIDATION_OUTCOMES.ERROR,
          validationStanding: 'CURRENT',
        }),
      ]),
    );
    expect(
      WEOS_LEGACY_STATUS_CROSSWALK.flatMap((entry) =>
        entry.canonicalInterpretations.map(
          (interpretation) => interpretation.validationStanding,
        ),
      ),
    ).not.toContain('ERROR');
  });

  it('protects string-status interpretations reviewed as unsafe', () => {
    expect(
      conceptsFor('DiagnosisTeachingRule.status', 'APPROVED').some(
        (item) => item.lifecycleState === 'ACTIVE',
      ),
    ).toBe(false);
    expect(
      conceptsFor('DiagnosisEditorialBrief.status', 'ACTIVE').some(
        (item) => item.lifecycleState === 'APPROVED',
      ),
    ).toBe(false);
    expect(
      conceptsFor(
        'CaseClueRevisionDraft.status',
        'BLOCKED_CASE_NOT_EDITABLE',
      ).some((item) => item.canonicalConcept === 'LIFECYCLE_STATE'),
    ).toBe(false);
  });

  it('protects education, onboarding, AI, and validation distinctions', () => {
    expect(
      conceptsFor(
        'DiagnosisEducationStatus',
        DiagnosisEducationStatus.GENERATED,
      ).some((item) => item.canonicalConcept === 'DECISION_PROJECTION'),
    ).toBe(false);
    expect(
      conceptsFor(
        'DiagnosisEducationStatus',
        DiagnosisEducationStatus.APPROVED,
      ).some((item) => item.canonicalConcept === 'PUBLICATION_PROJECTION'),
    ).toBe(false);
    expect(
      entriesFor(
        'DiagnosisEditorialOnboardingStatus',
        DiagnosisEditorialOnboardingStatus.COMPLETE,
      )?.some((entry) => entry.legacyDimension === 'READINESS'),
    ).toBe(false);
    expect(
      conceptsFor('AiDraftReviewStatus', AiDraftReviewStatus.ACCEPTED).some(
        (item) =>
          item.targetArtifactType ===
          WEOS_ARTIFACT_TYPES.CONTROLLED_APPLICATION_RECORD,
      ),
    ).toBe(false);
  });

  it('does not reference nonexistent lifecycle states', () => {
    for (const entry of WEOS_LEGACY_STATUS_CROSSWALK) {
      expect(legacyCrosswalkLifecycleStateExists(entry)).toBe(true);
    }
  });

  it('does not mark compatibility projections as future independent authorities', () => {
    for (const entry of WEOS_LEGACY_STATUS_CROSSWALK) {
      expect(entry.compatibilityProjectionTreatment).not.toMatch(
        /independent authority/i,
      );
    }
  });
});
