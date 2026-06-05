import {
  ClinicalCategory,
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisEvidenceRelationshipType,
  DiagnosisRegistryStatus,
  EvidenceNodeStatus,
  EvidenceType,
} from '@prisma/client';
import { EvidenceGraphService } from './evidence-graph.service';

function buildPrisma() {
  const relationship = {
    id: 'relationship-1',
    diagnosisRegistryId: 'registry-1',
    evidenceNodeId: 'node-1',
    relationshipType: DiagnosisEvidenceRelationshipType.DISCRIMINATES,
    strength: 4,
    discriminatorWeight: 4,
    reasoningSummary: 'Free air under diaphragm from case clue',
    contradictoryDiagnosisIds: null,
    supportingTeachingRelationshipId: null,
    supportingTeachingRuleId: null,
    supportingCaseId: 'case-1',
    status: DiagnosisEvidenceRelationshipStatus.CANDIDATE,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    diagnosisRegistry: {
      id: 'registry-1',
      displayLabel: 'Perforated viscus',
      canonicalName: 'Perforated viscus',
      status: DiagnosisRegistryStatus.ACTIVE,
      active: true,
    },
    evidenceNode: {
      id: 'node-1',
      normalizedKey: 'free air under diaphragm',
      displayLabel: 'Free air under diaphragm',
      evidenceType: EvidenceType.IMAGING,
      clinicalCategory: ClinicalCategory.GI,
      synonyms: [],
      status: EvidenceNodeStatus.CANDIDATE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    supportingTeachingRelationship: null,
    supportingTeachingRule: null,
    supportingCase: {
      id: 'case-1',
      title: 'Acute abdomen',
      editorialStatus: 'READY_TO_PUBLISH',
    },
    reviewedByUser: null,
  };

  return {
    relationship,
    prisma: {
      case: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'case-1',
            diagnosisRegistryId: 'registry-1',
            clues: [
              {
                id: 'clue-1',
                type: 'imaging',
                value: 'Free air under diaphragm',
                order: 2,
              },
            ],
            symptoms: [],
            labs: null,
          },
        ]),
      },
      diagnosisTeachingRule: { findMany: jest.fn().mockResolvedValue([]) },
      diagnosisEducation: { findMany: jest.fn().mockResolvedValue([]) },
      diagnosisTeachingRelationship: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      diagnosisGraphFact: { findMany: jest.fn().mockResolvedValue([]) },
      diagnosisRegistry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'registry-1',
            status: DiagnosisRegistryStatus.ACTIVE,
            active: true,
          },
        ]),
      },
      evidenceNode: {
        upsert: jest.fn().mockResolvedValue({
          id: 'node-1',
          normalizedKey: 'free air under diaphragm',
          displayLabel: 'Free air under diaphragm',
          evidenceType: EvidenceType.IMAGING,
          clinicalCategory: ClinicalCategory.GI,
          synonyms: [],
          status: EvidenceNodeStatus.CANDIDATE,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({ id: 'node-1' }),
      },
      diagnosisEvidenceRelationship: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(relationship),
        update: jest.fn().mockResolvedValue({
          ...relationship,
          status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
          reviewedByUserId: 'senior-1',
        }),
        findMany: jest.fn().mockResolvedValue([relationship]),
        groupBy: jest.fn().mockResolvedValue([
          { diagnosisRegistryId: 'registry-1', _count: { _all: 1 } },
        ]),
      },
    },
  };
}

describe('EvidenceGraphService', () => {
  it('creates deterministic evidence candidates from case clues', async () => {
    const { prisma } = buildPrisma();
    const service = new EvidenceGraphService(prisma as never);

    const result = await service.generateCandidates({
      diagnosisRegistryId: 'registry-1',
    });

    expect(result.createdCount).toBe(1);
    expect(prisma.evidenceNode.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { normalizedKey: 'free air under diaphragm' },
      }),
    );
    expect(prisma.diagnosisEvidenceRelationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          relationshipType: DiagnosisEvidenceRelationshipType.ESCALATES,
          discriminatorWeight: 5,
          supportingCaseId: 'case-1',
        }),
      }),
    );
  });

  it('prevents duplicate candidate creation when the relationship exists', async () => {
    const { prisma, relationship } = buildPrisma();
    prisma.diagnosisEvidenceRelationship.findUnique.mockResolvedValue(
      relationship,
    );
    const service = new EvidenceGraphService(prisma as never);

    const result = await service.generateCandidates({
      diagnosisRegistryId: 'registry-1',
    });

    expect(result.createdCount).toBe(0);
    expect(result.existingCount).toBe(1);
    expect(prisma.diagnosisEvidenceRelationship.create).not.toHaveBeenCalled();
  });

  it('activates reviewed evidence relationships and marks nodes active', async () => {
    const { prisma, relationship } = buildPrisma();
    prisma.diagnosisEvidenceRelationship.findUnique.mockResolvedValue(
      relationship,
    );
    const service = new EvidenceGraphService(prisma as never);

    const result = await service.reviewRelationship('relationship-1', 'senior-1', {
      action: 'activate',
    });

    expect(result.status).toBe(DiagnosisEvidenceRelationshipStatus.ACTIVE);
    expect(prisma.evidenceNode.update).toHaveBeenCalledWith({
      where: { id: 'node-1' },
      data: { status: EvidenceNodeStatus.ACTIVE },
    });
  });
});
