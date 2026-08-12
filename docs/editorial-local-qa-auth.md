# Editorial Workspace Local QA Auth

This setup is for local development only. It lets the analytics dashboard run
authenticated editorial smoke tests without a manually controlled Clerk browser
session.

## Safety Rules

- Backend local QA auth is disabled by default.
- Backend local QA auth requires `LOCAL_QA_AUTH_ENABLED=true`.
- Backend startup refuses `LOCAL_QA_AUTH_ENABLED=true` when
  `NODE_ENV=production`.
- Backend local QA auth requires `LOCAL_QA_AUTH_TOKEN`.
- Frontend local QA auth is disabled by default and refuses production-mode
  builds when `VITE_LOCAL_QA_AUTH_ENABLED=true`. Explicit local-QA Docker
  images are built in Vite development mode and remain local-only.
- Normal Clerk bearer-token auth remains the default path.

## Backend Env

Generate one local-only token and reuse it for the backend and Playwright. Do
not add the generated value to any committed env sample:

```powershell
$token = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$env:LOCAL_QA_AUTH_ENABLED="true"
$env:LOCAL_QA_AUTH_TOKEN=$token
$env:VITE_LOCAL_QA_AUTH_ENABLED="true"
$env:VITE_LOCAL_QA_AUTH_TOKEN=$token
$env:LOCAL_QA_AUTH_USER_ID="local-qa-editor"
$env:LOCAL_QA_AUTH_EMAIL="local-qa-editor@example.test"
$env:LOCAL_QA_AUTH_ROLE="admin"
```

For Docker Compose, set the same `LOCAL_QA_AUTH_*` values in the ignored root
`.env` file or in the shell that launches Compose. For backend-only local
development, put them in the ignored `doctordle-backend/.env.local` file or the
launching shell. The sample value is intentionally blank:

```dotenv
LOCAL_QA_AUTH_ENABLED=true
LOCAL_QA_AUTH_TOKEN=<generate-a-long-random-local-token>
LOCAL_QA_AUTH_USER_ID=local-qa-editor
LOCAL_QA_AUTH_EMAIL=local-qa-editor@example.test
LOCAL_QA_AUTH_ROLE=admin
```

Allowed local QA roles are `editor`, `senior_editor`, and `admin`.

The backend accepts local QA auth only through:

```text
x-wardle-local-qa-token: <LOCAL_QA_AUTH_TOKEN>
```

## Frontend Env

Set matching Vite vars for the analytics dashboard:

```powershell
$env:VITE_LOCAL_QA_AUTH_ENABLED="true"
$env:VITE_LOCAL_QA_AUTH_TOKEN=$env:LOCAL_QA_AUTH_TOKEN
$env:VITE_API_URL="http://localhost:3000/api"
```

The dashboard will use the local QA header instead of Clerk only when this flag
is set. Vite variables are compiled into the browser bundle, so Docker QA
values must be present during `docker compose build frontend`; setting them
only when starting an already-built container does not update the bundle.

## Run Local QA Data

```powershell
cd doctordle-backend
$env:EDITORIAL_WORKSPACE_QA_SEED="1"
npm run seed:editorial-workspace-qa
```

The seed creates/updates:

- Appendicitis
- Acute Pancreatitis
- Diabetic Ketoacidosis
- Ruptured Ectopic Pregnancy
- Peptic Ulcer Disease
- Nutritional Vitamin D Deficiency Rickets
- SIADH

## Run Apps

Backend:

```powershell
cd doctordle-backend
npm run start:dev
```

Frontend (Docker default):

```powershell
docker compose up frontend
```

### Workspace Navigation URLs

| Purpose | URL |
|---|---|
| Coverage cockpit | `http://127.0.0.1:8080/editorial/coverage` |
| Default workflow workspace | `http://127.0.0.1:8080/editorial/diagnoses/<id>` |
| Legacy tab escape | `http://127.0.0.1:8080/editorial/diagnoses/<id>?workspaceShell=legacy` |
| Publish / publication-readiness board | `http://127.0.0.1:8080/editorial/diagnoses/<id>?workflow=publish&board=publicationReadiness` |
| Cases / diagnostic-cases board | `http://127.0.0.1:8080/editorial/diagnoses/<id>?workflow=cases&board=diagnosticCases` |
| Overview / diagnosis-health board | `http://127.0.0.1:8080/editorial/diagnoses/<id>?workflow=overview&board=diagnosisHealth` |

Appendicitis (`1c36ca1b-701f-452f-a4bb-42e3f3914cce`) is the most complete QA
fixture and can be used as a concrete `<id>` for manual testing.

The helper endpoint lists seeded IDs when local QA auth is enabled:

```text
GET http://localhost:3000/api/auth/local-qa/diagnoses
x-wardle-local-qa-token: <LOCAL_QA_AUTH_TOKEN>
```

## Run Smoke Test

Install Playwright if it is not already available:

```powershell
cd analytics-dashboard
npx playwright install chromium
```

Then run:

```powershell
cd C:\Users\user\DxLab

$token = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$env:LOCAL_QA_AUTH_ENABLED="true"
$env:LOCAL_QA_AUTH_TOKEN=$token
$env:LOCAL_QA_AUTH_USER_ID="local-qa-editor"
$env:LOCAL_QA_AUTH_EMAIL="local-qa-editor@example.test"
$env:LOCAL_QA_AUTH_ROLE="admin"

$env:VITE_LOCAL_QA_AUTH_ENABLED="true"
$env:VITE_LOCAL_QA_AUTH_TOKEN=$token
$env:VITE_API_URL="http://localhost:3000/api"

docker compose up -d --force-recreate backend
docker compose build --no-cache frontend
docker compose up -d --force-recreate frontend

cd analytics-dashboard
$env:VITE_LOCAL_QA_AUTH_ENABLED="true"
$env:VITE_LOCAL_QA_AUTH_TOKEN=$token
$env:QA_API_URL="http://localhost:3000/api"
$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:8080"
$env:PLAYWRIGHT_SKIP_WEBSERVER="true"

docker exec doctordle-backend printenv LOCAL_QA_AUTH_ENABLED
Invoke-WebRequest `
  -Headers @{ "x-wardle-local-qa-token"=$env:LOCAL_QA_AUTH_TOKEN } `
  http://localhost:3000/api/auth/local-qa/diagnoses
npm run qa:editorial-smoke
```

By default, Playwright runs `docker compose up -d frontend` and waits up to two
minutes for `PLAYWRIGHT_BASE_URL` to respond. It reuses an already-running
frontend when available. To target an existing Docker, CI, or local development
server without starting Compose, set:

```powershell
$env:PLAYWRIGHT_SKIP_WEBSERVER="true"
```

For a separately started local development server, also set
`PLAYWRIGHT_BASE_URL` to that server's origin before running Playwright.

The suite runs two tests. Test 1 verifies the coverage cockpit loads and the
default workspace URL renders the workflow shell (Review Queue active, all seven
workflow nav items present, switching workflows updates `aria-current`), then
confirms `?workspaceShell=legacy` restores the legacy tab UI. Test 2 audits
coverage-page links: default workspace links carry no `workspaceShell` param and
claim-repair links carry `workspaceShell=legacy`.

Expected result: **9 passed, 1 fixture-dependent skip, 0 failed**. The skipped
test (`keeps brief-onboarding-progress disabled when rendered`) auto-skips when
the fixture diagnosis has 100 % onboarding completion.
