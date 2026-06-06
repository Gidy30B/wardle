import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  GenerationPurpose,
  ReasoningGoal,
  ReasoningPathStatus,
} from '@prisma/client';
import { ReasoningPathService } from './reasoning-path.service';

describe('ReasoningPathService stabilization', () => {
  function buildService() {
    const prisma = {
      reasoningPath: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      diagnosisRegistry: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      diagnosisEvidenceRelationship: {
        findMany: jest.fn(),
      },
      diagnosisTeachingRelationship: {
        findMany: jest.fn(),
      },
      evidenceNode: {
        findMany: jest.fn(),
      },
    };

    return {
      prisma,
      service: new ReasoningPathService(prisma as never),
    };
  }

  function activePath(overrides: Record<string, unknown> = {}) {
    return {
      id: 'path-1',
      diagnosisRegistryId: 'diagnosis-1',
      normalizedKey: 'diagnosis-1-differential-case',
      title: 'Asthma: differential discrimination',
      reasoningGoal: ReasoningGoal.DIFFERENTIAL_DISCRIMINATION,
      primaryDifferentialIds: ['diagnosis-2'],
      supportingTeachingRelationshipIds: ['teaching-1'],
      supportingEvidenceRelationshipIds: ['evidence-1'],
      discriminatorEvidenceNodeIds: ['node-1'],
      escalationEvidenceNodeIds: [],
      contradictoryEvidenceNodeIds: [],
      requiredTeachingPoints: ['Separate asthma from vocal cord dysfunction.'],
      forbiddenEvidencePatterns: [],
      recommendedClueDistribution: { history: 1 },
      generationPurpose: GenerationPurpose.CASE_GENERATION,
      readinessScore: 85,
      status: ReasoningPathStatus.ACTIVE,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date('2026-06-06T00:00:00.000Z'),
      updatedAt: new Date('2026-06-06T00:00:00.000Z'),
      diagnosisRegistry: {
        id: 'diagnosis-1',
        displayLabel: 'Asthma',
        canonicalName: 'asthma',
        specialty: 'Pulmonology',
        bodySystem: 'Respiratory',
        category: 'Obstructive',
      },
      reviewedByUser: null,
      ...overrides,
    };
  }

  it('blocks constrained generation when path dependencies are stale', async () => {
    const { prisma, service } = buildService();
    prisma.reasoningPath.findUnique.mockResolvedValue(activePath());
    prisma.diagnosisEvidenceRelationship.findMany.mockResolvedValue([]);
    prisma.diagnosisTeachingRelationship.findMany.mockResolvedValue([]);
    prisma.evidenceNode.findMany.mockResolvedValue([]);

    await expect(
      service.buildCaseGenerationContext('path-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not activate weak reasoning paths', async () => {
    const { prisma, service } = buildService();
    prisma.reasoningPath.findUnique.mockResolvedValue(
      activePath({
        status: ReasoningPathStatus.CANDIDATE,
        readinessScore: 25,
      }),
    );

    await expect(
      service.reviewPath('path-1', 'reviewer-1', { action: 'activate' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reasoningPath.update).not.toHaveBeenCalled();
  });

  it('returns not found for missing reasoning paths', async () => {
    const { prisma, service } = buildService();
    prisma.reasoningPath.findUnique.mockResolvedValue(null);

    await expect(service.getPath('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
