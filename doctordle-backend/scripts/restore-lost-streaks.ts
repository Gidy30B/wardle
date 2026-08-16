import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const restoreDate =
  readOption('--date') ??
  process.env.STREAK_RESTORE_LOST_DATE ??
  formatUtcDate(addDays(truncateUtcDate(new Date()), -1));
const asOfDate =
  readOption('--as-of') ??
  process.env.STREAK_RESTORE_AS_OF_DATE ??
  formatUtcDate(truncateUtcDate(new Date()));
const apply =
  process.argv.includes('--apply') ||
  process.env.APPLY_STREAK_RESTORE === 'true';

assertDateString(restoreDate, 'restore date');
assertDateString(asOfDate, 'as-of date');

const restorePreviousDate = addDaysString(restoreDate, -1);
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

type CompletionRow = {
  userId: string;
  date: string;
};

type StatsRow = {
  userId: string;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
  email: string | null;
  username: string | null;
};

type Candidate = {
  userId: string;
  email: string | null;
  username: string | null;
  currentStreakBefore: number;
  bestStreakBefore: number;
  lastPlayedDateBefore: string | null;
  currentStreakAfter: number;
  bestStreakAfter: number;
  lastPlayedDateAfter: string;
  streakThroughPreviousDate: number;
  completedRestoreDate: boolean;
  completedAsOfDate: boolean;
};

async function main() {
  const [completionRows, statsRows] = await Promise.all([
    pool.query<CompletionRow>(
      `
        select distinct gs."userId", dc."date"::text as date
        from "GameSession" gs
        join "DailyCase" dc on dc."id" = gs."dailyCaseId"
        where gs."status" = 'completed'
          and dc."date" <= $1::date
        order by gs."userId", dc."date"::text
      `,
      [asOfDate],
    ),
    pool.query<StatsRow>(`
      select
        u."id" as "userId",
        u."email",
        u."username",
        coalesce(us."currentStreak", 0)::int as "currentStreak",
        coalesce(us."bestStreak", 0)::int as "bestStreak",
        us."lastPlayedDate"::text as "lastPlayedDate"
      from "User" u
      left join "UserStats" us on us."userId" = u."id"
    `),
  ]);

  const datesByUser = new Map<string, Set<string>>();
  for (const row of completionRows.rows) {
    const dates = datesByUser.get(row.userId) ?? new Set<string>();
    dates.add(row.date);
    datesByUser.set(row.userId, dates);
  }

  const candidates: Candidate[] = [];
  for (const stats of statsRows.rows) {
    const completedDates = datesByUser.get(stats.userId);
    if (!completedDates?.has(restorePreviousDate)) {
      continue;
    }

    const streakThroughPreviousDate = countStreakEndingAt(
      completedDates,
      restorePreviousDate,
    );
    if (streakThroughPreviousDate < 1) {
      continue;
    }

    const graceDates = new Set(completedDates);
    graceDates.add(restoreDate);

    const lastPlayedDateAfter = maxDateOnOrBefore(graceDates, asOfDate);
    if (
      !lastPlayedDateAfter ||
      compareDateStrings(lastPlayedDateAfter, restoreDate) < 0
    ) {
      continue;
    }

    const currentStreakAfter = countStreakEndingAt(
      graceDates,
      lastPlayedDateAfter,
    );
    const bestStreakAfter = Math.max(
      stats.bestStreak,
      maxConsecutiveStreak(graceDates),
      currentStreakAfter,
    );

    const needsRestore =
      stats.currentStreak < currentStreakAfter ||
      !stats.lastPlayedDate ||
      compareDateStrings(stats.lastPlayedDate, lastPlayedDateAfter) < 0 ||
      stats.bestStreak < bestStreakAfter;

    if (!needsRestore) {
      continue;
    }

    candidates.push({
      userId: stats.userId,
      email: stats.email,
      username: stats.username,
      currentStreakBefore: stats.currentStreak,
      bestStreakBefore: stats.bestStreak,
      lastPlayedDateBefore: stats.lastPlayedDate,
      currentStreakAfter,
      bestStreakAfter,
      lastPlayedDateAfter,
      streakThroughPreviousDate,
      completedRestoreDate: completedDates.has(restoreDate),
      completedAsOfDate: completedDates.has(asOfDate),
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        restoreDate,
        restorePreviousDate,
        asOfDate,
        candidateCount: candidates.length,
        candidates,
      },
      null,
      2,
    ),
  );

  if (!apply || candidates.length === 0) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const candidate of candidates) {
      await upsertStats(client, candidate);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  console.log(
    JSON.stringify(
      {
        restored: candidates.length,
        restoreDate,
        asOfDate,
      },
      null,
      2,
    ),
  );
}

async function upsertStats(client: PoolClient, candidate: Candidate) {
  await client.query(
    `
      insert into "UserStats" (
        "userId",
        "currentStreak",
        "bestStreak",
        "lastPlayedDate",
        "updatedAt"
      )
      values ($1, $2, $3, $4::date, now())
      on conflict ("userId") do update
      set
        "currentStreak" = excluded."currentStreak",
        "bestStreak" = greatest("UserStats"."bestStreak", excluded."bestStreak"),
        "lastPlayedDate" = excluded."lastPlayedDate",
        "updatedAt" = now()
    `,
    [
      candidate.userId,
      candidate.currentStreakAfter,
      candidate.bestStreakAfter,
      candidate.lastPlayedDateAfter,
    ],
  );
}

function readOption(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assertDateString(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}. Expected YYYY-MM-DD.`);
  }
}

function truncateUtcDate(value: Date): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addDaysString(value: string, days: number): string {
  return formatUtcDate(addDays(new Date(`${value}T00:00:00.000Z`), days));
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function compareDateStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function countStreakEndingAt(dates: Set<string>, endDate: string): number {
  let streak = 0;
  let cursor = endDate;

  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysString(cursor, -1);
  }

  return streak;
}

function maxDateOnOrBefore(dates: Set<string>, maxDate: string): string | null {
  let result: string | null = null;
  for (const date of dates) {
    if (compareDateStrings(date, maxDate) > 0) {
      continue;
    }

    if (!result || compareDateStrings(date, result) > 0) {
      result = date;
    }
  }

  return result;
}

function maxConsecutiveStreak(dates: Set<string>): number {
  const sortedDates = [...dates].sort(compareDateStrings);
  let longest = 0;
  let current = 0;
  let previous: string | null = null;

  for (const date of sortedDates) {
    if (previous && addDaysString(previous, 1) === date) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
    previous = date;
  }

  return longest;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
