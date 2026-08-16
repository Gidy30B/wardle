import { expect, type APIRequestContext, type Page, test } from '@playwright/test';

import {
  getLocalQaDiagnoses,
  type LocalQaDiagnosis,
} from './local-qa-api';

const apiUrl = (process.env.QA_API_URL ?? 'http://127.0.0.1:3000/api').replace(
  /\/$/,
  '',
);
const qaToken = process.env.VITE_LOCAL_QA_AUTH_TOKEN;
const preferredDiagnosisId = 'a82f8e98-e01e-4886-991e-d88599bfa92c';

test.skip(
  process.env.VITE_LOCAL_QA_AUTH_ENABLED !== 'true' || !qaToken,
  'Set VITE_LOCAL_QA_AUTH_ENABLED=true and VITE_LOCAL_QA_AUTH_TOKEN before running local QA tests.',
);

test.describe('editorial diagnosis workspace command matrix', () => {
  test('loads workspace with no hash', async ({ page, request }) => {
    const diagnosis = await resolveFixtureDiagnosis(request);

    await openWorkspace(page, diagnosis.id);

    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    await expectActiveTab(page, 'overview');
  });

  test('loads #case-inventory on the Cases tab', async ({ page, request }) => {
    const diagnosis = await resolveFixtureDiagnosis(request);

    await openWorkspace(page, diagnosis.id, 'case-inventory');

    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    await expectActiveTab(page, 'cases');
    await expectSectionVisible(page, 'case-inventory');
    await expectHash(page, 'case-inventory');
  });

  test('loads #evidence-graph on the Graph tab', async ({ page, request }) => {
    const diagnosis = await resolveFixtureDiagnosis(request);

    await openWorkspace(page, diagnosis.id, 'evidence-graph');

    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    await expectActiveTab(page, 'graph');
    await expectSectionVisible(page, 'evidence-graph');
    await expectHash(page, 'evidence-graph');
  });

  test('loads #education-publication-state on the Education tab', async ({
    page,
    request,
  }) => {
    const diagnosis = await resolveFixtureDiagnosis(request);

    await openWorkspace(page, diagnosis.id, 'education-publication-state');

    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    await expectActiveTab(page, 'education');
    await expectSectionVisible(page, 'education-publication-state');
    await expectHash(page, 'education-publication-state');
  });

  test('clicks a same-tab right rail command', async ({ page, request }) => {
    const diagnosis = await resolveFixtureDiagnosis(request);
    await openWorkspace(page, diagnosis.id);
    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    await page.getByTestId('workspace-tab-integrity').click();
    await expectActiveTab(page, 'integrity');

    await clickNavigationCommand(
      page,
      page.locator('[data-testid="workspace-rail-integrity-blockers"]:visible').first(),
    );
  });

  test('clicks a cross-tab right rail command', async ({ page, request }) => {
    const diagnosis = await resolveFixtureDiagnosis(request);
    await openWorkspace(page, diagnosis.id);
    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    await expectActiveTab(page, 'overview');

    await clickNavigationCommand(
      page,
      page.locator('[data-testid="workspace-rail-integrity-blockers"]:visible').first(),
    );
  });

  test('clicks Overview primary and recommended actions', async ({
    page,
    request,
  }, testInfo) => {
    const diagnosis = await resolveFixtureDiagnosis(request);
    await openWorkspace(page, diagnosis.id);
    await expectWorkspaceLoaded(page, diagnosis.displayLabel);

    const primary = page
      .locator('[data-testid="overview-primary-action"]:not([disabled])')
      .first();
    if (!(await primary.count())) {
      testInfo.annotations.push({
        type: 'skip-note',
        description: 'The selected fixture has no enabled Overview primary action.',
      });
      test.skip(true, 'No enabled Overview primary action for this fixture.');
    }

    await clickNavigationCommand(page, primary);

    await openWorkspace(page, diagnosis.id);
    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    const secondaryDisclosure = page.getByTestId('overview-secondary-actions');
    if (await secondaryDisclosure.isVisible()) {
      await secondaryDisclosure.click();
    }
    const recommended = page
      .locator('[data-testid^="overview-recommended-action-"]:not([disabled])')
      .first();
    if (!(await recommended.count())) {
      testInfo.annotations.push({
        type: 'skip-note',
        description: 'The selected fixture has no enabled Overview recommended action.',
      });
      test.skip(true, 'No enabled Overview recommended action for this fixture.');
    }

    await clickNavigationCommand(page, recommended);
  });

  test('restores tab and section with browser back/forward hash navigation', async ({
    page,
    request,
  }) => {
    const diagnosis = await resolveFixtureDiagnosis(request);

    await openWorkspace(page, diagnosis.id);
    await expectWorkspaceLoaded(page, diagnosis.displayLabel);

    await openWorkspace(page, diagnosis.id, 'case-inventory');
    await expectActiveTab(page, 'cases');
    await expectSectionVisible(page, 'case-inventory');

    await clickNavigationCommand(
      page,
      page.locator('[data-testid="workspace-rail-integrity-blockers"]:visible').first(),
    );

    await page.goBack();
    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    const backHash = await page.evaluate(() => window.location.hash);
    if (backHash === '#case-inventory') {
      await expectActiveTab(page, 'cases');
      await expectSectionVisible(page, 'case-inventory');
    } else {
      await expectActiveTab(page, 'overview');
    }

    await page.goForward();
    await expectActiveTab(page, 'integrity');
    await expectSectionVisible(page, 'integrity-blockers');
    await expectHash(page, 'integrity-blockers');
  });

  // This test validates that the onboarding-progress rail command in the legacy
  // editorial-brief right rail is always disabled. The command (rendered by
  // EditorialRightRail.tsx) has disabled: true and todo: 'TODO: add onboarding
  // anchor' because no section anchor is defined yet.
  //
  // The test auto-skips when the fixture diagnosis has 100 % onboarding completion
  // (all 6 components present: teaching rules, brief, education, cases, graph
  // facts, and no unresolved differentials). No QA seed data is added for this
  // test because the underlying anchor feature is unfinished; the test is an
  // opportunistic coverage guard that runs when a partially-complete fixture is
  // selected.
  test('keeps brief-onboarding-progress disabled when rendered', async ({
    page,
    request,
  }, testInfo) => {
    const diagnosis = await resolveFixtureDiagnosis(request);
    await openWorkspace(page, diagnosis.id);
    await expectWorkspaceLoaded(page, diagnosis.displayLabel);
    await page.getByTestId('workspace-tab-editorial-brief').click();
    await expectActiveTab(page, 'editorial-brief');

    const todo = page.getByTestId('workspace-rail-command-objectives-onboarding-progress');
    if (!(await todo.count())) {
      testInfo.annotations.push({
        type: 'skip-note',
        description:
          'The selected fixture does not render the brief-onboarding-progress TODO rail command.',
      });
      test.skip(true, 'brief-onboarding-progress TODO is not rendered for this fixture.');
    }

    await expect(todo).toBeDisabled();
    await expect(todo).toHaveAttribute('aria-disabled', 'true');
  });
});

type FixtureDiagnosis = LocalQaDiagnosis;

async function resolveFixtureDiagnosis(
  request: APIRequestContext,
): Promise<FixtureDiagnosis> {
  const diagnoses = await getLocalQaDiagnoses(request, apiUrl, qaToken ?? '');
  const diagnosis =
    diagnoses.find((item) => item.id === preferredDiagnosisId) ??
    diagnoses.find((item) => item.canonicalNormalized === 'siadh') ??
    diagnoses.find((item) => item.canonicalNormalized === 'appendicitis') ??
    diagnoses[0];

  expect(diagnosis, 'Local QA diagnosis fixture should exist').toBeTruthy();
  return diagnosis;
}

const SECTION_TAB: Record<string, string> = {
  'case-inventory': 'cases',
  'evidence-graph': 'graph',
  'education-publication-state': 'education',
};

async function openWorkspace(
  page: Page,
  diagnosisRegistryId: string,
  sectionId?: string,
) {
  const params = new URLSearchParams();
  params.set('workspaceShell', 'legacy');
  if (sectionId) {
    const tab = SECTION_TAB[sectionId];
    if (tab) params.set('tab', tab);
  }
  await page.goto(
    `/editorial/diagnoses/${diagnosisRegistryId}?${params.toString()}${sectionId ? `#${sectionId}` : ''}`,
  );
}

async function expectWorkspaceLoaded(page: Page, diagnosisName: string) {
  await expect(
    page.getByRole('heading', { level: 2, name: diagnosisName }),
  ).toBeVisible();
  await expect(page.getByTestId('workspace-tab-overview')).toBeVisible();
}

async function expectActiveTab(page: Page, tab: string) {
  await expect(page.getByTestId(`workspace-tab-${tab}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

async function expectSectionVisible(page: Page, sectionId: string) {
  await expect(page.locator(`#${sectionId}`)).toBeVisible();
}

async function expectHash(page: Page, sectionId: string) {
  await expect
    .poll(() => page.evaluate(() => window.location.hash), {
      message: `URL hash should resolve to #${sectionId}`,
    })
    .toBe(`#${sectionId}`);
}

async function clickNavigationCommand(
  page: Page,
  command: ReturnType<Page['locator']>,
) {
  await expect(command).toBeVisible();
  const targetTab = await command.getAttribute('data-target-tab');
  const targetSection = await command.getAttribute('data-target-section');
  expect(targetTab, 'command exposes target tab').toBeTruthy();
  expect(targetSection, 'command exposes target section').toBeTruthy();

  await command.click();

  await expectActiveTab(page, targetTab!);
  await expectSectionVisible(page, targetSection!);
  await expectHash(page, targetSection!);
  await expect(page.locator(`#${targetSection}`)).toHaveAttribute(
    'data-workspace-section-focus',
    'true',
    { timeout: 1200 },
  );
}
