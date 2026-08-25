import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  DiagnosisEducationPublicationStanding,
  DiagnosisEducationRevisionApprovalOutcome,
  DiagnosisEducationRevisionApprovalStanding,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
} from '@prisma/client';
import { DiagnosisEducationGovernanceService } from './diagnosis-education-governance.service';
import { stableStringify } from '../editorial-governance/governed-command/index';

describe('DiagnosisEducationGovernanceService', () => {
  it('approves an exact Education revision without publishing it', async () => {
    const { service, tx } = buildService();

    const decision = await service.decideRevision({
      educationId: 'education-1',
      revisionId: 'revision-1',
      expectedVersion: 3,
      outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
      idempotencyKey: 'approve-revision-1',
      rationale: 'Clinical and educational review passed.',
      actorUserId: 'senior-1',
    });

    expect(decision.outcome).toBe(DiagnosisEducationRevisionApprovalOutcome.APPROVED);
    expect(tx.diagnosisEducationRevisionApprovalDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          educationId: 'education-1',
          educationRevisionId: 'revision-1',
          version: 3,
          outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
          standing: DiagnosisEducationRevisionApprovalStanding.STANDING,
          authorityRationale: 'Clinical and educational review passed.',
        }),
      }),
    );
    expect(tx.diagnosisEducation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editorialStatus: DiagnosisEducationStatus.APPROVED,
          publishedAt: null,
        }),
      }),
    );
  });

  it('blocks publication before a standing exact-revision approval exists', async () => {
    const { service, prisma } = buildService({
      standingApproval: null,
    });

    await expect(
      service.authorizePublication({
        educationId: 'education-1',
        revisionId: 'revision-1',
        expectedVersion: 3,
        expectedApprovalDecisionId: 'approval-1',
        idempotencyKey: 'publish-revision-1',
        rationale: 'Publish approved learner education.',
        actorUserId: 'publisher-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.diagnosisEducationPublicationDecision.create).not.toHaveBeenCalled();
  });

  it('authorizes publication for the exact approved revision and supersedes old standing publication', async () => {
    const graphExtraction = {
      extractFromPublishedEducationRevision: jest.fn().mockResolvedValue({}),
    };
    const { service, tx } = buildService({
      graphExtraction,
      activePublication: {
        id: 'old-publication-1',
        educationRevisionId: 'old-revision',
      },
    });

    const decision = await service.authorizePublication({
      educationId: 'education-1',
      revisionId: 'revision-1',
      expectedVersion: 3,
      expectedApprovalDecisionId: 'approval-1',
      expectedActivePublicationDecisionId: 'old-publication-1',
      idempotencyKey: 'publish-revision-1',
      rationale: 'Publication authority granted.',
      actorUserId: 'publisher-1',
    });

    expect(decision.id).toBe('publication-1');
    expect(tx.diagnosisEducationPublicationDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'old-publication-1' },
        data: expect.objectContaining({
          standing: DiagnosisEducationPublicationStanding.SUPERSEDED,
        }),
      }),
    );
    expect(tx.diagnosisEducationPublicationDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalDecisionId: 'approval-1',
          educationRevisionId: 'revision-1',
          standing: DiagnosisEducationPublicationStanding.AUTHORIZED,
        }),
      }),
    );
    expect(graphExtraction.extractFromPublishedEducationRevision).toHaveBeenCalledWith(
      'revision-1',
    );
  });

  it('fails stale publication when current Education version changed', async () => {
    const { service } = buildService({
      education: buildEducation({ version: 4 }),
    });

    await expect(
      service.authorizePublication({
        educationId: 'education-1',
        revisionId: 'revision-1',
        expectedVersion: 3,
        expectedApprovalDecisionId: 'approval-1',
        idempotencyKey: 'publish-stale',
        rationale: 'Publish approved learner education.',
        actorUserId: 'publisher-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays identical approval idempotently without creating another decision', async () => {
    const existingDecision = {
      id: 'approval-existing',
      commandFingerprint: fingerprint({
        action: 'educationRevision.approve',
        educationId: 'education-1',
        revisionId: 'revision-1',
        expectedVersion: 3,
        outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
        actorUserId: 'senior-1',
      }),
      outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
    };
    const { service, tx } = buildService({ existingApprovalCommand: existingDecision });

    const first = await service.decideRevision({
      educationId: 'education-1',
      revisionId: 'revision-1',
      expectedVersion: 3,
      outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
      idempotencyKey: 'approve-revision-1',
      rationale: 'Clinical and educational review passed.',
      actorUserId: 'senior-1',
    });

    expect(first).toBe(existingDecision);
    expect(tx.diagnosisEducationRevisionApprovalDecision.create).not.toHaveBeenCalled();
  });

  it('withdraws a standing publication without erasing the decision record', async () => {
    const { service, tx } = buildService();

    const result = await service.withdrawPublication({
      publicationDecisionId: 'publication-1',
      rationale: 'Evidence is stale.',
      actorUserId: 'publisher-1',
    });

    expect(result.standing).toBe(DiagnosisEducationPublicationStanding.WITHDRAWN);
    expect(tx.diagnosisEducationPublicationDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          standing: DiagnosisEducationPublicationStanding.WITHDRAWN,
          withdrawalRationale: 'Evidence is stale.',
        }),
      }),
    );
    expect(tx.diagnosisEducation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editorialStatus: DiagnosisEducationStatus.APPROVED,
          publishedAt: null,
        }),
      }),
    );
  });
});

function buildService(overrides: {
  education?: ReturnType<typeof buildEducation>;
  revision?: ReturnType<typeof buildRevision>;
  standingApproval?: Record<string, unknown> | null;
  activePublication?: Record<string, unknown> | null;
  existingApprovalCommand?: Record<string, unknown> | null;
  graphExtraction?: { extractFromPublishedEducationRevision: jest.Mock };
} = {}) {
  const education = overrides.education ?? buildEducation();
  const revision = overrides.revision ?? buildRevision({ education });
  const standingApproval =
    overrides.standingApproval === undefined
      ? {
          id: 'approval-1',
          materialContextHash: fingerprint(revision.snapshot),
        }
      : overrides.standingApproval;
  const activePublication =
    overrides.activePublication === undefined ? null : overrides.activePublication;
  const tx = {
    diagnosisEducation: {
      findUnique: jest.fn().mockResolvedValue(education),
      update: jest.fn().mockResolvedValue(education),
    },
    diagnosisEducationRevision: {
      findFirst: jest.fn().mockResolvedValue(revision),
      findUnique: jest.fn().mockResolvedValue(revision),
      create: jest.fn().mockResolvedValue(revision),
      update: jest.fn().mockResolvedValue(revision),
    },
    diagnosisEducationRevisionApprovalDecision: {
      findUnique: jest.fn().mockResolvedValue(overrides.existingApprovalCommand ?? null),
      findFirst: jest.fn().mockResolvedValue(standingApproval),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'approval-1',
          ...data,
        }),
      ),
      update: jest.fn(),
    },
    diagnosisEducationPublicationDecision: {
      findUnique: jest.fn().mockImplementation(({ where }) =>
        where?.commandIdempotencyKey
          ? Promise.resolve(null)
          : Promise.resolve({
              id: 'publication-1',
              educationId: 'education-1',
              standing: DiagnosisEducationPublicationStanding.AUTHORIZED,
            }),
      ),
      findFirst: jest.fn().mockResolvedValue(activePublication),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'publication-1',
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'publication-1',
          educationId: 'education-1',
          ...data,
        }),
      ),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const graphExtraction = overrides.graphExtraction ?? {
    extractFromPublishedEducationRevision: jest.fn().mockResolvedValue({}),
  };
  return {
    service: new DiagnosisEducationGovernanceService(
      prisma as never,
      graphExtraction as never,
    ),
    prisma,
    tx,
  };
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function buildEducation(overrides: Partial<ReturnType<typeof buildEducation>> = {}) {
  return {
    id: 'education-1',
    diagnosisRegistryId: 'registry-1',
    title: 'Test education',
    summary: { definition: 'A focused summary.' },
    clinicalPattern: [],
    keySymptoms: [],
    keySigns: [],
    examPearls: [],
    scoringSystems: null,
    investigations: [],
    differentials: [],
    management: [],
    complications: [],
    pitfalls: [],
    recallPrompts: [],
    references: ['Source'],
    editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    source: DiagnosisEducationSource.AI_ASSISTED,
    version: 3,
    generatedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    publishedAt: null,
    createdAt: new Date('2026-08-24T00:00:00Z'),
    updatedAt: new Date('2026-08-24T00:00:00Z'),
    ...overrides,
  };
}

function buildRevision(input: {
  education: ReturnType<typeof buildEducation>;
}) {
  return {
    id: 'revision-1',
    educationId: input.education.id,
    version: input.education.version,
    snapshot: {
      title: input.education.title,
      summary: input.education.summary,
      investigations: input.education.investigations,
      management: input.education.management,
      references: input.education.references,
    },
    editorialStatus: input.education.editorialStatus,
    source: input.education.source,
    createdByUserId: 'author-1',
    createdAt: new Date('2026-08-24T00:00:00Z'),
    education: input.education,
  };
}
