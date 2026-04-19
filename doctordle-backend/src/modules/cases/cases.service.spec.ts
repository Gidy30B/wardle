import { PublishTrack } from '@prisma/client';
import { CasesService } from './cases.service';

describe('CasesService legacy DAILY compatibility', () => {
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

    const prisma = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          editorialStatus: 'READY_TO_PUBLISH',
          diagnosis: { name: 'Asthma' },
        }),
      },
      dailyCase: {
        upsert,
      },
    };

    const aiContentService = {
      scheduleCaseContent: jest.fn(),
    };

    const editorialMetrics = {
      recordAssignmentAccepted: jest.fn(),
      recordAssignmentRejected: jest.fn(),
    };

    const service = new CasesService(
      prisma as never,
      aiContentService as never,
      editorialMetrics as never,
    );

    const result = await service.assignDailyCase('2026-04-18', 'case-1');

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
});
