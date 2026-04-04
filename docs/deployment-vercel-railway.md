# Deployment: Vercel Frontend + Railway Backend

## 1) Push Repository to GitHub

- Ensure only templates are committed:
  - `.env.example`
  - `doctordle-backend/.env.example`
- Ensure no real secrets are committed.

## 2) Railway Backend Setup

Create a Railway project with:

- PostgreSQL service
- Redis service
- Backend service from `doctordle-backend`

Source settings for backend service:

- Root directory: `doctordle-backend`
- Use the existing `Dockerfile` in that directory
- Railpack config: `doctordle-backend/railpack.json` provides an explicit start command

Backend commands:

- Build: `npm install && npm run build`
- Start: `npx prisma migrate deploy && node dist/src/main.js`

Required backend env vars:

- `DATABASE_URL`
- `REDIS_URL`
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT` (Railway-provided or explicit)
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER`
- `CLERK_JWT_AUDIENCE`
- `CLERK_JWKS_URL` (optional override)
- `ALLOWED_ORIGINS=https://<your-vercel-domain>`

Use template:

- `doctordle-backend/.env.railway.example`

Railway variable mapping tip:

- Set `DATABASE_URL` from Railway PostgreSQL service connection URL
- Set `REDIS_URL` from Railway Redis service connection URL
- Keep `HOST=0.0.0.0`
- Do not hardcode localhost URLs in production

Also set app-specific scoring/model vars from `doctordle-backend/.env.example`.

## 3) Vercel Frontend Setup (`doctordle-game`)

- Import repo in Vercel
- Root directory: `doctordle-game`
- Build: `npm run build`
- Output: `dist`

Frontend env vars:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_JWT_AUDIENCE=your-api`
- `VITE_API_BASE_URL=https://<railway-backend-domain>/api`
- `VITE_API_URL=https://<railway-backend-domain>/api` (optional fallback)
- `VITE_SHARE_URL=https://<your-vercel-domain>`

Use `doctordle-game/.env.vercel.example` as the source template when entering values in Vercel Project Settings → Environment Variables.

## 4) Clerk Dashboard Alignment

Add frontend domain(s) to Clerk:

- Vercel frontend domain(s)

Update Allowed Origins / Redirect URLs accordingly.

Verify issuer/audience consistency:

- `CLERK_JWT_ISSUER` in backend
- `CLERK_JWT_AUDIENCE` in backend/frontend template

## 5) Verify End-to-End

- Sign in on Vercel URL
- Call authenticated flow in app (e.g. game start)
- Confirm backend accepts token (no audience/issuer mismatch)
- Confirm sharing links resolve to production domain

Railway quick checks:

- Backend deploy logs show `Nest application successfully started`
- Backend is reachable on Railway public URL
- Login + protected API call succeed from Vercel frontend
