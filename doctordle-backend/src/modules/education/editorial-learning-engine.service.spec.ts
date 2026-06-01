import { NotFoundException } from '@nestjs/common';
import { EditorialLearningEngineService } from './editorial-learning-engine.service';

describe('EditorialLearningEngineService', () => {
  function buildService(revisions: Array<{ version: number; snapshot: object }>) {
    const prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'diagnosis-1',
          education: {
            id: 'education-1',
            revisions: revisions.map((revision, index) => ({
              version: revision.version,
              snapshot: revision.snapshot,
              source: index === 0 ? 'AI_ASSISTED' : 'HYBRID',
              createdByUserId: index === 0 ? null : 'editor-1',
            })),
          },
        }),
      },
      diagnosisGraphCandidate: {
        create: jest.fn(),
      },
    };
    const service = new EditorialLearningEngineService(prisma as never);

    return { prisma, service };
  }

  it('generates a candidate from a meaningful human edit', async () => {
    const { service } = buildService([
      revision(1, {
        examPearls: [{ label: 'Rovsing', explanation: 'RLQ pain.' }],
      }),
      revision(2, {
        examPearls: [
          {
            label: 'Rovsing',
            explanation:
              'RLQ pain occurs because peritoneal irritation transfers pain from left-sided palpation.',
          },
        ],
      }),
    ]);

    const result = await service.learnFromEdit({
      diagnosisRegistryId: 'diagnosis-1',
      fromVersion: 1,
      toVersion: 2,
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateType: 'diagnosis_specific_pearl_candidate',
        section: 'examPearls',
        sourceRevisionFrom: 1,
        sourceRevisionTo: 2,
        diagnosisRegistryId: 'diagnosis-1',
      }),
    ]);
  });

  it('ignores generic wording edits', async () => {
    const { service } = buildService([
      revision(1, {
        clinicalPattern: 'Appendicitis is a common diagnosis.',
      }),
      revision(2, {
        clinicalPattern:
          'Appendicitis is a very important and common diagnosis.',
      }),
    ]);

    const result = await service.learnFromEdit({
      diagnosisRegistryId: 'diagnosis-1',
      fromVersion: 1,
      toVersion: 2,
    });

    expect(result.candidates).toEqual([]);
  });

  it('creates an investigation interpretation candidate', async () => {
    const { service } = buildService([
      revision(1, {
        investigations: [{ test: 'CT abdomen', finding: 'appendix enlarged' }],
      }),
      revision(2, {
        investigations: [
          {
            test: 'CT abdomen',
            finding:
              'appendix enlarged with fat stranding supports appendicitis and argues against gastroenteritis.',
          },
        ],
      }),
    ]);

    const result = await service.learnFromEdit({
      diagnosisRegistryId: 'diagnosis-1',
      fromVersion: 1,
      toVersion: 2,
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateType: 'graph_fact_candidate',
        section: 'investigations',
        inferredRule: expect.stringContaining('Investigation entries'),
      }),
    ]);
  });

  it('creates a differential discriminator candidate', async () => {
    const { service } = buildService([
      revision(1, {
        differentials: [
          { diagnosis: 'gastroenteritis', distinguishingPoint: 'vomiting' },
        ],
      }),
      revision(2, {
        differentials: [
          {
            diagnosis: 'gastroenteritis',
            distinguishingPoint:
              'Unlike gastroenteritis, focal RLQ guarding and rebound favor appendicitis.',
          },
        ],
      }),
    ]);

    const result = await service.learnFromEdit({
      diagnosisRegistryId: 'diagnosis-1',
      fromVersion: 1,
      toVersion: 2,
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateType: 'pattern_improvement_candidate',
        section: 'differentials',
      }),
    ]);
  });

  it('does not auto-promote learning candidates', async () => {
    const { prisma, service } = buildService([
      revision(1, {
        management: 'Surgery may be needed.',
      }),
      revision(2, {
        management:
          'Consult surgery when CT or peritoneal exam supports appendicitis before antibiotics alone delay source control.',
      }),
    ]);

    await service.learnFromEdit({
      diagnosisRegistryId: 'diagnosis-1',
      fromVersion: 1,
      toVersion: 2,
    });

    expect(prisma.diagnosisGraphCandidate.create).not.toHaveBeenCalled();
  });

  it('handles missing revisions safely', async () => {
    const { service } = buildService([]);

    await expect(
      service.learnFromEdit({
        diagnosisRegistryId: 'diagnosis-1',
        fromVersion: 1,
        toVersion: 2,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function revision(version: number, snapshot: object) {
  return { version, snapshot };
}
