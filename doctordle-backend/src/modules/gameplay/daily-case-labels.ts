import { PublishTrack } from '@prisma/client';

type DailyCaseLabelInput = {
  date: Date;
  track: PublishTrack;
  sequenceIndex: number;
  case?: {
    publicNumber?: number | null;
  } | null;
};

const TRACK_LABEL_PREFIX: Record<PublishTrack, string> = {
  [PublishTrack.DAILY]: 'Daily Case',
  [PublishTrack.PREMIUM]: 'Premium Case',
  [PublishTrack.PRACTICE]: 'Practice Case',
};

export function formatDailyCaseDisplayLabel(
  dailyCase: Pick<DailyCaseLabelInput, 'date' | 'sequenceIndex' | 'case'>,
): string {
  if (dailyCase.case?.publicNumber) {
    return `Case ${dailyCase.case.publicNumber}`;
  }

  return `Daily Case ${formatDateKey(dailyCase.date)} #${dailyCase.sequenceIndex}`;
}

export function formatDailyCaseTrackDisplayLabel(
  dailyCase: DailyCaseLabelInput,
): string {
  const publicNumber = dailyCase.case?.publicNumber;
  const prefix = TRACK_LABEL_PREFIX[dailyCase.track] ?? 'Case';

  if (publicNumber) {
    return `${prefix} ${publicNumber}`;
  }

  return `${prefix} ${formatDateKey(dailyCase.date)} #${dailyCase.sequenceIndex}`;
}

function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
