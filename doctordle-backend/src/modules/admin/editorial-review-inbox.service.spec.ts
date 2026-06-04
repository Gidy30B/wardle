import {
  CaseEditorialStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisRegistryCandidateStatus,
  DifferentialResolutionStatus,
} from '@prisma/client';
import { EditorialReviewInboxService } from './editorial-review-inbox.service';

const now = new Date('2026-06-04T12:00:00.000Z');
const registry = {
  id: 'registry-1',
  displayLabel: 'Appendicitis',
  specialty: 'General Surgery',
};

function buildPrisma() {
  return {
    diagnosisTeachingRule: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'rule-1',
          title: 'Migratory pain',
          status: 'NEEDS_REVIEW',
          category: 'finding',
          diagnosisRegistryId: registry.id,
          createdAt: now,
          updatedAt: now,
          diagnosisRegistry: registry,
        },
      ]),
      updateMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    diagnosisEditorialBrief: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'brief-1',
          summary: 'Brief summary',
          status: 'NEEDS_REVIEW',
          diagnosisRegistryId: registry.id,
          createdAt: now,
          updatedAt: now,
          diagnosisRegistry: registry,
        },
      ]),
    },
    diagnosisEducation: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'education-1',
          title: 'Appendicitis education',
          editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
          diagnosisRegistryId: registry.id,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
          diagnosisRegistry: registry,
        },
      ]),
    },
    case: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'case-1',
          title: 'Appendicitis case',
          editorialStatus: CaseEditorialStatus.REVIEW,
          proposedDiagnosisText: 'Appendicitis',
          diagnosisRegistryId: registry.id,
          approvedAt: now,
          date: now,
          diagnosisRegistry: registry,
        },
      ]),
    },
    diagnosisGraphCandidate: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'graph-1',
          type: 'MIMIC',
          status: DiagnosisGraphCandidateStatus.CANDIDATE,
          rawText: 'Mesenteric adenitis',
          confidence: 0.9,
          unresolvedTargetText: 'Mesenteric adenitis',
          diagnosisRegistryId: registry.id,
          sourcePath: 'differentialAnalysis',
          createdAt: now,
          updatedAt: now,
          diagnosisRegistry: registry,
        },
      ]),
    },
    caseDifferentialMapping: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'mapping-1',
          rawText: 'Gastroenteritis',
          status: DifferentialResolutionStatus.UNRESOLVED,
          sourcePath: 'explanation.differentials',
          createdAt: now,
          updatedAt: now,
          case: {
            id: 'case-1',
            title: 'Appendicitis case',
            diagnosisRegistryId: registry.id,
            diagnosisRegistry: registry,
          },
        },
      ]),
    },
    educationDifferentialMapping: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisRegistryCandidate: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'candidate-1',
          proposedCanonicalName: 'Mesenteric Adenitis',
          sourceRawText: 'Mesenteric adenitis',
          status: DiagnosisRegistryCandidateStatus.CANDIDATE,
          contextDiagnosisRegistryId: registry.id,
          createdAt: now,
          updatedAt: now,
          contextDiagnosisRegistry: registry,
        },
      ]),
    },
    diagnosisRegistry: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: registry.id,
          displayLabel: registry.displayLabel,
          canonicalName: 'Appendicitis',
          specialty: registry.specialty,
          onboardingStatus:
            DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
          createdAt: now,
          updatedAt: now,
        },
      ]),
    },
  };
}

describe('EditorialReviewInboxService', () => {
  it('aggregates reviewable items and summary counts', async () => {
    const prisma = buildPrisma();
    const service = new EditorialReviewInboxService(prisma as never);

    const result = await service.getInbox();

    expect(result.summary.total).toBeGreaterThanOrEqual(8);
    expect(result.summary.blockers).toBeGreaterThanOrEqual(2);
    expect(result.summary.byType.teachingRules).toBe(1);
    expect(result.summary.byType.cases).toBe(1);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'cases',
          targetUrl: '/cases/case-1',
          severity: 'urgent',
        }),
        expect.objectContaining({
          type: 'differentials',
          targetUrl: '/editorial/differentials',
          severity: 'blocker',
        }),
        expect.objectContaining({
          type: 'graphCandidates',
          targetUrl: '/diagnosis-graph/candidates',
          blockerReason: 'Mimic candidate has unresolved target text',
        }),
      ]),
    );
  });

  it('filters by type, severity, status, and specialty', async () => {
    const service = new EditorialReviewInboxService(buildPrisma() as never);

    const result = await service.getInbox({
      type: 'cases',
      severity: 'urgent',
      status: 'REVIEW',
      specialty: 'General Surgery',
    });

    expect(result.summary.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        type: 'cases',
        status: CaseEditorialStatus.REVIEW,
        specialty: 'General Surgery',
      }),
    );
  });

  it('returns empty state when filters match nothing', async () => {
    const service = new EditorialReviewInboxService(buildPrisma() as never);

    const result = await service.getInbox({ severity: 'low', type: 'cases' });

    expect(result.summary.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('does not mutate data', async () => {
    const prisma = buildPrisma();
    const service = new EditorialReviewInboxService(prisma as never);

    await service.getInbox();

    expect(prisma.diagnosisTeachingRule.updateMany).not.toHaveBeenCalled();
    expect(prisma.diagnosisTeachingRule.create).not.toHaveBeenCalled();
    expect(prisma.diagnosisTeachingRule.delete).not.toHaveBeenCalled();
  });
});
