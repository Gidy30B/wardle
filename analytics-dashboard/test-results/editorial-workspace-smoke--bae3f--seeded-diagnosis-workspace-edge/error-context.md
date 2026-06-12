# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editorial-workspace-smoke.spec.ts >> opens editorial coverage and seeded diagnosis workspace
- Location: qa\editorial-workspace-smoke.spec.ts:14:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | const apiUrl = (process.env.QA_API_URL ?? 'http://localhost:3000/api').replace(
  4  |   /\/$/,
  5  |   '',
  6  | );
  7  | const qaToken = process.env.VITE_LOCAL_QA_AUTH_TOKEN;
  8  | 
  9  | test.skip(
  10 |   process.env.VITE_LOCAL_QA_AUTH_ENABLED !== 'true' || !qaToken,
  11 |   'Set VITE_LOCAL_QA_AUTH_ENABLED=true and VITE_LOCAL_QA_AUTH_TOKEN before running local QA smoke tests.',
  12 | );
  13 | 
  14 | test('opens editorial coverage and seeded diagnosis workspace', async ({
  15 |   page,
  16 |   request,
  17 | }) => {
  18 |   const response = await request.get(`${apiUrl}/auth/local-qa/diagnoses`, {
  19 |     headers: { 'x-wardle-local-qa-token': qaToken ?? '' },
  20 |   });
> 21 |   expect(response.ok()).toBeTruthy();
     |                         ^ Error: expect(received).toBeTruthy()
  22 | 
  23 |   const body = (await response.json()) as {
  24 |     diagnoses: Array<{
  25 |       id: string;
  26 |       canonicalNormalized: string;
  27 |       displayLabel: string;
  28 |     }>;
  29 |   };
  30 |   const appendicitis = body.diagnoses.find(
  31 |     (diagnosis) => diagnosis.canonicalNormalized === 'appendicitis',
  32 |   );
  33 |   expect(appendicitis, 'Appendicitis QA seed should exist').toBeTruthy();
  34 | 
  35 |   await page.goto('/editorial/coverage');
  36 |   await expect(page.getByText(/Coverage/i).first()).toBeVisible();
  37 | 
  38 |   await page.goto(`/editorial/diagnoses/${appendicitis!.id}`);
  39 |   await expect(page.getByText('Editorial Diagnosis Workspace')).toBeVisible();
  40 |   await expect(page.getByRole('heading', { name: /Appendicitis/i })).toBeVisible();
  41 |   await expect(page.getByText('Editorial copilot')).toBeVisible();
  42 |   await expect(page.getByText('Next editorial moves')).toBeVisible();
  43 | 
  44 |   for (const tab of [
  45 |     'Objectives',
  46 |     'Clinical Picture',
  47 |     'Teaching & Learning',
  48 |     'Cases',
  49 |     'Differential Map',
  50 |     'Overview',
  51 |   ]) {
  52 |     await page.getByRole('button', { name: tab }).click();
  53 |     await expect(page.getByRole('button', { name: tab })).toBeVisible();
  54 |   }
  55 | 
  56 |   await page.getByRole('button', { name: 'Cases' }).click();
  57 |   await expect(page.getByText('Case coverage explainability')).toBeVisible();
  58 |   await expect(
  59 |     page.getByRole('button', { name: /Strengthen|Remove|Toggle/ }).first(),
  60 |   ).toBeVisible();
  61 | });
  62 | 
```