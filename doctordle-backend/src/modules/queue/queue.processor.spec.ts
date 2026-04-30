import { computeTimeToCompleteSeconds } from './queue.processor';

describe('computeTimeToCompleteSeconds', () => {
  it('returns rounded non-negative seconds between startedAt and completedAt', () => {
    expect(
      computeTimeToCompleteSeconds({
        startedAt: new Date('2026-04-22T08:00:00.000Z'),
        completedAt: new Date('2026-04-22T08:01:41.600Z'),
      }),
    ).toBe(102);
  });

  it('returns null when a timestamp is missing', () => {
    expect(
      computeTimeToCompleteSeconds({
        startedAt: new Date('2026-04-22T08:00:00.000Z'),
        completedAt: null,
      }),
    ).toBeNull();
  });

  it('clamps negative durations to zero', () => {
    expect(
      computeTimeToCompleteSeconds({
        startedAt: new Date('2026-04-22T08:01:00.000Z'),
        completedAt: new Date('2026-04-22T08:00:00.000Z'),
      }),
    ).toBe(0);
  });
});
