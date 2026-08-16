import 'dotenv/config';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

async function main() {
  const statuses = await pool.query<{
    status: string;
    count: string;
  }>(`
    select status, count(*)::text as count
    from "GameSession"
    group by status
    order by status
  `);

  const recentSessionsByDay = await pool.query<{
    date: string;
    status: string;
    count: string;
  }>(`
    select dc."date"::text as date, gs."status", count(*)::text as count
    from "GameSession" gs
    join "DailyCase" dc on dc."id" = gs."dailyCaseId"
    group by dc."date", gs."status"
    order by dc."date" desc, gs."status"
    limit 30
  `);

  const userStats = await pool.query<{
    currentStreak: number;
    bestStreak: number;
    lastPlayedDate: string | null;
    count: string;
  }>(`
    select
      us."currentStreak",
      us."bestStreak",
      us."lastPlayedDate"::text as "lastPlayedDate",
      count(*)::text as count
    from "UserStats" us
    group by us."currentStreak", us."bestStreak", us."lastPlayedDate"
    order by us."lastPlayedDate" desc nulls last, us."currentStreak" desc
    limit 50
  `);

  console.log(
    JSON.stringify(
      {
        statuses: statuses.rows,
        recentSessionsByDay: recentSessionsByDay.rows,
        userStats: userStats.rows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
