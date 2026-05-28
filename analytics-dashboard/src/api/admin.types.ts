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
  bodySystem?: string;
  difficulty?: string;
  registryFirst?: boolean;
};

export type GenerationMode = 'registry_balanced' | 'diagnosis_targeted';

export type GenerationResultTab =
  | 'all'
  | 'created'
  | 'skipped'
  | 'failed'
  | 'planner';

export type GenerateCaseSkipReason =
  | 'duplicate_answer'
  | 'duplicate_scenario'
  | 'low_quality'
  | 'specialty_cluster'
  | 'difficulty_balance';

export type PlannedGenerationDiagnosis = {
  diagnosisRegistryId: string;
  legacyDiagnosisId: string | null;
  displayLabel: string;
  canonicalName: string;
  acceptedAliases: string[];
  specialty: string | null;
  category: string | null;
  bodySystem: string | null;
  difficultyBand: string | null;
  existingCaseCount: number;
  lastGeneratedAt: string | null;
  recentUsePenaltyApplied: boolean;
};

export type PlannerDiagnosisComparison = {
  aiAnswer: string | null;
  normalizedAiAnswer: string | null;
  normalizedPlannerDiagnosis: string;
  matchesPlanner: boolean | null;
};

export type PlannerSelectionDiagnostics = {
  candidateCount: number;
  unusedCandidateCount: number;
  repeatedCandidateCount: number;
  selectedUnusedCount: number;
  selectedRepeatCount: number;
  repeatReason: string | null;
  existingCaseCountByDiagnosis: Record<string, number>;
  recentUsePenaltyApplied: boolean;
};

export type PlannedGenerationSlot = {
  batchId: string;
  index: number;
  diagnosis: PlannedGenerationDiagnosis | null;
  duplicatePrevented: boolean;
  selectionStatus: 'selected' | 'unavailable';
  repeatReason: string | null;
  existingCaseCount: number | null;
  recentUsePenaltyApplied: boolean;
  diagnostics: PlannerSelectionDiagnostics;
  comparison?: PlannerDiagnosisComparison;
};

export type GenerateCaseResultItem =
  | {
      index: number;
      status: 'created';
      caseId: string;
      answer: string;
    }
  | {
      index: number;
      status: 'skipped';
      reason: GenerateCaseSkipReason;
      answer: string;
    }
  | {
      index: number;
      status: 'failed';
      error: string;
    };

export type GenerateCasesResult = {
  batchId: string;
  requested: number;
  generated: number;
  accepted: number;
  rejected: number;
  created: number;
  skipped: number;
  failed: number;
  averageQualityScore: number | null;
  plannerDiagnostics: PlannedGenerationSlot[];
  results: GenerateCaseResultItem[];
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

export type DiagnosisDifficultyBand = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

export type DiagnosisEducationStatus =
  | 'DRAFT'
  | 'GENERATED'
  | 'NEEDS_REVIEW'
  | 'NEEDS_EDIT'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

export type DiagnosisEducationSource =
  | 'MANUAL'
  | 'AI_ASSISTED'
  | 'IMPORTED'
  | 'HYBRID';

export type DiagnosisGraphCandidateType =
  | 'FINDING'
  | 'INVESTIGATION'
  | 'MIMIC'
  | 'PITFALL'
  | 'MANAGEMENT'
  | 'COMPLICATION'
  | 'RECALL_PROMPT'
  | 'CASE_REASONING';

export type DiagnosisGraphSourceType = 'CASE' | 'DIAGNOSIS_EDUCATION';

export type DiagnosisGraphCandidateStatus =
  | 'CANDIDATE'
  | 'APPROVED'
  | 'REJECTED'
  | 'MERGED';

export type DiagnosisGraphFactStatus = 'ACTIVE' | 'ARCHIVED';

export type DiagnosisGraphCandidate = {
  id: string;
  diagnosisRegistryId: string;
  type: DiagnosisGraphCandidateType;
  status: DiagnosisGraphCandidateStatus;
  sourceType: DiagnosisGraphSourceType;
  sourceId: string;
  sourceVersion: number | null;
  sourcePath: string;
  rawText: string;
  normalizedText: string;
  dedupeKey: string;
  payload: JsonValue | null;
  targetDiagnosisRegistryId: string | null;
  unresolvedTargetText: string | null;
  confidence: number | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  mergedIntoId: string | null;
  promotedFactId: string | null;
  createdAt: string;
  updatedAt: string;
  diagnosisRegistry?: {
    id: string;
    displayLabel: string;
  };
  targetDiagnosisRegistry?: {
    id: string;
    displayLabel: string;
  } | null;
  promotedFact?: {
    id: string;
    status: DiagnosisGraphFactStatus;
  } | null;
};

export type DiagnosisGraphCandidateFilters = {
  diagnosisRegistryId?: string;
  type?: DiagnosisGraphCandidateType;
  status?: DiagnosisGraphCandidateStatus;
  sourceType?: DiagnosisGraphSourceType;
};

export type RejectDiagnosisGraphCandidatePayload = {
  note?: string;
};

export type MergeDiagnosisGraphCandidatePayload = {
  targetCandidateId?: string;
  targetFactId?: string;
  note?: string;
};

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
  subspecialty?: string | null;
  bodySystem?: string | null;
  organSystem?: string | null;
  difficultyBand?: DiagnosisDifficultyBand | null;
  rarityBand?: string | null;
  clinicalSetting?: string | null;
  ageGroup?: string | null;
  urgencyLevel?: string | null;
  isPlayable?: boolean;
  isGeneratable?: boolean;
  searchPriority?: number;
  isDescriptive?: boolean;
  isCompositional?: boolean;
  notes?: string | null;
  aliasPreview?: string[];
};

export type DiagnosisEducationSummary = {
  definition?: string;
  highYieldTakeaway?: string;
};

export type PearlType =
  | 'PATTERN_RECOGNITION'
  | 'HIGH_YIELD_DISCRIMINATOR'
  | 'PITFALL'
  | 'ESCALATION_RED_FLAG'
  | 'MANAGEMENT'
  | 'MNEMONIC'
  | 'EXAM'
  | 'INVESTIGATION';

export type PearlCritique = {
  genericityScore?: number;
  discriminatorStrength?: number;
  operationalReasoningScore?: number;
  memorabilityScore?: number;
  managementImpactScore?: number;
  warnings: string[];
};

export type TypedEducationPearl = {
  id: string;
  type: PearlType;
  title?: string;
  content: string;
  whyItMatters?: string;
  discriminator?: string;
  managementImplication?: string;
  escalationImplication?: string;
  trapAvoided?: string;
  critique?: PearlCritique;
};

export type DiagnosisEducationPearl = {
  id?: string;
  type?: PearlType;
  title?: string;
  content?: string;
  label: string;
  explanation: string;
  whyItMatters?: string;
  discriminator?: string;
  managementImplication?: string;
  escalationImplication?: string;
  trapAvoided?: string;
  critique?: PearlCritique;
};

export type DiagnosisEducationDifferential = {
  diagnosis: string;
  whyConfused?: string;
  distinguishingPoint: string;
  keySeparator?: string;
  classicTrap?: string;
};

export type DiagnosisEducationRecord = {
  id: string;
  diagnosisRegistryId: string;
  title: string;
  summary: JsonValue;
  clinicalPattern: JsonValue | null;
  keySymptoms: JsonValue | null;
  keySigns: JsonValue | null;
  examPearls: JsonValue | null;
  scoringSystems: JsonValue | null;
  investigations: JsonValue | null;
  differentials: JsonValue | null;
  management: JsonValue | null;
  complications: JsonValue | null;
  pitfalls: JsonValue | null;
  recallPrompts: JsonValue | null;
  references: JsonValue | null;
  editorialStatus: DiagnosisEducationStatus;
  source: DiagnosisEducationSource;
  version: number;
  generatedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revisions?: DiagnosisEducationRevision[];
};

export type DiagnosisEducationRevision = {
  id: string;
  educationId: string;
  version: number;
  snapshot: JsonValue;
  editorialStatus: DiagnosisEducationStatus;
  source: DiagnosisEducationSource;
  createdByUserId: string | null;
  createdAt: string;
};

export type AdminDiagnosisEducationResponse = {
  diagnosisRegistry: EditorialDiagnosisRegistrySummary;
  education: DiagnosisEducationRecord | null;
  qualityWarnings?: string[];
  publishBlockers?: string[];
};

export type UpsertDiagnosisEducationPayload = {
  title?: string;
  summary?: DiagnosisEducationSummary;
  clinicalPattern?: JsonValue;
  keySymptoms?: JsonValue;
  keySigns?: JsonValue;
  examPearls?: JsonValue;
  scoringSystems?: JsonValue;
  investigations?: JsonValue;
  differentials?: JsonValue;
  management?: JsonValue;
  complications?: JsonValue;
  pitfalls?: JsonValue;
  recallPrompts?: JsonValue;
  references?: JsonValue;
};

export type ReviewDiagnosisEducationPayload = {
  status: DiagnosisEducationStatus;
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
  diagnosis: EditorialDiagnosis | null;
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
  diagnosis: EditorialDiagnosis | null;
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
  subspecialty?: string | null;
  bodySystem?: string | null;
  organSystem?: string | null;
  difficultyBand?: DiagnosisDifficultyBand | null;
  rarityBand?: string | null;
  clinicalSetting?: string | null;
  ageGroup?: string | null;
  urgencyLevel?: string | null;
  isPlayable?: boolean;
  isGeneratable?: boolean;
  preferredClueTypes?: string[] | null;
  excludedClueTypes?: string[] | null;
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
