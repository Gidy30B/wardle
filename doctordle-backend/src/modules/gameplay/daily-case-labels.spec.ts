import { PublishTrack } from '@prisma/client';
import {
  formatDailyCaseDisplayLabel,
  formatDailyCaseTrackDisplayLabel,
} from './daily-case-labels';

describe('daily case labels', () => {
  const date = new Date('2026-05-10T00:00:00.000Z');

  it('uses the public number as the case label', () => {
    expect(
      formatDailyCaseDisplayLabel({
        date,
        sequenceIndex: 1,
        case: { publicNumber: 238 },
      }),
    ).toBe('Case 238');
  });

  it('falls back to a safe daily slot label when public number is missing', () => {
    expect(
      formatDailyCaseDisplayLabel({
        date,
        sequenceIndex: 1,
        case: { publicNumber: null },
      }),
    ).toBe('Daily Case 2026-05-10 #1');
  });

  it('never exposes UUIDs in fallback labels', () => {
    const uuid = '9f5c26d8-7ba7-4056-a249-0bb9d4f20eec';

    expect(
      formatDailyCaseDisplayLabel({
        date,
        sequenceIndex: 2,
        case: { publicNumber: null },
      }),
    ).not.toContain(uuid);
  });

  it('uses track-aware labels without treating sequenceIndex as a global number', () => {
    expect(
      formatDailyCaseTrackDisplayLabel({
        date,
        track: PublishTrack.PREMIUM,
        sequenceIndex: 2,
        case: { publicNumber: null },
      }),
    ).toBe('Premium Case 2026-05-10 #2');
  });
});
