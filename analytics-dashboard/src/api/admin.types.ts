export type ApiEnvelope<T> = {
  data: T;
  meta: {
    generatedAt: number;
    count: number;
  };
};

export type AttemptsPoint = {
  time: string;
  attempts: number;
};

export type AccuracyPoint = {
  caseId: string;
  accuracy: number;
  attempts: number;
};

export type WrongGuessPoint = {
  guess: string;
  count: number;
};

export type SignalPoint = {
  embeddingAvg: number;
  fuzzyAvg: number;
  ontologyAvg: number;
};

export type DashboardPayload = {
  topWrong: ApiEnvelope<WrongGuessPoint[]>;
  accuracy: ApiEnvelope<AccuracyPoint[]>;
  signals: ApiEnvelope<SignalPoint[]>;
  fallback: ApiEnvelope<Array<{ fallbackRate: number }>>;
  attemptsOverTime: ApiEnvelope<AttemptsPoint[]>;
};

export type AttemptsOverTimePayload = ApiEnvelope<AttemptsPoint[]>;

export type AdminViewer = {
  clerkId: string;
  email?: string;
  role: string;
  userId: string;
};

export type GenerateCasesPayload = {
  count: number;
  track?: string;
  difficulty?: string;
};

export type GenerateCasesResult = {
  batchId: string;
  requested: number;
  created: number;
  skipped: number;
  failed: number;
  results: Array<
    | {
        index: number;
        status: 'created';
        caseId: string;
        answer: string;
      }
    | {
        index: number;
        status: 'skipped';
        reason: 'duplicate_answer';
        answer: string;
      }
    | {
        index: number;
        status: 'failed';
        error: string;
      }
  >;
};

export type CaseEditorialStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'REVIEW'
  | 'NEEDS_EDIT'
  | 'APPROVED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'REJECTED';

export type ValidationOutcome = 'PASSED' | 'FAILED' | 'ERROR';

export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'NEEDS_EDIT';

export type CaseSource = 'GENERATED' | 'MANUAL' | 'ADMIN_EDIT' | 'RESTORED';

export type PublishTrack = 'DAILY' | 'PREMIUM' | 'PRACTICE';

export type EditorialQueueFilter = 'all' | 'review' | 'publish';

export type DiagnosisRegistryStatus = 'ACTIVE' | 'HIDDEN' | 'DEPRECATED' | 'DRAFT';

export type DiagnosisMappingStatus =
  | 'MATCHED'
  | 'REVIEW_REQUIRED'
  | 'UNRESOLVED'
  | 'NEW_REGISTRY_ENTRY_NEEDED';

export type DiagnosisMappingMethod =
  | 'EXACT_ALIAS'
  | 'NORMALIZED_ALIAS'
  | 'EDITOR_SELECTED'
  | 'MANUAL_CREATED'
  | 'LEGACY_BACKFILL'
  | 'NONE';

export type DiagnosisPublishReadinessReason =
  | 'missing_registry_link'
  | 'mapping_not_publish_ready'
  | 'registry_not_publishable';

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type JsonArray = JsonValue[];

export type LooseRecord = Record<string, unknown>;

export type ValidationSummaryBlob = LooseRecord & {
  outcome?: ValidationOutcome | string;
  validatorVersion?: string;
  counts?: Record<string, number>;
  validators?: LooseRecord[];
};

export type ValidationFindingsBlob = LooseRecord & {
  issues?: unknown[];
  validators?: LooseRecord[];
};

export type ExplanationBlob = LooseRecord | JsonArray;

export type CluesBlob = LooseRecord | JsonArray;

export type LabsBlob = LooseRecord | JsonArray;

export type EditorialDiagnosis = {
  id: string;
  name: string;
  system: string | null;
};

export type EditorialDiagnosisRegistrySummary = {
  id: string;
  canonicalName: string;
  status: DiagnosisRegistryStatus;
  category: string | null;
  specialty: string | null;
  searchPriority?: number;
  isDescriptive?: boolean;
  isCompositional?: boolean;
  notes?: string | null;
  aliasPreview?: string[];
};

export type EditorialDiagnosisPublishReadiness = {
  ready: boolean;
  reason?: DiagnosisPublishReadinessReason;
};

export type EditorialCaseValidationRun = {
  id: string;
  revisionId: string | null;
  source: CaseSource | null;
  publishTrack?: PublishTrack | null;
  outcome: ValidationOutcome | null;
  validatorVersion: string | null;
  summary: ValidationSummaryBlob | null;
  findings?: ValidationFindingsBlob | null;
  triggeredByUserId?: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type EditorialCaseReview = {
  id: string;
  revisionId: string | null;
  reviewerUserId: string | null;
  decision: ReviewDecision | null;
  notes: string | null;
  source?: CaseSource | null;
  publishTrack?: PublishTrack | null;
  createdAt: string;
  decidedAt: string | null;
};

export type EditorialCurrentRevision = {
  id: string;
  revisionNumber: number;
  source: CaseSource | null;
  createdAt: string;
  createdByUserId?: string | null;
  title?: string;
  date?: string;
  difficulty?: string;
  history?: string;
  symptoms?: string[];
  labs?: LabsBlob | null;
  clues?: CluesBlob | null;
  explanation?: ExplanationBlob | null;
  differentials?: string[];
  diagnosisId?: string;
  diagnosisRegistryId?: string | null;
  proposedDiagnosisText?: string;
  diagnosisMappingStatus?: DiagnosisMappingStatus;
  diagnosisMappingMethod?: DiagnosisMappingMethod;
  diagnosisMappingConfidence?: number | null;
  diagnosisEditorialNote?: string | null;
};

export type EditorialCaseListItem = {
  id: string;
  title: string;
  date: string;
  difficulty: string;
  editorialStatus: CaseEditorialStatus | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  currentRevisionId: string | null;
  diagnosisRegistryId: string | null;
  proposedDiagnosisText: string;
  diagnosisMappingStatus: DiagnosisMappingStatus;
  diagnosisMappingMethod: DiagnosisMappingMethod;
  diagnosisMappingConfidence: number | null;
  diagnosisEditorialNote: string | null;
  diagnosisRegistrySummary: EditorialDiagnosisRegistrySummary | null;
  diagnosisPublishReadiness: EditorialDiagnosisPublishReadiness;
  diagnosis: EditorialDiagnosis;
  currentRevision: EditorialCurrentRevision | null;
  validationRuns: EditorialCaseValidationRun[];
  reviews: EditorialCaseReview[];
};

export type EditorialCasesQuery = {
  status?: CaseEditorialStatus;
  queue?: EditorialQueueFilter;
  page?: number;
  pageSize?: number;
};

export type EditorialCasesResponse = {
  items: EditorialCaseListItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  filters: {
    status: CaseEditorialStatus | null;
    queue: EditorialQueueFilter;
  };
};

export type EditorialCaseDetail = {
  id: string;
  title: string;
  date: string;
  difficulty: string;
  history: string;
  symptoms: string[];
  labs: LabsBlob | null;
  clues: CluesBlob | null;
  explanation: ExplanationBlob | null;
  differentials: string[];
  diagnosisId: string;
  diagnosisRegistryId: string | null;
  proposedDiagnosisText: string;
  diagnosisMappingStatus: DiagnosisMappingStatus;
  diagnosisMappingMethod: DiagnosisMappingMethod;
  diagnosisMappingConfidence: number | null;
  diagnosisEditorialNote: string | null;
  diagnosisRegistrySummary: EditorialDiagnosisRegistrySummary | null;
  diagnosisPublishReadiness: EditorialDiagnosisPublishReadiness;
  editorialStatus: CaseEditorialStatus | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  currentRevisionId: string | null;
  diagnosis: EditorialDiagnosis;
  currentRevision: EditorialCurrentRevision | null;
  validationRuns: EditorialCaseValidationRun[];
  reviews: EditorialCaseReview[];
};

export type EditorialCaseRevision = {
  id: string;
  revisionNumber: number;
  source: CaseSource | null;
  publishTrack: PublishTrack | null;
  title: string;
  date: string;
  difficulty: string;
  history: string;
  symptoms: string[];
  labs: LabsBlob | null;
  clues: CluesBlob | null;
  explanation: ExplanationBlob | null;
  differentials: string[];
  diagnosisId: string;
  diagnosisRegistryId: string | null;
  proposedDiagnosisText: string;
  diagnosisMappingStatus: DiagnosisMappingStatus;
  diagnosisMappingMethod: DiagnosisMappingMethod;
  diagnosisMappingConfidence: number | null;
  diagnosisEditorialNote: string | null;
  createdByUserId: string | null;
  createdAt: string;
  validationRuns: EditorialCaseValidationRun[];
  reviews: EditorialCaseReview[];
};

export type EditorialCaseStatusSnapshot = {
  id: string;
  editorialStatus: CaseEditorialStatus | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  currentRevisionId: string | null;
};

export type RerunCaseValidationResult = {
  case: EditorialCaseStatusSnapshot;
  validationRun: EditorialCaseValidationRun;
};

export type StartCaseReviewResult = {
  case: EditorialCaseStatusSnapshot;
  review: EditorialCaseReview;
};

export type SubmitCaseReviewPayload = {
  decision: ReviewDecision;
  notes?: string;
};

export type SubmitCaseReviewResult = {
  case: EditorialCaseStatusSnapshot;
  review: EditorialCaseReview;
};

export type RestoreCaseRevisionResult = {
  case: EditorialCaseStatusSnapshot;
  restoredFromRevisionId: string;
  revision: {
    id: string;
    revisionNumber: number;
    source: CaseSource;
    snapshot: {
      caseId: string;
      title: string;
      date: string;
      difficulty: string;
      history: string;
      symptoms: string[];
      labs: LabsBlob | null;
      clues: CluesBlob | null;
      explanation: ExplanationBlob | null;
      differentials: string[];
      diagnosisId: string;
    };
  };
  validationRun: Pick<
    EditorialCaseValidationRun,
    'id' | 'outcome' | 'validatorVersion' | 'startedAt' | 'completedAt'
  >;
};

export type MarkCaseReadyToPublishResult = EditorialCaseStatusSnapshot;

export type DiagnosisRegistrySearchItem = {
  id: string;
  canonicalName: string;
  status: DiagnosisRegistryStatus;
  category: string | null;
  specialty: string | null;
  searchPriority: number;
  aliasPreview: string[];
  matchSource: 'canonical' | 'accepted_alias' | 'abbreviation' | 'search_only';
};

export type SearchDiagnosisRegistryQuery = {
  q?: string;
  limit?: number;
  status?: DiagnosisRegistryStatus;
};

export type LinkCaseDiagnosisPayload = {
  diagnosisRegistryId: string;
  diagnosisEditorialNote?: string;
};

export type UpdateCaseDiagnosisPayload = {
  canonicalDiagnosis: string;
};

export type CreateDiagnosisRegistryPayload = {
  canonicalName: string;
  aliases?: string[];
  category?: string;
  specialty?: string;
  isDescriptive?: boolean;
  isCompositional?: boolean;
  notes?: string;
  searchPriority?: number;
};

export type CreateDiagnosisAndLinkPayload = CreateDiagnosisRegistryPayload & {
  diagnosisEditorialNote?: string;
};

export type AddDiagnosisAliasPayload = {
  alias: string;
  kind?: 'CANONICAL' | 'ACCEPTED' | 'ABBREVIATION' | 'SEARCH_ONLY';
  acceptedForMatch?: boolean;
};

export type CreateDiagnosisRegistryResult = {
  diagnosisId: string;
  diagnosisRegistryId: string;
  mappingMethod: 'MANUAL_CREATED';
  registry: EditorialDiagnosisRegistrySummary;
};

export type EditorialStatusSummary = {
  counts: Record<CaseEditorialStatus, number>;
  nullStatusCount: number;
  totalCases: number;
};

export type ValidationOutcomeSummary = Record<
  CaseSource,
  Record<ValidationOutcome, number>
>;

export type PublishResultsSummary = {
  currentEligiblePool: {
    approvedCases: number;
    readyToPublishCases: number;
  };
  metrics: {
    explicit: {
      accepted: number;
      rejected: number;
      rejectedByEditorialStatus: Record<string, number>;
    };
    lazy: {
      accepted: number;
      rejected: number;
      rejectedByEditorialStatus: Record<string, number>;
      noEligibleCaseMisses: number;
    };
    readyToPublishTransitions: number;
  };
};
