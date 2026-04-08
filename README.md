# DxLab Monorepo

Wardle stack with separate frontend(s), backend API, and analytics dashboard.

## Apps

- `doctordle-game`: Player-facing React + Vite app.
- `doctordle-backend`: NestJS API with Clerk auth, Prisma, Redis.
- `analytics-dashboard`: Internal analytics React + Vite app.

## Local Development

1. Copy environment templates:
   - root: `.env.example` → `.env`
   - backend: `doctordle-backend/.env.example` → `doctordle-backend/.env`
2. Run env preflight from repo root:
   - `npm run check:env`
3. Start docker stack:
   - `docker compose up --build`

## Deploy Target (Recommended)

- Frontend (`doctordle-game`) on Vercel
- Backend + Postgres + Redis on Railway

For Vercel frontend env setup, use:

- `doctordle-game/.env.vercel.example`

See full deployment checklist in:

- `docs/deployment-vercel-railway.md`

## Security Notes

- Never commit real `.env` files.
- Keep only template files (`.env.example`) in git.
- Set secrets in Vercel/Railway dashboards.

## Queue System Runbook

### Internal Health Endpoint

`GET /internal/queue/health`

Headers:

- `x-internal-key: <INTERNAL_API_KEY>`

#### Response

```text
{
   "waiting": number,
   "active": number,
   "failed": number,
   "completed": number,
   "lagMs": number,
   "p95DurationMs": number
}
```

---

### What Good Looks Like

- `waiting ≈ 0–10`
- `active ≈ worker concurrency (e.g., 5)`
- `failed ≈ 0 (occasional spikes acceptable)`
- `lagMs < 2000 ms`
- `p95DurationMs stable (baseline after launch)`

---

### Alerts / Red Flags

#### High lag

- `lagMs > 5000`
   → Worker cannot keep up

Actions:

- Scale worker instances
- Increase concurrency
- Check DB latency

---

#### Growing waiting queue

- `waiting steadily increasing`
   → backlog forming

Actions:

- Scale workers
- Inspect slow jobs (`p95DurationMs`)

---

#### High failure rate

- `failed increasing continuously`

Actions:

- Check logs for `FINAL FAILURE`
- Validate external dependencies (DB, Redis, OpenAI)

---

### Operational Commands

#### Restart worker safely

- Jobs will retry automatically
- No data loss due to idempotency

---

### Deployment Notes

Both services must share:

- `DATABASE_URL`
- `REDIS_URL`
- `INTERNAL_API_KEY`

API:

- `npm run start:api`

Worker:

- `npm run start:worker`
