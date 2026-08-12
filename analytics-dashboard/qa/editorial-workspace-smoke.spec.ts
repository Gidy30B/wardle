import { expect, test } from '@playwright/test';

import { getLocalQaDiagnoses } from './local-qa-api';

const apiUrl = (process.env.QA_API_URL ?? 'http://127.0.0.1:3000/api').replace(
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
  const diagnoses = await getLocalQaDiagnoses(request, apiUrl, qaToken ?? '');
  const appendicitis = diagnoses.find(
    (diagnosis) => diagnosis.canonicalNormalized === 'appendicitis',
  );
  expect(appendicitis, 'Appendicitis QA seed should exist').toBeTruthy();

  await page.goto('/editorial/coverage');
  await expect(page).toHaveURL(/\/editorial\/coverage$/);
  const coverageMain = page.getByRole('main');
  await expect(coverageMain).toHaveCount(1);
  await expect(coverageMain).toBeVisible();
  await expect(
    coverageMain.getByRole('heading', {
      level: 1,
      name: 'Editorial coverage cockpit',
    }),
  ).toBeVisible();

  // Default URL renders the workflow shell (ReviewQueue workflow)
  await page.goto(`/editorial/diagnoses/${appendicitis!.id}`);
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: appendicitis!.displayLabel,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Editorial workflow navigation' }),
  ).toBeVisible();
  await expect(page.getByTestId('workspace-workflow-reviewQueue')).toBeVisible();
  await expect(page.getByTestId('workspace-workflow-reviewQueue')).toHaveAttribute(
    'aria-current',
    'page',
  );

  // All 7 workflow nav items are present
  for (const workflowId of [
    'reviewQueue',
    'overview',
    'teaching',
    'reasoning',
    'cases',
    'content',
    'publish',
  ]) {
    await expect(page.getByTestId(`workspace-workflow-${workflowId}`)).toBeVisible();
  }

  // Switching workflows updates aria-current
  await page.getByTestId('workspace-workflow-overview').click();
  await expect(page.getByTestId('workspace-workflow-overview')).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByTestId('workspace-workflow-publish').click();
  await expect(page.getByTestId('workspace-workflow-publish')).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Legacy escape: ?workspaceShell=legacy restores the tab UI
  await page.goto(`/editorial/diagnoses/${appendicitis!.id}?workspaceShell=legacy`);
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: appendicitis!.displayLabel,
    }),
  ).toBeVisible();
  await expect(page.getByTestId('workspace-tab-overview')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('workspace-tab-cases')).toBeVisible();

  await page.getByTestId('workspace-tab-cases').click();
  await expect(page.getByTestId('workspace-tab-cases')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#case-inventory')).toBeVisible();
  await expect(
    page.getByTestId('case-coverage-annotation-controls'),
  ).toBeVisible();
});

test('coverage page workspace links route correctly', async ({ page, request }) => {
  const diagnoses = await getLocalQaDiagnoses(request, apiUrl, qaToken ?? '');
  expect(diagnoses.length).toBeGreaterThan(0);

  await page.goto('/editorial/coverage');
  await page.waitForLoadState('networkidle');

  // No workspace link should use the old redundant workspaceShell=workflow param
  const allWorkspaceLinks = page.locator('a[href*="/editorial/diagnoses/"]');
  const total = await allWorkspaceLinks.count();
  for (let i = 0; i < total; i++) {
    const href = (await allWorkspaceLinks.nth(i).getAttribute('href')) ?? '';
    expect(href, 'workspace link must not include workspaceShell=workflow').not.toContain(
      'workspaceShell=workflow',
    );
  }

  // Claim-repair links must carry workspaceShell=legacy and tab=integrity
  const claimLinks = page.locator(
    'a[href*="/editorial/diagnoses/"][href*="workspaceShell=legacy"]',
  );
  const claimCount = await claimLinks.count();
  for (let i = 0; i < claimCount; i++) {
    const href = (await claimLinks.nth(i).getAttribute('href')) ?? '';
    expect(href).toContain('workspaceShell=legacy');
    expect(href).toContain('tab=integrity');
  }

  // A regular workspace link (no workspaceShell param) must open the workflow shell
  const regularLinks = page.locator(
    'a[href*="/editorial/diagnoses/"]:not([href*="workspaceShell"])',
  );
  if ((await regularLinks.count()) > 0) {
    const firstHref = (await regularLinks.first().getAttribute('href')) ?? '';
    expect(firstHref).not.toContain('workspaceShell');

    await regularLinks.first().click();
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('navigation', { name: 'Editorial workflow navigation' }),
    ).toBeVisible();
    expect(page.url()).not.toContain('workspaceShell');
  }
});
