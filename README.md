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

See full deployment checklist in:

- `docs/deployment-vercel-railway.md`

## Security Notes

- Never commit real `.env` files.
- Keep only template files (`.env.example`) in git.
- Set secrets in Vercel/Railway dashboards.
