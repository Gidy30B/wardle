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
- Frontend local QA auth is disabled by default and also refuses production
  builds when `VITE_LOCAL_QA_AUTH_ENABLED=true`.
- Normal Clerk bearer-token auth remains the default path.

## Backend Env

Set these only in local `.env` or a local shell:

```powershell
$env:LOCAL_QA_AUTH_ENABLED="true"
$env:LOCAL_QA_AUTH_TOKEN="replace-with-a-long-local-only-token"
$env:LOCAL_QA_AUTH_USER_ID="local-qa-editor"
$env:LOCAL_QA_AUTH_EMAIL="local-qa-editor@example.test"
$env:LOCAL_QA_AUTH_ROLE="admin"
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
$env:VITE_LOCAL_QA_AUTH_TOKEN="replace-with-the-same-local-only-token"
$env:VITE_API_URL="http://localhost:3000/api"
```

The dashboard will use the local QA header instead of Clerk only when this flag
is set.

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

Frontend:

```powershell
cd analytics-dashboard
npm run dev
```

Open seeded workspaces at:

```text
http://localhost:5173/editorial/coverage
http://localhost:5173/editorial/diagnoses/<diagnosisRegistryId>
```

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
$env:VITE_LOCAL_QA_AUTH_ENABLED="true"
$env:VITE_LOCAL_QA_AUTH_TOKEN="replace-with-the-same-local-only-token"
$env:QA_API_URL="http://localhost:3000/api"
$env:QA_DASHBOARD_URL="http://localhost:5173"
npm run qa:editorial-smoke
```

The smoke opens editorial coverage, opens the Appendicitis seeded workspace,
navigates workspace tabs, checks the right rail, and confirms Cases tab
annotation controls render.
