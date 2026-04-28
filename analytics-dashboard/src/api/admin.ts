import type { ApiClient } from './client';
import type {
  AdminViewer,
  AttemptsOverTimePayload,
  CreateDiagnosisAndLinkPayload,
  CreateDiagnosisRegistryPayload,
  CreateDiagnosisRegistryResult,
  DashboardPayload,
  DiagnosisRegistrySearchItem,
  EditorialCaseDetail,
  EditorialCaseRevision,
  EditorialCasesQuery,
  EditorialCasesResponse,
  EditorialStatusSummary,
  GenerateCasesPayload,
  GenerateCasesResult,
  LinkCaseDiagnosisPayload,
  MarkCaseReadyToPublishResult,
  PublishResultsSummary,
  RestoreCaseRevisionResult,
  RerunCaseValidationResult,
  SearchDiagnosisRegistryQuery,
  StartCaseReviewResult,
  SubmitCaseReviewPayload,
  SubmitCaseReviewResult,
  UpdateCaseDiagnosisPayload,
  ValidationOutcomeSummary,
} from './admin.types';
export type * from './admin.types';

function withQuery(
  path: string,
  params?: Record<string, string | number | undefined>,
) {
  if (!params) {
    return path;
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function fetchAdminViewer(client: ApiClient) {
  return client.get<AdminViewer>('/auth/me');
}

export function fetchDashboard(client: ApiClient) {
  return client.get<DashboardPayload>('/analytics/dashboard');
}

export function fetchAttemptsOverTime(client: ApiClient) {
  return client.get<AttemptsOverTimePayload>('/analytics/attempts-over-time');
}

export function generateCases(client: ApiClient, payload: GenerateCasesPayload) {
  return client.post<GenerateCasesResult>('/admin/generate-cases', payload);
}

export function getEditorialStatusSummary(client: ApiClient) {
  return client.get<EditorialStatusSummary>('/admin/summary/editorial-statuses');
}

export function getValidationOutcomeSummary(client: ApiClient) {
  return client.get<ValidationOutcomeSummary>('/admin/summary/validation-outcomes');
}

export function getPublishResultsSummary(client: ApiClient) {
  return client.get<PublishResultsSummary>('/admin/summary/publish-results');
}

export function getEditorialCases(
  client: ApiClient,
  query: EditorialCasesQuery = {},
) {
  return client.get<EditorialCasesResponse>(
    withQuery('/admin/cases', {
      status: query.status,
      queue: query.queue,
      page: query.page,
      pageSize: query.pageSize,
    }),
  );
}

export function getEditorialCaseDetail(client: ApiClient, caseId: string) {
  return client.get<EditorialCaseDetail>(`/admin/cases/${caseId}`);
}

export function searchDiagnosisRegistry(
  client: ApiClient,
  query: SearchDiagnosisRegistryQuery = {},
) {
  return client.get<DiagnosisRegistrySearchItem[]>(
    withQuery('/admin/diagnosis-registry', {
      q: query.q,
      limit: query.limit,
      status: query.status,
    }),
  );
}

export function createDiagnosisRegistry(
  client: ApiClient,
  payload: CreateDiagnosisRegistryPayload,
) {
  return client.post<CreateDiagnosisRegistryResult>(
    '/admin/diagnosis-registry',
    payload,
  );
}

export function linkCaseDiagnosis(
  client: ApiClient,
  caseId: string,
  payload: LinkCaseDiagnosisPayload,
) {
  return client.post<EditorialCaseDetail>(
    `/admin/cases/${caseId}/diagnosis-link`,
    payload,
  );
}

export function updateCaseDiagnosis(
  client: ApiClient,
  caseId: string,
  payload: UpdateCaseDiagnosisPayload,
) {
  return client.patch<EditorialCaseDetail>(
    `/admin/cases/${caseId}/diagnosis`,
    payload,
  );
}

export function createAndLinkDiagnosis(
  client: ApiClient,
  caseId: string,
  payload: CreateDiagnosisAndLinkPayload,
) {
  return client.post<EditorialCaseDetail>(
    `/admin/cases/${caseId}/create-and-link-diagnosis`,
    payload,
  );
}

export function getEditorialCaseRevisions(client: ApiClient, caseId: string) {
  return client.get<EditorialCaseRevision[]>(`/admin/cases/${caseId}/revisions`);
}

export function rerunCaseValidation(client: ApiClient, caseId: string) {
  return client.post<RerunCaseValidationResult>(
    `/admin/cases/${caseId}/rerun-validation`,
  );
}

export function startCaseReview(client: ApiClient, caseId: string) {
  return client.post<StartCaseReviewResult>(`/admin/cases/${caseId}/start-review`);
}

export function submitCaseReview(
  client: ApiClient,
  caseId: string,
  payload: SubmitCaseReviewPayload,
) {
  return client.post<SubmitCaseReviewResult>(
    `/admin/cases/${caseId}/review`,
    payload,
  );
}

export function restoreCaseRevision(
  client: ApiClient,
  caseId: string,
  revisionId: string,
) {
  return client.post<RestoreCaseRevisionResult>(
    `/admin/cases/${caseId}/revisions/${revisionId}/restore`,
  );
}

export function markCaseReadyToPublish(client: ApiClient, caseId: string) {
  return client.post<MarkCaseReadyToPublishResult>(
    `/admin/cases/${caseId}/ready-to-publish`,
  );
}
