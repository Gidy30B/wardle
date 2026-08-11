import { PublishTrack } from '@prisma/client';
import { ParticipationPolicyService } from './participation-policy.service';
import { isSameWardleDay, normalizeWardleDayDate } from './wardle-day';

describe('ParticipationPolicyService', () => {
  const service = new ParticipationPolicyService();
  const currentDate = new Date('2026-04-22T21:30:00.000Z');

  it('resolves DAILY on the current Wardle day as CURRENT_DAILY', () => {
    expect(
      service.resolveCompletionPolicy({
        dailyCase: {
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: PublishTrack.DAILY,
        },
        currentDate,
      }),
    ).toEqual({
      context: 'CURRENT_DAILY',
      xpEligible: true,
      streakEligible: true,
      leaderboardEligible: true,
      learningEligible: true,
    });
  });

  it('resolves historical DAILY as ARCHIVED_DAILY', () => {
    expect(
      service.resolveCompletionPolicy({
        dailyCase: {
          date: new Date('2026-04-21T00:00:00.000Z'),
          track: PublishTrack.DAILY,
        },
        currentDate,
      }),
    ).toEqual({
      context: 'ARCHIVED_DAILY',
      xpEligible: true,
      streakEligible: false,
      leaderboardEligible: false,
      learningEligible: true,
    });
  });

  it('resolves PREMIUM without Daily streak or leaderboard eligibility', () => {
    expect(
      service.resolveCompletionPolicy({
        dailyCase: {
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: PublishTrack.PREMIUM,
        },
        currentDate,
      }),
    ).toEqual({
      context: 'PREMIUM',
      xpEligible: true,
      streakEligible: false,
      leaderboardEligible: false,
      learningEligible: true,
    });
  });

  it('uses the provisional PRACTICE XP policy without streak or leaderboard eligibility', () => {
    expect(
      service.resolveCompletionPolicy({
        dailyCase: {
          date: new Date('2026-04-22T00:00:00.000Z'),
          track: PublishTrack.PRACTICE,
        },
        currentDate,
      }),
    ).toEqual({
      context: 'PRACTICE',
      xpEligible: true,
      streakEligible: false,
      leaderboardEligible: false,
      learningEligible: true,
    });
  });

  it('rejects future DAILY assignment context resolution', () => {
    expect(() =>
      service.resolveCompletionPolicy({
        dailyCase: {
          date: new Date('2026-04-23T00:00:00.000Z'),
          track: PublishTrack.DAILY,
        },
        currentDate,
      }),
    ).toThrow('Future DailyCase cannot resolve participation policy');
  });

  it.each([
    ['2026-04-22T00:30:00+03:00', '2026-04-21T00:00:00.000Z'],
    ['2026-04-22T02:59:59+03:00', '2026-04-21T00:00:00.000Z'],
    ['2026-04-22T03:00:00+03:00', '2026-04-22T00:00:00.000Z'],
    ['2026-04-22T05:01:00+03:00', '2026-04-22T00:00:00.000Z'],
    ['2026-04-22T23:30:00+03:00', '2026-04-22T00:00:00.000Z'],
  ])(
    'uses the UTC Wardle-day boundary for Africa/Nairobi time %s',
    (currentDateIso, expectedDailyCaseDateIso) => {
      expect(
        service.resolveCompletionPolicy({
          dailyCase: {
            date: new Date(expectedDailyCaseDateIso),
            track: PublishTrack.DAILY,
          },
          currentDate: new Date(currentDateIso),
        }).context,
      ).toBe('CURRENT_DAILY');
    },
  );
});

describe('Wardle day helpers', () => {
  it('normalizes dates to UTC day boundaries', () => {
    expect(
      normalizeWardleDayDate('2026-04-22T23:59:59.000Z').toISOString(),
    ).toBe('2026-04-22T00:00:00.000Z');
  });

  it('compares by normalized UTC Wardle day', () => {
    expect(
      isSameWardleDay(
        new Date('2026-04-22T00:00:00.000Z'),
        new Date('2026-04-22T23:59:59.000Z'),
      ),
    ).toBe(true);
  });
});
