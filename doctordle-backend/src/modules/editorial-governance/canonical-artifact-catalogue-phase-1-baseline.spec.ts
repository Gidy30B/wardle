import {
  WEOS_CANONICAL_ARTIFACT_CATALOGUE,
  type WeosArtifactType,
} from './canonical-artifact-catalogue';
import {
  PHASE_1_PROTECTED_ARTIFACT_CATALOGUE,
  PHASE_1_PROTECTED_CATALOGUE_FIELDS,
} from './phase-1-protected-catalogue.fixture';

const ASSESSMENT_NOT_APPROVAL_EXCEPTION =
  'Phase 2 drift correction: assessment records do not themselves require approval or constitute decisions.';

const APPROVED_PHASE_1_EXCEPTIONS: Partial<
  Record<
    WeosArtifactType,
    Partial<Record<(typeof PHASE_1_PROTECTED_CATALOGUE_FIELDS)[number], string>>
  >
> = {
  CLUE_DISCRIMINATOR_ANNOTATION: {
    approvalRequirement: ASSESSMENT_NOT_APPROVAL_EXCEPTION,
    decisionRequirement: ASSESSMENT_NOT_APPROVAL_EXCEPTION,
  },
  DIFFERENTIAL_MAPPING: {
    approvalRequirement: ASSESSMENT_NOT_APPROVAL_EXCEPTION,
    decisionRequirement: ASSESSMENT_NOT_APPROVAL_EXCEPTION,
  },
  SUPERSESSION_REVIEW: {
    approvalRequirement: ASSESSMENT_NOT_APPROVAL_EXCEPTION,
    decisionRequirement: ASSESSMENT_NOT_APPROVAL_EXCEPTION,
  },
};

describe('WEOS Phase 1 artifact catalogue baseline protection', () => {
  it('preserves accepted Phase 1 semantic catalogue fields', () => {
    for (const [artifactType, baselineEntry] of Object.entries(
      PHASE_1_PROTECTED_ARTIFACT_CATALOGUE,
    )) {
      const currentEntry =
        WEOS_CANONICAL_ARTIFACT_CATALOGUE[artifactType as WeosArtifactType];

      expect(currentEntry).toBeDefined();

      for (const field of PHASE_1_PROTECTED_CATALOGUE_FIELDS) {
        const exception =
          APPROVED_PHASE_1_EXCEPTIONS[artifactType as WeosArtifactType]?.[
            field
          ];

        if (exception !== undefined) {
          expect(exception.trim().length).toBeGreaterThan(0);
          continue;
        }

        expect(currentEntry[field]).toEqual(baselineEntry[field]);
      }
    }
  });

  it('does not claim no first-class model exists for implemented artifacts', () => {
    for (const entry of Object.values(WEOS_CANONICAL_ARTIFACT_CATALOGUE)) {
      const hasImplementationEvidence =
        entry.currentImplementationModel !== null ||
        entry.currentPrismaModels.length > 0 ||
        entry.currentImplementationSymbols.length > 0;

      if (!hasImplementationEvidence) continue;

      expect(entry.knownDivergences.join(' ')).not.toMatch(
        /No first-class model identified/i,
      );
    }
  });
});
