import {
  ConflictException,
} from '@nestjs/common';
import {
  DiagnosisEducationCandidateApplicationStatus,
  DiagnosisEducationCandidateReviewDecision,
  DiagnosisEducationCandidateScope,
  DiagnosisEducationCandidateStatus,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  ValidationOutcome,
} from '@prisma/client';
import { DiagnosisEducationCandidateService } from './diagnosis-education-candidate.service';

describe('DiagnosisEducationCandidateService', () => {
  it('accepts a candidate without mutating Education', async () => {
    const candidate = buildCandidate();
    const { service, prisma, tx } = buildService({
      candidate,
    });

    await service.reviewCandidate({
      candidateId: 'candidate-1',
      decision: DiagnosisEducationCandidateReviewDecision.ACCEPT,
      rationale: 'Clinically coherent proposal.',
      reviewerUserId: 'senior-1',
    });

    expect(tx.diagnosisEducationCandidateReviewDecisionRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidateId: 'candidate-1',
          decision: DiagnosisEducationCandidateReviewDecision.ACCEPT,
          rationale: 'Clinically coherent proposal.',
          reviewerUserId: 'senior-1',
        }),
      }),
    );
    expect(tx.diagnosisEducation.create).not.toHaveBeenCalled();
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
    expect(prisma.diagnosisEducationCandidateApplicationCommand.findUnique).not.toHaveBeenCalled();
  });

  it('rejects Apply before acceptance and records the controlled-application conflict', async () => {
    const candidate = buildCandidate();
    const { service, tx } = buildService({ candidate });

    await expect(
      service.applyCandidate({
        candidateId: 'candidate-1',
        idempotencyKey: 'apply-candidate-1',
        rationale: 'Apply after review.',
        actorUserId: 'senior-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.diagnosisEducation.create).not.toHaveBeenCalled();
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
    expect(tx.diagnosisEducationRevision.create).not.toHaveBeenCalled();
    expect(tx.diagnosisEducationCandidateApplicationCommand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosisEducationCandidateApplicationStatus.CONFLICT,
        }),
      }),
    );
  });

  it('applies an accepted initial whole candidate once as NEEDS_REVIEW', async () => {
    const candidate = buildCandidate({
      reviewStatus: DiagnosisEducationCandidateStatus.ACCEPTED,
      scope: DiagnosisEducationCandidateScope.WHOLE,
      baseEducationVersion: null,
      educationId: null,
      proposedEducation: buildMaterial(),
    });
    const savedEducation = buildEducation({
      version: 1,
      editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
      publishedAt: null,
      reviewedAt: null,
      reviewedByUserId: null,
    });
    const finalCandidate = {
      ...candidate,
      reviewStatus: DiagnosisEducationCandidateStatus.APPLIED,
      applicationStatus: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
      resultingEducationId: 'education-1',
      resultingEducationVersion: 1,
      resultingRevisionId: 'revision-1',
    };
    const { service, tx, differentialMappingService, reasoningDraftValidationService } =
      buildService({
        candidate,
        finalCandidate,
        currentEducation: null,
        savedEducation,
      });

    const result = await service.applyCandidate({
      candidateId: 'candidate-1',
      idempotencyKey: 'apply-candidate-1',
      rationale: 'Accepted by editorial review.',
      authorityReferences: ['WEOS-CANON-004'],
      actorUserId: 'senior-1',
    });

    expect(tx.diagnosisEducation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
          title: 'Appendicitis',
          editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
          source: DiagnosisEducationSource.AI_ASSISTED,
          version: 1,
          reviewedAt: null,
          reviewedByUserId: null,
          publishedAt: null,
        }),
      }),
    );
    expect(tx.diagnosisEducationRevision.create).toHaveBeenCalledTimes(1);
    expect(tx.diagnosisEducationCandidate.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: DiagnosisEducationCandidateStatus.APPLIED,
          applicationStatus: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
          resultingEducationId: 'education-1',
          resultingEducationVersion: 1,
          resultingRevisionId: 'revision-1',
        }),
      }),
    );
    expect(differentialMappingService.mapEducation).toHaveBeenCalledWith('education-1');
    expect(reasoningDraftValidationService.runAfterGeneration).toHaveBeenCalledWith({
      artifactType: 'EDUCATION',
      artifactId: 'education-1',
    });
    expect(result).toEqual(finalCandidate);
  });

  it('applies an accepted section candidate by changing only the proposed section', async () => {
    const currentEducation = buildEducation({ version: 5 });
    const proposedManagement = [{ id: 'consult', title: 'Early consult' }];
    const candidate = buildCandidate({
      reviewStatus: DiagnosisEducationCandidateStatus.ACCEPTED,
      scope: DiagnosisEducationCandidateScope.SECTION,
      section: 'management',
      educationId: 'education-1',
      baseEducationVersion: 5,
      proposedSection: proposedManagement,
      proposedReferences: ['source'],
    });
    const savedEducation = buildEducation({
      version: 6,
      management: proposedManagement,
      editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
      publishedAt: null,
      reviewedAt: null,
      reviewedByUserId: null,
    });
    const { service, tx } = buildService({
      candidate,
      currentEducation,
      savedEducation,
      finalCandidate: {
        ...candidate,
        reviewStatus: DiagnosisEducationCandidateStatus.APPLIED,
        applicationStatus: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
        resultingEducationId: 'education-1',
        resultingEducationVersion: 6,
        resultingRevisionId: 'revision-1',
      },
    });

    await service.applyCandidate({
      candidateId: 'candidate-1',
      idempotencyKey: 'apply-candidate-1',
      rationale: 'Accepted section proposal.',
      actorUserId: 'senior-1',
    });

    expect(tx.diagnosisEducation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'education-1', version: 5 },
        data: expect.objectContaining({
          management: proposedManagement,
          references: ['source'],
          editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
          version: { increment: 1 },
          reviewedAt: null,
          reviewedByUserId: null,
          publishedAt: null,
        }),
      }),
    );
    expect(tx.diagnosisEducation.updateMany.mock.calls[0][0].data.examPearls).toBeUndefined();
    expect(tx.diagnosisEducationRevision.create).toHaveBeenCalledTimes(1);
  });

  it('fails stale-base application without creating a revision', async () => {
    const candidate = buildCandidate({
      reviewStatus: DiagnosisEducationCandidateStatus.ACCEPTED,
      educationId: 'education-1',
      baseEducationVersion: 5,
      proposedEducation: buildMaterial(),
    });
    const { service, tx } = buildService({
      candidate,
      currentEducation: buildEducation({ version: 6 }),
    });

    await expect(
      service.applyCandidate({
        candidateId: 'candidate-1',
        idempotencyKey: 'apply-candidate-1',
        rationale: 'Apply accepted candidate.',
        actorUserId: 'senior-1',
      }),
    ).rejects.toThrow('Education candidate base version is stale');

    expect(tx.diagnosisEducation.create).not.toHaveBeenCalled();
    expect(tx.diagnosisEducation.updateMany).not.toHaveBeenCalled();
    expect(tx.diagnosisEducationRevision.create).not.toHaveBeenCalled();
    expect(tx.diagnosisEducationCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationStatus: DiagnosisEducationCandidateApplicationStatus.CONFLICT,
        }),
      }),
    );
  });

  it('returns the existing application result for a repeated idempotent Apply', async () => {
    const appliedCandidate = buildCandidate({
      reviewStatus: DiagnosisEducationCandidateStatus.APPLIED,
      applicationStatus: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
      resultingEducationId: 'education-1',
      resultingEducationVersion: 2,
      resultingRevisionId: 'revision-2',
    });
    const { service, prisma } = buildService({
      candidate: appliedCandidate,
      existingCommand: {
        candidateId: 'candidate-1',
        status: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
      },
    });

    const result = await service.applyCandidate({
      candidateId: 'candidate-1',
      idempotencyKey: 'apply-candidate-1',
      rationale: 'Retry same command.',
      actorUserId: 'senior-1',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual(appliedCandidate);
  });

  it('replays an existing successful Apply after an idempotency-key race', async () => {
    const appliedCandidate = buildCandidate({
      reviewStatus: DiagnosisEducationCandidateStatus.APPLIED,
      applicationStatus: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
      resultingEducationId: 'education-1',
      resultingEducationVersion: 2,
      resultingRevisionId: 'revision-2',
    });
    const { service, prisma } = buildService({
      candidate: appliedCandidate,
      existingCommand: null,
    });
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    prisma.diagnosisEducationCandidateApplicationCommand.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        candidateId: 'candidate-1',
        status: DiagnosisEducationCandidateApplicationStatus.SUCCESS,
      });

    const result = await service.applyCandidate({
      candidateId: 'candidate-1',
      idempotencyKey: 'apply-candidate-1',
      rationale: 'Retry after race.',
      actorUserId: 'senior-1',
    });

    expect(result).toEqual(appliedCandidate);
  });
});

function buildService(input: {
  candidate: Record<string, unknown>;
  finalCandidate?: Record<string, unknown>;
  currentEducation?: Record<string, unknown> | null;
  savedEducation?: Record<string, unknown>;
  existingCommand?: Record<string, unknown> | null;
}) {
  const finalCandidate = input.finalCandidate ?? input.candidate;
  const savedEducation = input.savedEducation ?? buildEducation();
  const tx = {
    diagnosisEducationCandidateReviewDecisionRecord: {
      create: jest.fn().mockResolvedValue({ id: 'decision-1' }),
    },
    diagnosisEducationCandidateApplicationCommand: {
      create: jest.fn().mockResolvedValue({ id: 'command-1' }),
      update: jest.fn().mockResolvedValue({ id: 'command-1' }),
    },
    diagnosisEducationCandidate: {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(finalCandidate),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(input.candidate),
      findUniqueOrThrow: jest.fn().mockResolvedValue(finalCandidate),
    },
    diagnosisEducation: {
      create: jest.fn().mockResolvedValue(savedEducation),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest
        .fn()
        .mockResolvedValueOnce(input.currentEducation ?? null)
        .mockResolvedValue(savedEducation),
      findUniqueOrThrow: jest.fn().mockResolvedValue(savedEducation),
    },
    diagnosisEducationRevision: {
      findUnique: jest.fn().mockResolvedValue({ id: 'base-revision-1' }),
      create: jest.fn().mockResolvedValue({ id: 'revision-1' }),
    },
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue({
        displayLabel: 'Appendicitis',
        canonicalName: 'appendicitis',
      }),
    },
  };
  const prisma = {
    diagnosisEducationCandidate: {
      findUnique: jest.fn().mockResolvedValue(finalCandidate),
      findMany: jest.fn(),
    },
    diagnosisEducationCandidateApplicationCommand: {
      findUnique: jest.fn().mockResolvedValue(input.existingCommand ?? null),
    },
    diagnosisEducationRevision: {
      findUnique: jest.fn().mockResolvedValue({ id: 'base-revision-1' }),
    },
    $transaction: jest.fn(
      async (handler: (transaction: typeof tx) => Promise<unknown>) =>
        handler(tx),
    ),
  };
  const differentialMappingService = {
    mapEducation: jest.fn().mockResolvedValue(undefined),
  };
  const reasoningDraftValidationService = {
    runAfterGeneration: jest.fn().mockResolvedValue(undefined),
  };
  const service = new DiagnosisEducationCandidateService(
    prisma as never,
    differentialMappingService as never,
    reasoningDraftValidationService as never,
  );

  return { service, prisma, tx, differentialMappingService, reasoningDraftValidationService };
}

function buildCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'candidate-1',
    diagnosisRegistryId: 'registry-1',
    educationId: null,
    scope: DiagnosisEducationCandidateScope.WHOLE,
    section: null,
    baseEducationVersion: null,
    baseEducationRevisionId: null,
    originalSection: null,
    proposedEducation: buildMaterial(),
    proposedSection: null,
    proposedReferences: null,
    generationProvider: 'openai',
    generationModel: 'gpt-4o-mini',
    generatorVersion: 'EDUCATION_GENERATOR_V1',
    promptVersion: 'EDUCATION_GENERATOR_V1',
    generatedAt: new Date('2026-05-01T00:00:00.000Z'),
    generationPurpose: 'AI_DIAGNOSIS_EDUCATION_WHOLE_GENERATION',
    inputContext: {},
    contextHash: 'hash',
    sourceArtifactIds: {},
    validationStatus: ValidationOutcome.PASSED,
    validationSummary: {},
    validationBlockers: [],
    validationWarnings: [],
    validationMetadata: {},
    reviewStatus: DiagnosisEducationCandidateStatus.PENDING_REVIEW,
    latestReviewDecisionId: null,
    acceptedAt: null,
    acceptedByUserId: null,
    supersededByCandidateId: null,
    applicationStatus: DiagnosisEducationCandidateApplicationStatus.NOT_REQUESTED,
    appliedAt: null,
    appliedByUserId: null,
    resultingEducationId: null,
    resultingEducationVersion: null,
    resultingRevisionId: null,
    applicationFailureReason: null,
    createdByUserId: 'admin-1',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildEducation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'education-1',
    diagnosisRegistryId: 'registry-1',
    title: 'Appendicitis',
    ...buildMaterial(),
    editorialStatus: DiagnosisEducationStatus.PUBLISHED,
    source: DiagnosisEducationSource.MANUAL,
    version: 5,
    generatedAt: null,
    reviewedAt: new Date('2026-05-01T00:00:00.000Z'),
    reviewedByUserId: 'senior-1',
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildMaterial() {
  return {
    summary: {
      definition: 'Inflammation of the appendix.',
      highYieldTakeaway: 'Migratory right lower quadrant pain is high-yield.',
    },
    clinicalPattern: [],
    keySymptoms: [],
    keySigns: [],
    examPearls: [],
    scoringSystems: [],
    investigations: [],
    differentials: [],
    management: [],
    complications: [],
    pitfalls: [],
    recallPrompts: [],
    references: [],
  };
}
