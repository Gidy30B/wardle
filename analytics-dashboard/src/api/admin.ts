import type { ApiClient } from './client';
import type {
  AdminViewer,
  AddDiagnosisAliasPayload,
  AdminDiagnosisEducationResponse,
  DiagnosisGraphCandidate,
  DiagnosisGraphCandidateFilters,
  AttemptsOverTimePayload,
  CreateDiagnosisAndLinkPayload,
  CreateDiagnosisRegistryPayload,
  CreateDiagnosisRegistryResult,
  CreateRegistryFromCandidateResult,
  CreateRegistryCandidatePayload,
  DashboardPayload,
  DiagnosisEditorialBrief,
  DiagnosisEditorialOnboarding,
  DiagnosisEditorialOnboardingAction,
  DiagnosisEditorialOnboardingSummary,
  EditorialCoverageDiagnosis,
  EditorialCoverageFilters,
  EditorialCoverageOverview,
  EditorialCoverageSpecialty,
  EvidenceCoverageDiagnosis,
  EvidenceCoverageFilters,
  EvidenceCoverageOverview,
  CurriculumPlannerDiagnosis,
  CurriculumPlannerFilters,
  CurriculumPlannerOverview,
  CurriculumTrack,
  DiagnosisEditorialWorkspace,
  DiagnosisRegistryLifecycleAction,
  DiagnosisRegistryLifecycleActionResult,
  DiagnosisRegistryLifecycleReport,
  DiagnosisRegistryMetadataSuggestion,
  AiDiagnosisRegistryMetadataSuggestionResponse,
  GenerateAiDiagnosisRegistryMetadataSuggestionPayload,
  DiagnosisEditorialBriefResponse,
  DiagnosisEditorialBriefReviewAction,
  DiagnosisEditorialBriefWritePayload,
  DiagnosisTeachingRule,
  DiagnosisTeachingRelationship,
  DiagnosisTeachingRelationshipGenerateResult,
  DiagnosisTeachingRelationshipReviewAction,
  ReasoningPath,
  ReasoningPathGenerateResult,
  ReasoningPathGenerationContext,
  ReasoningPathReviewAction,
  ReasoningDraftValidationFilters,
  ReasoningDraftValidationRun,
  DiagnosisEvidenceRelationship,
  EvidenceGraphGenerateResult,
  EvidenceGraphReviewAction,
  DiagnosisTeachingRuleGenerateResult,
  DiagnosisTeachingRuleReviewAction,
  DiagnosisTeachingRulesResponse,
  DiagnosisTeachingRuleSeedResult,
  DiagnosisTeachingRuleWritePayload,
  DiagnosisWorkspaceProjection,
  DiagnosisWorkspaceQualitySummary,
  DiagnosisEducationRevisionAnalysis,
  DiagnosisEducationRevisionCompareResult,
  DiagnosisEducationRevisionListResponse,
  DifferentialMappingFilters,
  DifferentialMappingReviewItem,
  DiagnosisRegistryCandidate,
  DiagnosisRegistryCandidateQueueSummary,
  RegistryCandidateFilters,
  RegistryMergeAnalysis,
  CompleteDuplicateKeeperPayload,
  CompleteDuplicateKeeperResult,
  RegistryMergeAnalysisPayload,
  RegistryMergeExecutePayload,
  RegistryMergeExecutionResult,
  RegistryLifecycleNormalizeResult,
  RegistryLifecycleTelemetry,
  RegistryMergeRelated,
  DiagnosisRegistrySearchItem,
  EditorialInboxQuery,
  EditorialInboxResponse,
  EditorialCaseDetail,
  EditorialCaseRevision,
  EditorialCasesQuery,
  EditorialCasesResponse,
  EditorialStatusSummary,
  GenerateCasesPayload,
  GenerateCasesResult,
  GenerateClueRevisionProposalPayload,
  GenerateTargetedCasePayload,
  GenerateTargetedDiscriminatorCasePayload,
  GenerateTargetedCaseResult,
  CaseInventoryHealth,
  AiDraftDecisionAction,
  AiDraftRevisionAudit,
  CaseEscalationAnnotationPayload,
  CaseClueDiscriminatorAnnotation,
  CreateCaseClueDiscriminatorAnnotationPayload,
  CaseLearningGoalCoveragePayload,
  ClaimRepairResult,
  LinkCaseDiagnosisPayload,
  MarkCaseReadyToPublishResult,
  PublishResultsSummary,
  RestoreCaseRevisionResult,
  RerunCaseValidationResult,
  SearchDiagnosisRegistryQuery,
  StartCaseReviewResult,
  SubmitCaseReviewPayload,
  SubmitCaseReviewResult,
  TeachingUnitCoverageMap,
  ReviewDiagnosisEducationPayload,
  RegenerateEducationSectionPayload,
  RejectDiagnosisGraphCandidatePayload,
  MergeDiagnosisGraphCandidatePayload,
  ResolveMimicCandidatePayload,
  ResolveDifferentialMappingPayload,
  ReviewRegistryCandidatePayload,
  UnresolvedMimicCandidate,
  UpdateCaseDiagnosisPayload,
  UpdateCaseClueDiscriminatorAnnotationPayload,
  UpdateDiagnosisRegistryMetadataPayload,
  UpsertDiagnosisEducationPayload,
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

export function getDiagnosisGraphCandidates(
  client: ApiClient,
  filters: DiagnosisGraphCandidateFilters = {},
) {
  return client.get<DiagnosisGraphCandidate[]>(
    withQuery('/admin/diagnosis-graph/candidates', {
      diagnosisRegistryId: filters.diagnosisRegistryId,
      type: filters.type,
      status: filters.status,
      sourceType: filters.sourceType,
    }),
  );
}

export function getUnresolvedMimicCandidates(client: ApiClient) {
  return client.get<UnresolvedMimicCandidate[]>(
    '/admin/diagnosis-graph/candidates/unresolved-mimics',
  );
}

export function getUnresolvedDifferentialMappings(
  client: ApiClient,
  filters: DifferentialMappingFilters = {},
) {
  return client.get<DifferentialMappingReviewItem[]>(
    withQuery('/admin/differential-mappings/unresolved', {
      sourceType: filters.sourceType,
      diagnosisRegistryId: filters.diagnosisRegistryId,
      status: filters.status,
    }),
  );
}

export function resolveDifferentialMapping(
  client: ApiClient,
  id: string,
  payload: ResolveDifferentialMappingPayload,
) {
  return client.post(`/admin/differential-mappings/${id}/resolve`, payload);
}

export function createRegistryCandidateFromDifferentialMapping(
  client: ApiClient,
  id: string,
  payload: CreateRegistryCandidatePayload = {},
) {
  return client.post<DiagnosisRegistryCandidate>(
    `/admin/differential-mappings/${id}/create-registry-candidate`,
    payload,
  );
}

export function getDiagnosisRegistryCandidates(
  client: ApiClient,
  filters: RegistryCandidateFilters = {},
) {
  return client.get<DiagnosisRegistryCandidate[]>(
    withQuery('/admin/diagnosis-registry/candidates', {
      status: filters.status,
      limit: filters.limit,
      showResolved: filters.showResolved ? 'true' : undefined,
    }),
  );
}

export function getDiagnosisRegistryCandidate(client: ApiClient, id: string) {
  return client.get<DiagnosisRegistryCandidate>(
    `/admin/diagnosis-registry/candidates/${id}`,
  );
}

export function getDiagnosisRegistryCandidateSummary(client: ApiClient) {
  return client.get<DiagnosisRegistryCandidateQueueSummary>(
    '/admin/diagnosis-registry/candidates/summary',
  );
}

export function getDiagnosisRegistryOnboardingSummary(client: ApiClient) {
  return client.get<DiagnosisEditorialOnboardingSummary>(
    '/admin/diagnosis-registry/onboarding/summary',
  );
}

export function getDiagnosisRegistryOnboarding(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisEditorialOnboarding>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/onboarding`,
  );
}

export function getDiagnosisRegistryLifecycle(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisRegistryLifecycleReport>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/lifecycle`,
  );
}

export function getDiagnosisRegistryLifecycleTelemetry(client: ApiClient) {
  return client.get<RegistryLifecycleTelemetry>(
    '/admin/diagnosis-registry/lifecycle/telemetry',
  );
}

export function normalizeDiagnosisRegistryLifecycle(client: ApiClient) {
  return client.post<RegistryLifecycleNormalizeResult>(
    '/admin/diagnosis-registry/lifecycle/normalize',
  );
}

export function normalizeDiagnosisRegistryLifecycleRow(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.post<RegistryLifecycleNormalizeResult>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/lifecycle/normalize`,
  );
}

export function updateDiagnosisRegistryLifecycle(
  client: ApiClient,
  diagnosisRegistryId: string,
  action: DiagnosisRegistryLifecycleAction,
  payload: { isGeneratable?: boolean } = {},
) {
  return client.post<DiagnosisRegistryLifecycleActionResult>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/lifecycle/action`,
    { action, ...payload },
  );
}

export function getDiagnosisRegistryMetadataSuggestions(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisRegistryMetadataSuggestion>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/metadata-suggestions`,
  );
}

export function generateDiagnosisRegistryAiMetadataSuggestion(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: GenerateAiDiagnosisRegistryMetadataSuggestionPayload = {
    includeAliases: true,
    includeMetadata: true,
  },
) {
  return client.post<AiDiagnosisRegistryMetadataSuggestionResponse>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/metadata-suggestions/generate-ai`,
    payload,
  );
}

export function updateDiagnosisRegistryMetadata(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: UpdateDiagnosisRegistryMetadataPayload,
) {
  return client.patch(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/metadata`,
    payload,
  );
}

export function addDiagnosisAlias(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: AddDiagnosisAliasPayload,
) {
  return client.post(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/aliases`,
    payload,
  );
}

export function analyzeDiagnosisRegistryMerge(
  client: ApiClient,
  payload: RegistryMergeAnalysisPayload,
) {
  return client.post<RegistryMergeAnalysis>(
    '/admin/diagnosis-registry/merge/analyze',
    payload,
  );
}

export function executeDiagnosisRegistryMerge(
  client: ApiClient,
  payload: RegistryMergeExecutePayload,
) {
  return client.post<RegistryMergeExecutionResult>(
    '/admin/diagnosis-registry/merge/execute',
    payload,
  );
}

export function completeDuplicateKeeper(
  client: ApiClient,
  payload: CompleteDuplicateKeeperPayload,
) {
  return client.post<CompleteDuplicateKeeperResult>(
    '/admin/diagnosis-registry/merge/complete-duplicate-keeper',
    payload,
  );
}

export function getDiagnosisRegistryMergeRelated(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<RegistryMergeRelated>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/merge-related`,
  );
}

export function updateDiagnosisRegistryOnboardingStatus(
  client: ApiClient,
  diagnosisRegistryId: string,
  action: DiagnosisEditorialOnboardingAction,
) {
  return client.post<DiagnosisEditorialOnboarding>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/onboarding/update-status`,
    { action },
  );
}

export function createRegistryFromCandidate(client: ApiClient, id: string) {
  return client.post<CreateRegistryFromCandidateResult>(
    `/admin/diagnosis-registry/candidates/${id}/create-registry`,
  );
}

export function reviewDiagnosisRegistryCandidate(
  client: ApiClient,
  id: string,
  payload: ReviewRegistryCandidatePayload,
) {
  return client.post<DiagnosisRegistryCandidate>(
    `/admin/diagnosis-registry/candidates/${id}/review`,
    payload,
  );
}

export function approveDiagnosisGraphCandidate(client: ApiClient, id: string) {
  return client.post(`/admin/diagnosis-graph/candidates/${id}/approve`);
}

export function rejectDiagnosisGraphCandidate(
  client: ApiClient,
  id: string,
  payload: RejectDiagnosisGraphCandidatePayload,
) {
  return client.post(`/admin/diagnosis-graph/candidates/${id}/reject`, payload);
}

export function mergeDiagnosisGraphCandidate(
  client: ApiClient,
  id: string,
  payload: MergeDiagnosisGraphCandidatePayload,
) {
  return client.post(`/admin/diagnosis-graph/candidates/${id}/merge`, payload);
}

export function resolveMimicCandidate(
  client: ApiClient,
  id: string,
  payload: ResolveMimicCandidatePayload,
) {
  return client.post(
    `/admin/diagnosis-graph/candidates/${id}/resolve-mimic`,
    payload,
  );
}

export function generateDiagnosisTeachingRelationshipCandidates(
  client: ApiClient,
  diagnosisRegistryId?: string,
) {
  return client.post<DiagnosisTeachingRelationshipGenerateResult>(
    '/admin/diagnosis-teaching-relationships/candidates/generate',
    { diagnosisRegistryId },
  );
}

export function reviewDiagnosisTeachingRelationship(
  client: ApiClient,
  id: string,
  action: DiagnosisTeachingRelationshipReviewAction,
) {
  return client.post<DiagnosisTeachingRelationship>(
    `/admin/diagnosis-teaching-relationships/${id}/review`,
    { action },
  );
}

export function generateReasoningPathCandidates(
  client: ApiClient,
  diagnosisRegistryId?: string,
) {
  return client.post<ReasoningPathGenerateResult>(
    '/admin/reasoning-paths/candidates/generate',
    { diagnosisRegistryId },
  );
}

export function reviewReasoningPath(
  client: ApiClient,
  id: string,
  action: ReasoningPathReviewAction,
) {
  return client.post<ReasoningPath>(`/admin/reasoning-paths/${id}/review`, {
    action,
  });
}

export function getReasoningPathGenerationContext(
  client: ApiClient,
  reasoningPathId: string,
) {
  return client.get<ReasoningPathGenerationContext>(
    `/admin/reasoning-paths/${reasoningPathId}/generation-context`,
  );
}

export function getReasoningDraftValidationRuns(
  client: ApiClient,
  filters: ReasoningDraftValidationFilters = {},
) {
  return client.get<ReasoningDraftValidationRun[]>(
    withQuery('/admin/reasoning-draft-validation', {
      artifactType: filters.artifactType || undefined,
      diagnosisRegistryId: filters.diagnosisRegistryId,
      trustTier: filters.trustTier || undefined,
      validationStatus: filters.validationStatus || undefined,
      limit: filters.limit,
    }),
  );
}

export function runReasoningDraftValidation(
  client: ApiClient,
  payload: { artifactType: string; artifactId: string },
) {
  return client.post<ReasoningDraftValidationRun>(
    '/admin/reasoning-draft-validation/run',
    payload,
  );
}

export function getDiagnosisTeachingRelationships(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisTeachingRelationship[]>(
    `/admin/diagnosis-registry/${diagnosisRegistryId}/teaching-relationships`,
  );
}

export function generateEvidenceGraphCandidates(
  client: ApiClient,
  diagnosisRegistryId?: string,
) {
  return client.post<EvidenceGraphGenerateResult>(
    '/admin/evidence-graph/candidates/generate',
    { diagnosisRegistryId },
  );
}

export function reviewEvidenceGraphRelationship(
  client: ApiClient,
  id: string,
  action: EvidenceGraphReviewAction,
) {
  return client.post<DiagnosisEvidenceRelationship>(
    `/admin/evidence-graph/relationships/${id}/review`,
    { action },
  );
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

export function generateCases(
  client: ApiClient,
  payload: GenerateCasesPayload,
) {
  return client.post<GenerateCasesResult>('/admin/generate-cases', payload);
}

export function getEditorialStatusSummary(client: ApiClient) {
  return client.get<EditorialStatusSummary>(
    '/admin/summary/editorial-statuses',
  );
}

export function getValidationOutcomeSummary(client: ApiClient) {
  return client.get<ValidationOutcomeSummary>(
    '/admin/summary/validation-outcomes',
  );
}

export function getPublishResultsSummary(client: ApiClient) {
  return client.get<PublishResultsSummary>('/admin/summary/publish-results');
}

export function getCaseInventoryHealth(client: ApiClient) {
  return client.get<CaseInventoryHealth>('/admin/cases/inventory-health');
}

export function getEditorialInbox(
  client: ApiClient,
  query: EditorialInboxQuery = {},
) {
  return client.get<EditorialInboxResponse>(
    withQuery('/admin/editorial/inbox', {
      type: query.type || undefined,
      severity: query.severity || undefined,
      status: query.status || undefined,
      specialty: query.specialty || undefined,
      limit: query.limit,
      page: query.page,
    }),
  );
}

export function getEditorialCoverageOverview(
  client: ApiClient,
  filters: EditorialCoverageFilters = {},
) {
  return client.get<EditorialCoverageOverview>(
    withQuery('/admin/editorial/coverage/overview', {
      specialty: filters.specialty || undefined,
      lifecycleState: filters.lifecycleState || undefined,
      onboardingState: filters.onboardingState || undefined,
      coverageWeakness: filters.coverageWeakness || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
}

export function getEditorialCoverageDiagnoses(
  client: ApiClient,
  filters: EditorialCoverageFilters = {},
) {
  return client.get<EditorialCoverageDiagnosis[]>(
    withQuery('/admin/editorial/coverage/diagnoses', {
      specialty: filters.specialty || undefined,
      lifecycleState: filters.lifecycleState || undefined,
      onboardingState: filters.onboardingState || undefined,
      coverageWeakness: filters.coverageWeakness || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
}

export function getEditorialCoverageSpecialties(
  client: ApiClient,
  filters: EditorialCoverageFilters = {},
) {
  return client.get<EditorialCoverageSpecialty[]>(
    withQuery('/admin/editorial/coverage/specialties', {
      specialty: filters.specialty || undefined,
      lifecycleState: filters.lifecycleState || undefined,
      onboardingState: filters.onboardingState || undefined,
      coverageWeakness: filters.coverageWeakness || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
}

export function getEvidenceCoverageOverview(
  client: ApiClient,
  filters: EvidenceCoverageFilters = {},
) {
  return client.get<EvidenceCoverageOverview>(
    withQuery('/admin/evidence-coverage/overview', {
      specialty: filters.specialty || undefined,
      evidenceWeakness: filters.evidenceWeakness || undefined,
      readinessTier: filters.readinessTier || undefined,
      onboardingStatus: filters.onboardingStatus || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
}

export function getEvidenceCoverageDiagnoses(
  client: ApiClient,
  filters: EvidenceCoverageFilters = {},
) {
  return client.get<EvidenceCoverageDiagnosis[]>(
    withQuery('/admin/evidence-coverage/diagnoses', {
      specialty: filters.specialty || undefined,
      evidenceWeakness: filters.evidenceWeakness || undefined,
      readinessTier: filters.readinessTier || undefined,
      onboardingStatus: filters.onboardingStatus || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
}

export function getEvidenceCoverageDiagnosis(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<EvidenceCoverageDiagnosis>(
    `/admin/evidence-coverage/${diagnosisRegistryId}`,
  );
}

export function getCurriculumPlannerOverview(
  client: ApiClient,
  filters: CurriculumPlannerFilters = {},
) {
  return client.get<CurriculumPlannerOverview>(
    withQuery('/admin/editorial/planner/overview', {
      specialty: filters.specialty || undefined,
      onboardingStatus:
        filters.onboardingStatus || filters.onboardingState || undefined,
      lifecycleState: filters.lifecycleState || undefined,
      lifecycleReadiness: filters.lifecycleReadiness || undefined,
      priorityTier: filters.priorityTier || undefined,
      track: filters.track || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
}

export function getCurriculumPlannerDiagnoses(
  client: ApiClient,
  filters: CurriculumPlannerFilters = {},
) {
  return client.get<CurriculumPlannerDiagnosis[]>(
    withQuery('/admin/editorial/planner/diagnoses', {
      specialty: filters.specialty || undefined,
      onboardingStatus:
        filters.onboardingStatus || filters.onboardingState || undefined,
      lifecycleState: filters.lifecycleState || undefined,
      lifecycleReadiness: filters.lifecycleReadiness || undefined,
      priorityTier: filters.priorityTier || undefined,
      track: filters.track || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
}

export function getCurriculumPlannerTracks(
  client: ApiClient,
  filters: CurriculumPlannerFilters = {},
) {
  return client.get<CurriculumTrack[]>(
    withQuery('/admin/editorial/planner/tracks', {
      specialty: filters.specialty || undefined,
      onboardingStatus:
        filters.onboardingStatus || filters.onboardingState || undefined,
      lifecycleState: filters.lifecycleState || undefined,
      lifecycleReadiness: filters.lifecycleReadiness || undefined,
      priorityTier: filters.priorityTier || undefined,
      track: filters.track || undefined,
      playableOnly: filters.playableOnly ? 'true' : undefined,
    }),
  );
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

export function getDiagnosisEducationForAdmin(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<AdminDiagnosisEducationResponse>(
    `/admin/education/diagnoses/${diagnosisRegistryId}`,
  );
}

export function getDiagnosisWorkspaceProjection(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisWorkspaceProjection>(
    `/admin/education/diagnoses/${diagnosisRegistryId}/workspace`,
  );
}

export function getDiagnosisWorkspaceQualitySummary(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisWorkspaceQualitySummary>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}`,
  );
}

export function getDiagnosisEditorialWorkspace(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisEditorialWorkspace>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/full`,
  );
}

export function getDiagnosisTeachingUnitCoverage(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<TeachingUnitCoverageMap>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/teaching-units`,
  );
}

export function getDiagnosisEditorialBrief(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisEditorialBriefResponse>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/editorial-brief`,
  );
}

export function generateDiagnosisEditorialBrief(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.post<DiagnosisEditorialBrief>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/editorial-brief/generate`,
  );
}

export function createDiagnosisEditorialBrief(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: DiagnosisEditorialBriefWritePayload,
) {
  return client.post<DiagnosisEditorialBrief>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/editorial-brief`,
    payload,
  );
}

export function updateDiagnosisEditorialBrief(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: DiagnosisEditorialBriefWritePayload,
) {
  return client.patch<DiagnosisEditorialBrief>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/editorial-brief`,
    payload,
  );
}

export function reviewDiagnosisEditorialBrief(
  client: ApiClient,
  diagnosisRegistryId: string,
  action: DiagnosisEditorialBriefReviewAction,
) {
  return client.post<DiagnosisEditorialBrief>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/editorial-brief/review`,
    { action },
  );
}

export function generateTargetedDiagnosisCase(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: GenerateTargetedCasePayload,
) {
  return client.post<GenerateTargetedCaseResult>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/generate-case`,
    payload,
  );
}

export function generateCaseFromUncoveredGoal(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: GenerateTargetedCasePayload,
) {
  return client.post<{ action: string; publicationStatus: 'draft'; result: GenerateTargetedCaseResult }>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/draft-actions/generate-case-from-goal`,
    payload,
  );
}

export function generateTargetedDiscriminatorCaseDraft(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: GenerateTargetedDiscriminatorCasePayload,
) {
  return client.post<{ action: string; publicationStatus: 'draft'; result: GenerateTargetedCaseResult; audit: AiDraftRevisionAudit }>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/draft-actions/generate-discriminator-case`,
    payload,
  );
}

export function generateClueRevisionProposalDraft(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: GenerateClueRevisionProposalPayload,
) {
  return client.post<{ action: string; publicationStatus: 'draft'; proposal: unknown; audit: AiDraftRevisionAudit }>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/draft-actions/generate-clue-revision`,
    payload,
  );
}

export function repairUnsupportedClaimDraft(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: { claimId: string },
) {
  return client.post<ClaimRepairResult>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/claims/${payload.claimId}/repair`,
  );
}

export function strengthenDifferentialDraft(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.post(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/draft-actions/strengthen-differential`,
  );
}

export function suggestTeachingDistinctionDraft(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.post(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/draft-actions/suggest-teaching-distinction`,
  );
}

export function decideAiDraftRevision(
  client: ApiClient,
  diagnosisRegistryId: string,
  auditId: string,
  action: AiDraftDecisionAction,
  payload: { note?: string | null } = {},
) {
  return client.post<AiDraftRevisionAudit>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/ai-drafts/${auditId}/${action}`,
    payload,
  );
}

export function createCaseLearningGoalCoverage(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: CaseLearningGoalCoveragePayload,
) {
  return client.post(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/case-learning-goal-coverage`,
    payload,
  );
}

export function updateCaseLearningGoalCoverage(
  client: ApiClient,
  diagnosisRegistryId: string,
  coverageId: string,
  payload: CaseLearningGoalCoveragePayload,
) {
  return client.patch(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/case-learning-goal-coverage/${coverageId}`,
    payload,
  );
}

export function deleteCaseLearningGoalCoverage(
  client: ApiClient,
  diagnosisRegistryId: string,
  coverageId: string,
) {
  return client.delete(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/case-learning-goal-coverage/${coverageId}`,
  );
}

export function createCaseEscalationAnnotation(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: CaseEscalationAnnotationPayload,
) {
  return client.post(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/case-escalation-annotations`,
    payload,
  );
}

export function updateCaseEscalationAnnotation(
  client: ApiClient,
  diagnosisRegistryId: string,
  annotationId: string,
  payload: CaseEscalationAnnotationPayload,
) {
  return client.patch(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/case-escalation-annotations/${annotationId}`,
    payload,
  );
}

export function deleteCaseEscalationAnnotation(
  client: ApiClient,
  diagnosisRegistryId: string,
  annotationId: string,
) {
  return client.delete(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/case-escalation-annotations/${annotationId}`,
  );
}

export function listCaseDiscriminatorAnnotations(
  client: ApiClient,
  caseId: string,
) {
  return client.get<CaseClueDiscriminatorAnnotation[]>(
    `/admin/cases/${caseId}/discriminator-annotations`,
  );
}

export function createCaseDiscriminatorAnnotation(
  client: ApiClient,
  caseId: string,
  payload: CreateCaseClueDiscriminatorAnnotationPayload,
) {
  return client.post<CaseClueDiscriminatorAnnotation>(
    `/admin/cases/${caseId}/discriminator-annotations`,
    payload,
  );
}

export function updateCaseDiscriminatorAnnotation(
  client: ApiClient,
  caseId: string,
  annotationId: string,
  payload: UpdateCaseClueDiscriminatorAnnotationPayload,
) {
  return client.patch<CaseClueDiscriminatorAnnotation>(
    `/admin/cases/${caseId}/discriminator-annotations/${annotationId}`,
    payload,
  );
}

export function deleteCaseDiscriminatorAnnotation(
  client: ApiClient,
  caseId: string,
  annotationId: string,
) {
  return client.delete(
    `/admin/cases/${caseId}/discriminator-annotations/${annotationId}`,
  );
}

export function getDiagnosisTeachingRules(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisTeachingRulesResponse>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/teaching-rules`,
  );
}

export function createDiagnosisTeachingRule(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: DiagnosisTeachingRuleWritePayload,
) {
  return client.post<DiagnosisTeachingRule>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/teaching-rules`,
    payload,
  );
}

export function generateDiagnosisTeachingRuleCandidates(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.post<DiagnosisTeachingRuleGenerateResult>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/teaching-rules/generate`,
  );
}

export function seedLegacyDiagnosisTeachingRules(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.post<DiagnosisTeachingRuleSeedResult>(
    `/admin/diagnosis-workspace/${diagnosisRegistryId}/teaching-rules/seed-legacy`,
  );
}

export function updateDiagnosisTeachingRule(
  client: ApiClient,
  ruleId: string,
  payload: DiagnosisTeachingRuleWritePayload,
) {
  return client.patch<DiagnosisTeachingRule>(
    `/admin/teaching-rules/${ruleId}`,
    payload,
  );
}

export function reviewDiagnosisTeachingRule(
  client: ApiClient,
  ruleId: string,
  action: DiagnosisTeachingRuleReviewAction,
) {
  return client.post<DiagnosisTeachingRule>(
    `/admin/teaching-rules/${ruleId}/review`,
    { action },
  );
}

export function getDiagnosisEducationRevisions(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.get<DiagnosisEducationRevisionListResponse>(
    `/admin/education/diagnoses/${diagnosisRegistryId}/revisions`,
  );
}

export function getDiagnosisEducationRevision(
  client: ApiClient,
  diagnosisRegistryId: string,
  version: number,
) {
  return client.get<DiagnosisEducationRevisionAnalysis>(
    `/admin/education/diagnoses/${diagnosisRegistryId}/revisions/${version}`,
  );
}

export function compareDiagnosisEducationRevisions(
  client: ApiClient,
  diagnosisRegistryId: string,
  v1: number,
  v2: number,
) {
  return client.get<DiagnosisEducationRevisionCompareResult>(
    withQuery(
      `/admin/education/diagnoses/${diagnosisRegistryId}/revisions/compare`,
      { v1, v2 },
    ),
  );
}

export function createDiagnosisEducationForAdmin(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: UpsertDiagnosisEducationPayload,
) {
  return client.post(
    `/admin/education/diagnoses/${diagnosisRegistryId}`,
    payload,
  );
}

export function generateDiagnosisEducationDraft(
  client: ApiClient,
  diagnosisRegistryId: string,
) {
  return client.post(
    `/admin/education/diagnoses/${diagnosisRegistryId}/generate`,
  );
}

export function regenerateDiagnosisEducationSection(
  client: ApiClient,
  diagnosisRegistryId: string,
  payload: RegenerateEducationSectionPayload,
) {
  return client.post(
    `/admin/education/diagnoses/${diagnosisRegistryId}/regenerate-section`,
    payload,
  );
}

export function updateDiagnosisEducationForAdmin(
  client: ApiClient,
  educationId: string,
  payload: UpsertDiagnosisEducationPayload,
) {
  return client.patch(`/admin/education/${educationId}`, payload);
}

export function reviewDiagnosisEducationForAdmin(
  client: ApiClient,
  educationId: string,
  payload: ReviewDiagnosisEducationPayload,
) {
  return client.post(`/admin/education/${educationId}/review`, payload);
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
  return client.get<EditorialCaseRevision[]>(
    `/admin/cases/${caseId}/revisions`,
  );
}

export function rerunCaseValidation(client: ApiClient, caseId: string) {
  return client.post<RerunCaseValidationResult>(
    `/admin/cases/${caseId}/rerun-validation`,
  );
}

export function startCaseReview(client: ApiClient, caseId: string) {
  return client.post<StartCaseReviewResult>(
    `/admin/cases/${caseId}/start-review`,
  );
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
