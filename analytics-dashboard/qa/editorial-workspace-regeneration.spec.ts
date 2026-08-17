import { expect, test } from '@playwright/test';

import { getLocalQaDiagnoses, type LocalQaDiagnosis } from './local-qa-api';

const apiUrl = (process.env.QA_API_URL ?? 'http://127.0.0.1:3000/api').replace(
  /\/$/,
  '',
);
const qaToken = process.env.VITE_LOCAL_QA_AUTH_TOKEN;

test.skip(
  process.env.VITE_LOCAL_QA_AUTH_ENABLED !== 'true' || !qaToken,
  'Set VITE_LOCAL_QA_AUTH_ENABLED=true and VITE_LOCAL_QA_AUTH_TOKEN before running local QA regeneration tests.',
);

type SectionHealth = {
  section: string;
  regenerationRecommended: boolean;
};

type WorkspacePayload = {
  education: {
    sectionHealth?: SectionHealth[];
  };
};

type RegenCandidate = {
  diagnosis: LocalQaDiagnosis;
  section: SectionHealth;
};

test('default shell can regenerate differentials and clears recommendation', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);

  const diagnoses = await getLocalQaDiagnoses(request, apiUrl, qaToken ?? '');
  const candidate = await findDifferentialsRegenCandidate(
    request,
    diagnoses,
    qaToken ?? '',
  );

  expect(candidate, 'Expected a QA diagnosis with differentials regeneration recommended').toBeTruthy();
  const diagnosis = candidate!.diagnosis;
  const workspaceSnapshot = await getWorkspacePayload(
    request,
    diagnosis.id,
    qaToken ?? '',
  );

  let capturedBody: string | null = null;
  let capturedUrl: string | null = null;
  let workspaceFetchCount = 0;
  let forceClearedRecommendation = false;

  await page.route(
    `**/api/admin/diagnosis-workspace/${diagnosis.id}/full`,
    async (route) => {
      workspaceFetchCount += 1;
      const body = JSON.parse(JSON.stringify(workspaceSnapshot)) as WorkspacePayload;
      const sections = body.education.sectionHealth ?? [];
      const differentials = sections.find((section) => section.section === 'differentials');
      if (differentials) {
        differentials.regenerationRecommended = !forceClearedRecommendation;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    },
  );

  await page.route(
    `**/api/admin/education/diagnoses/${diagnosis.id}/regenerate-section`,
    async (route) => {
      const outgoingRequest = route.request();
      capturedBody = outgoingRequest.postData() ?? null;
      capturedUrl = outgoingRequest.url();
      forceClearedRecommendation = true;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    },
  );

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.goto(`/editorial/diagnoses/${diagnosis.id}`);
  await page.waitForLoadState('networkidle');

  await page.getByTestId('workspace-workflow-content').click();

  const regenerateButton = page.getByRole('button', {
    name: /Regenerate Differentials/i,
  });

  await expect(regenerateButton).toBeVisible();
  await regenerateButton.click();

  expect(capturedUrl).toContain(
    `/api/admin/education/diagnoses/${diagnosis.id}/regenerate-section`,
  );
  expect(capturedBody).toBe('{"section":"differentials"}');

  await expect
    .poll(
      async () => {
        return workspaceFetchCount;
      },
      {
        timeout: 20_000,
        intervals: [250, 500, 1_000],
      },
    )
    .toBeGreaterThanOrEqual(2);

  await expect(regenerateButton).toBeHidden();
});

async function findDifferentialsRegenCandidate(
  request: Parameters<typeof getDifferentialsSection>[0],
  diagnoses: LocalQaDiagnosis[],
  token: string,
): Promise<RegenCandidate | null> {
  for (const diagnosis of diagnoses) {
    const section = await getDifferentialsSection(request, diagnosis.id, token);
    if (section?.regenerationRecommended) {
      return { diagnosis, section };
    }
  }

  return null;
}

async function getDifferentialsSection(
  request: Parameters<typeof getLocalQaDiagnoses>[0],
  diagnosisRegistryId: string,
  token: string,
): Promise<SectionHealth | null> {
  const body = await getWorkspacePayload(request, diagnosisRegistryId, token);
  const sections = body.education.sectionHealth ?? [];
  return sections.find((section) => section.section === 'differentials') ?? null;
}

async function getWorkspacePayload(
  request: Parameters<typeof getLocalQaDiagnoses>[0],
  diagnosisRegistryId: string,
  token: string,
): Promise<WorkspacePayload> {
  const response = await request.get(
    `${apiUrl}/admin/diagnosis-workspace/${diagnosisRegistryId}/full`,
    {
      headers: { 'x-wardle-local-qa-token': token },
    },
  );

  expect(response.ok(), `Workspace request should succeed for ${diagnosisRegistryId}`).toBeTruthy();
  return (await response.json()) as WorkspacePayload;
}
