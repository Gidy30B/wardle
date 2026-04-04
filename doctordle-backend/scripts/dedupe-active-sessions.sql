WITH ranked AS (
  SELECT
    id,
    "userId",
    "dailyCaseId",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "dailyCaseId"
      ORDER BY "startedAt" DESC, id DESC
    ) AS row_num
  FROM "GameSession"
  WHERE status = 'active'
)
UPDATE "GameSession" AS gs
SET
  status = 'completed',
  "completedAt" = COALESCE(gs."completedAt", NOW())
FROM ranked r
WHERE gs.id = r.id
  AND r.row_num > 1;
