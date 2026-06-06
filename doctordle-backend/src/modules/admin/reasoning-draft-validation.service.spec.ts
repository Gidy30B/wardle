import {
  ReasoningDraftArtifactType,
  ReasoningDraftTrustTier,
  ReasoningDraftValidationStatus,
} from '@prisma/client';
import { ReasoningDraftValidationService } from './reasoning-draft-validation.service';

function buildPrisma(overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'validation-1',
    artifactType: ReasoningDraftArtifactType.TEACHING_RULE,
    artifactId: 'rule-1',
    diagnosisRegistryId: 'registry-1',
    reasoningPathId: 'path-1',
    trustScore: 90,
    trustTier: ReasoningDraftTrustTier.HIGH_TRUST,
    validationStatus: ReasoningDraftValidationStatus.PASSED,
    blockers: [],
    warnings: [],
    strengths: [],
    hallucinationRiskSignals: [],
    reasoningCoverage: {},
    evidenceCoverage: {},
    discriminatorCoverage: {},
    unsupportedClaimSignals: [],
    recommendations: [],
    validatorVersion: 'reasoning-draft:v1',
    createdAt: new Date('2026-06-06T00:00:00.000Z'),
  };
  return {
    diagnosisTeachingRule: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'rule-1',
        diagnosisRegistryId: 'registry-1',
        title: 'Wheeze distinguishes asthma rather than COPD',
        rationale: 'Episodic wheeze supports asthma and separates it from chronic COPD.',
        acceptableManifestations: ['episodic wheeze'],
        requiredDifferentials: ['copd'],
        expectedEvidence: {},
        difficultyHints: {
          generatedBecause: {
            constrained: true,
            reasoningPathId: 'path-1',
            reasoningGoal: 'DIFFERENTIAL_DISCRIMINATION',
            requiredTeachingPoints: ['episodic wheeze'],
            discriminatorEvidenceUsed: ['wheeze'],
            sourceEvidenceRelationshipIds: ['evidence-1'],
            coverageGapsAddressed: ['missing_discriminator_evidence'],
            contradictoryDiagnosisIds: ['copd'],
          },
        },
      }),
    },
    case: { findUnique: jest.fn() },
    diagnosisEducation: { findUnique: jest.fn() },
    diagnosisEvidenceRelationship: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'evidence-1',
          evidenceNode: {
            displayLabel: 'wheeze',
            evidenceType: 'SYMPTOM',
          },
        },
      ]),
    },
    reasoningDraftValidationRun: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...row,
          ...data,
          createdAt: row.createdAt,
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('ReasoningDraftValidationService', () => {
  it('persists a high-trust constrained teaching rule validation', async () => {
    const prisma = buildPrisma();
    const service = new ReasoningDraftValidationService(prisma as never);

    const result = await service.runForArtifact({
      artifactType: 'TEACHING_RULE',
      artifactId: 'rule-1',
    });

    expect(result.trustTier).toBe(ReasoningDraftTrustTier.HIGH_TRUST);
    expect(result.validationStatus).toBe(ReasoningDraftValidationStatus.PASSED);
    expect(prisma.reasoningDraftValidationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifactType: ReasoningDraftArtifactType.TEACHING_RULE,
          artifactId: 'rule-1',
          reasoningPathId: 'path-1',
        }),
      }),
    );
  });

  it('downgrades unconstrained drafts', async () => {
    const prisma = buildPrisma({
      diagnosisTeachingRule: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rule-1',
          diagnosisRegistryId: 'registry-1',
          title: 'Asthma teaching rule',
          rationale: 'Wheeze may support asthma.',
          difficultyHints: {
            generatedBecause: { constrained: false },
          },
        }),
      },
    });
    const service = new ReasoningDraftValidationService(prisma as never);

    const result = await service.runForArtifact({
      artifactType: 'TEACHING_RULE',
      artifactId: 'rule-1',
    });

    expect(result.trustTier).toBe(ReasoningDraftTrustTier.LOW_TRUST);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unconstrained_draft' }),
      ]),
    );
  });

  it('blocks constrained drafts that miss required discriminator evidence', async () => {
    const prisma = buildPrisma({
      diagnosisTeachingRule: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rule-1',
          diagnosisRegistryId: 'registry-1',
          title: 'Generic asthma rule',
          rationale: 'This is an important finding.',
          difficultyHints: {
            generatedBecause: {
              constrained: true,
              reasoningPathId: 'path-1',
              requiredTeachingPoints: ['episodic wheeze'],
              discriminatorEvidenceUsed: ['wheeze'],
              sourceEvidenceRelationshipIds: ['evidence-1'],
            },
          },
        }),
      },
    });
    const service = new ReasoningDraftValidationService(prisma as never);

    const result = await service.runForArtifact({
      artifactType: 'TEACHING_RULE',
      artifactId: 'rule-1',
    });

    expect(result.trustTier).toBe(ReasoningDraftTrustTier.BLOCKED);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_discriminator_evidence' }),
      ]),
    );
  });

  it('flags unsupported absolute and guideline language for review', async () => {
    const prisma = buildPrisma({
      diagnosisTeachingRule: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rule-1',
          diagnosisRegistryId: 'registry-1',
          title: 'Wheeze is pathognomonic and always diagnostic of asthma',
          rationale: 'Guideline recommended first-line treatment must be started.',
          difficultyHints: {
            generatedBecause: {
              constrained: true,
              reasoningPathId: 'path-1',
              requiredTeachingPoints: ['wheeze'],
              discriminatorEvidenceUsed: ['wheeze'],
              sourceEvidenceRelationshipIds: ['evidence-1'],
            },
          },
        }),
      },
    });
    const service = new ReasoningDraftValidationService(prisma as never);

    const result = await service.runForArtifact({
      artifactType: 'TEACHING_RULE',
      artifactId: 'rule-1',
    });

    expect(result.hallucinationRiskSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'absolute_language' }),
      ]),
    );
    expect(result.unsupportedClaimSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported_guideline_claim' }),
      ]),
    );
  });
});
