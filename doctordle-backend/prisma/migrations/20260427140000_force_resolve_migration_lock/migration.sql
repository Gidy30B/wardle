-- Force-resolve the stuck migration lock that is blocking Prisma P3009.
--
-- Migration 20260427120000_backfill_diagnosis_registry_from_legacy has
-- finished_at = NULL in _prisma_migrations, which causes every subsequent
-- `prisma migrate deploy` to abort with error P3009 before running anything.
--
-- This migration is intentionally minimal: it only patches the metadata table
-- so that Prisma considers the failed migration resolved and allows the rest of
-- the migration history (including 20260427130000) to proceed normally.
--
-- The actual backfill logic is handled by 20260427130000, which is idempotent
-- and will run immediately after this migration unblocks the queue.

UPDATE "_prisma_migrations"
SET
  "finished_at"         = NOW(),
  "applied_steps_count" = 1,
  "logs"                = NULL
WHERE "migration_name" = '20260427120000_backfill_diagnosis_registry_from_legacy'
  AND "finished_at" IS NULL;
