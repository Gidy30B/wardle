import { expect, test } from '@playwright/test';

const apiUrl = (process.env.QA_API_URL ?? 'http://localhost:3000/api').replace(
  /\/$/,
  '',
);
const qaToken = process.env.VITE_LOCAL_QA_AUTH_TOKEN;

test.skip(
  process.env.VITE_LOCAL_QA_AUTH_ENABLED !== 'true' || !qaToken,
  'Set VITE_LOCAL_QA_AUTH_ENABLED=true and VITE_LOCAL_QA_AUTH_TOKEN before running local QA smoke tests.',
);

test('opens editorial coverage and seeded diagnosis workspace', async ({
  page,
  request,
}) => {
  const response = await request.get(`${apiUrl}/auth/local-qa/diagnoses`, {
    headers: { 'x-wardle-local-qa-token': qaToken ?? '' },
  });
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    diagnoses: Array<{
      id: string;
      canonicalNormalized: string;
      displayLabel: string;
    }>;
  };
  const appendicitis = body.diagnoses.find(
    (diagnosis) => diagnosis.canonicalNormalized === 'appendicitis',
  );
  expect(appendicitis, 'Appendicitis QA seed should exist').toBeTruthy();

  await page.goto('/editorial/coverage');
  await expect(page.getByText(/Coverage/i).first()).toBeVisible();

  await page.goto(`/editorial/diagnoses/${appendicitis!.id}`);
  await expect(page.getByText('Editorial Diagnosis Workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Appendicitis/i })).toBeVisible();
  await expect(page.getByText('Editorial copilot')).toBeVisible();
  await expect(page.getByText('Next editorial moves')).toBeVisible();

  for (const tab of [
    'Objectives',
    'Clinical Picture',
    'Teaching & Learning',
    'Cases',
    'Differential Map',
    'Overview',
  ]) {
    await page.getByRole('button', { name: tab }).click();
    await expect(page.getByRole('button', { name: tab })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Cases' }).click();
  await expect(page.getByText('Case coverage explainability')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Strengthen|Remove|Toggle/ }).first(),
  ).toBeVisible();
});
