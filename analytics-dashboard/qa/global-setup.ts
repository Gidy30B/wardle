import { createHash } from 'node:crypto';
import { request } from '@playwright/test';

function fingerprint(token: string | undefined): string {
  if (!token) return '<absent>';
  return createHash('sha256').update(token).digest('hex');
}

export default async function globalSetup(): Promise<void> {
  const qaEnabled = process.env.VITE_LOCAL_QA_AUTH_ENABLED === 'true';
  const qaToken = process.env.VITE_LOCAL_QA_AUTH_TOKEN;
  const apiUrl = (process.env.QA_API_URL ?? 'http://127.0.0.1:3000/api').replace(
    /\/$/,
    '',
  );
  const endpoint = `${apiUrl}/auth/local-qa/diagnoses`;

  console.log('[local-qa preflight]', {
    enabled: qaEnabled,
    tokenPresent: Boolean(qaToken),
    tokenLength: qaToken?.length ?? 0,
    tokenSha256: fingerprint(qaToken),
    endpoint,
  });

  if (!qaEnabled || !qaToken) {
    throw new Error(
      'Local QA preflight failed: set VITE_LOCAL_QA_AUTH_ENABLED=true and provide VITE_LOCAL_QA_AUTH_TOKEN in the Playwright shell.',
    );
  }

  const context = await request.newContext();
  try {
    let response;
    let transportError = 'unknown transport error';
    for (let attempt = 1; attempt <= 15; attempt += 1) {
      try {
        response = await context.get(endpoint, {
          headers: { 'x-wardle-local-qa-token': qaToken },
        });
        break;
      } catch (error) {
        transportError = error instanceof Error ? error.message.split('\n')[0] : String(error);
        if (attempt < 15) {
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
      }
    }

    if (!response) {
      throw new Error(
        `Local QA preflight could not reach ${endpoint} after 15 attempts: ${transportError}`,
      );
    }

    const body = await response.text();

    if (response.ok()) return;

    if (response.status() === 401 && body.includes('Invalid local QA auth token')) {
      throw new Error(
        `Playwright token does not match backend token. URL: ${endpoint}; status: ${response.status()} ${response.statusText()}; body: ${body}`,
      );
    }

    if (response.status() === 401 && body.includes('Missing Clerk bearer token')) {
      throw new Error(
        `Local QA preflight failed: backend Local QA auth is disabled. Docker Compose did not supply LOCAL_QA_AUTH_ENABLED=true and LOCAL_QA_AUTH_TOKEN. URL: ${endpoint}; body: ${body}`,
      );
    }

    throw new Error(
      `Local QA preflight failed. URL: ${endpoint}; status: ${response.status()} ${response.statusText()}; body: ${body || '<empty>'}`,
    );
  } finally {
    await context.dispose();
  }
}
