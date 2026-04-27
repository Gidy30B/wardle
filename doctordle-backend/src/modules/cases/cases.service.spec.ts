import { PublishTrack } from '@prisma/client';
import { CasesService } from './cases.service';

describe('CasesService', () => {
  function createServiceFixture(overrides?: {
    case?: Record<string, unknown>;
    dailyCase?: Record<string, unknown>;
    diagnosisRegistryLinkService?: Record<string, unknown>;
  }) {
    const prisma = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          editorialStatus: 'READY_TO_PUBLISH',
          diagnosis: { name: 'Asthma' },
        }),
        create: jest.fn(),
        upsert: jest.fn(),
        ...(overrides?.case ?? {}),
      },
      dailyCase: {
        upsert: jest.fn(),
        ...(overrides?.dailyCase ?? {}),
      },
    };

    const aiContentService = {
      scheduleCaseContent: jest.fn(),
    };

    const editorialMetrics = {
      recordAssignmentAccepted: jest.fn(),
      recordAssignmentRejected: jest.fn(),
    };

    const diagnosisRegistryLinkService = {
      resolveForWrite: jest.fn().mockResolvedValue({
        diagnosisId: 'diagnosis-1',
        diagnosisName: 'Asthma',
        diagnosisRegistryId: 'registry-1',
      }),
      ...(overrides?.diagnosisRegistryLinkService ?? {}),
    };

    return {
      prisma,
      aiContentService,
      editorialMetrics,
      diagnosisRegistryLinkService,
      service: new CasesService(
        prisma as never,
        aiContentService as never,
        editorialMetrics as never,
        diagnosisRegistryLinkService as never,
      ),
    };
  }

  it('assigns the legacy daily slot using DAILY track and sequenceIndex 1', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'dc-1',
      caseId: 'case-1',
      date: new Date('2026-04-18T00:00:00.000Z'),
      track: PublishTrack.DAILY,
      sequenceIndex: 1,
      case: {
        id: 'case-1',
        title: 'Daily Case',
        date: new Date('2026-04-18T00:00:00.000Z'),
        difficulty: 'easy',
        history: 'History',
        symptoms: ['cough'],
        diagnosis: { name: 'Asthma' },
      },
    });

    const fixture = createServiceFixture({
      dailyCase: {
        upsert,
      },
    });

    const result = await fixture.service.assignDailyCase('2026-04-18', 'case-1');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date_track_sequenceIndex: {
            date: new Date('2026-04-18T00:00:00.000Z'),
            track: PublishTrack.DAILY,
            sequenceIndex: 1,
          },
        },
        create: expect.objectContaining({
          track: PublishTrack.DAILY,
          sequenceIndex: 1,
        }),
      }),
    );
    expect(result.track).toBe(PublishTrack.DAILY);
    expect(result.sequenceIndex).toBe(1);
  });

  it('writes diagnosisRegistryId during manual case creation', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'case-2',
      title: 'Reactive airway disease',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'Wheezing after exercise',
      symptoms: ['wheezing'],
      diagnosisId: 'diagnosis-1',
      diagnosis: { name: 'Asthma' },
    });
    const fixture = createServiceFixture({
      case: {
        create,
      },
    });

    await fixture.service.createCase({
      title: 'Reactive airway disease',
      history: 'Wheezing after exercise',
      symptoms: ['wheezing'],
      diagnosisId: 'diagnosis-1',
    });

    expect(fixture.diagnosisRegistryLinkService.resolveForWrite).toHaveBeenCalledWith({
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: undefined,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: 'MATCHED',
          diagnosisMappingMethod: 'LEGACY_BACKFILL',
          diagnosisMappingConfidence: 1,
        }),
      }),
    );
  });
});
