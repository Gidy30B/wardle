import type { APIRequestContext } from '@playwright/test';

export type LocalQaDiagnosis = {
  id: string;
  canonicalNormalized: string;
  displayLabel: string;
};

export async function getLocalQaDiagnoses(
  request: APIRequestContext,
  apiUrl: string,
  qaToken: string,
): Promise<LocalQaDiagnosis[]> {
  const requestedUrl = `${apiUrl.replace(/\/$/, '')}/auth/local-qa/diagnoses`;
  let response;
  try {
    response = await request.get(requestedUrl, {
      headers: { 'x-wardle-local-qa-token': qaToken },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new Error(`Local QA diagnoses request could not reach ${requestedUrl}: ${message}`);
  }
  const responseBody = await response.text();
  const responseHeaders = response.headers();

  if (!response.ok()) {
    throw new Error(
      [
        'Local QA diagnoses request failed.',
        `URL: ${response.url() || requestedUrl}`,
        `Status: ${response.status()} ${response.statusText()}`,
        `Response headers: ${JSON.stringify(responseHeaders, null, 2)}`,
        `Response body: ${responseBody || '<empty>'}`,
      ].join('\n'),
    );
  }

  try {
    const body = JSON.parse(responseBody) as {
      diagnoses?: LocalQaDiagnosis[];
    };

    if (!Array.isArray(body.diagnoses)) {
      throw new Error('Response JSON does not contain a diagnoses array.');
    }

    return body.diagnoses;
  } catch (error) {
    throw new Error(
      [
        'Local QA diagnoses response could not be parsed.',
        `URL: ${response.url() || requestedUrl}`,
        `Status: ${response.status()} ${response.statusText()}`,
        `Response headers: ${JSON.stringify(responseHeaders, null, 2)}`,
        `Response body: ${responseBody || '<empty>'}`,
        `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      ].join('\n'),
    );
  }
}
