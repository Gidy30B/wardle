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
  diagnosisRegistryIds?: string[];
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

export type TargetedCaseDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type ClueRevealStrategy =
  | 'classic'
  | 'early_anchor'
  | 'late_discriminator'
  | 'progressive_narrowing';

export type GenerateTargetedCasePayload = {
  difficulty: TargetedCaseDifficulty;
  teachingUnitIds: string[];
  mimicDiagnosisIds?: string[];
  clueRevealStrategy?: ClueRevealStrategy;
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

export type DiagnosisRegistryStatus =
  | 'ACTIVE'
  | 'HIDDEN'
  | 'DEPRECATED'
  | 'DRAFT';

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

export type DifferentialResolutionStatus =
  | 'RESOLVED'
  | 'AMBIGUOUS'
  | 'UNRESOLVED'
  | 'REJECTED';

export type DifferentialLinkRole =
  | 'PRIMARY_MIMIC'
  | 'DIFFERENTIAL'
  | 'IMPORTANT_EXCLUSION'
  | 'TEACHING_DIFFERENTIAL';

export type StructuredDifferentialLink = {
  id?: string;
  diagnosisRegistryId: string;
  displayLabel: string;
  canonicalName?: string;
  role: DifferentialLinkRole | string;
  confidence: number | null;
  sourceText: string;
};

export type DifferentialCoverageSummary = {
  totalDifferentials: number;
  resolvedLinks: number;
  unresolvedMappings: number;
};

export type DifferentialMappingSourceType =
  | 'case'
  | 'case_revision'
  | 'education'
  | 'education_revision';

export type DifferentialMappingSuggestion = {
  diagnosisRegistryId: string;
  displayLabel: string;
  canonicalName: string;
  matchType: string;
  confidence: number;
};

export type DifferentialMappingReviewItem = {
  id: string;
  sourceType: DifferentialMappingSourceType;
  sourceId: string;
  sourceTitle: string;
  sourcePath: string | null;
  revisionNumber: number | null;
  rawText: string;
  normalizedText: string;
  status: DifferentialResolutionStatus;
  matchType: string | null;
  confidence: number | null;
  suggestions: DifferentialMappingSuggestion[] | JsonValue | null;
  resolvedDiagnosisRegistryId: string | null;
  resolvedDiagnosisRegistry: {
    id: string;
    displayLabel: string;
    canonicalName: string;
  } | null;
  contextDiagnosis: {
    id: string;
    displayLabel: string;
  } | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DifferentialMappingFilters = {
  sourceType?: 'case' | 'education';
  diagnosisRegistryId?: string;
  status?: DifferentialResolutionStatus;
};

export type ResolveDifferentialMappingPayload =
  | {
      action: 'link_existing';
      targetDiagnosisRegistryId: string;
      reason?: string;
    }
  | {
      action: 'add_alias_to_existing';
      targetDiagnosisRegistryId: string;
      aliasText: string;
      reason?: string;
    }
  | {
      action: 'reject';
      reason?: string;
    };

export type DiagnosisRegistryCandidateStatus =
  | 'CANDIDATE'
  | 'NEEDS_REVIEW'
  | 'REJECTED'
  | 'MERGED'
  | 'APPROVED_PENDING_CREATE'
  | 'CREATED';

export type DiagnosisRegistryCandidateDuplicateSuggestions = {
  registryCanonicalMatches?: Array<{
    id: string;
    canonicalName: string;
    displayLabel: string;
    status: string;
  }>;
  registryAliasMatches?: Array<{
    aliasId: string;
    aliasTerm: string;
    aliasKind: string;
    registry: {
      id: string;
      canonicalName: string;
      displayLabel: string;
      status: string;
    };
  }>;
  candidateMatches?: Array<{
    id: string;
    proposedCanonicalName: string;
    proposedDisplayLabel: string;
    status: DiagnosisRegistryCandidateStatus;
  }>;
};

export type DiagnosisRegistryCandidate = {
  id: string;
  proposedCanonicalName: string;
  proposedCanonicalNormalized: string;
  proposedDisplayLabel: string;
  proposedAliases: string[] | JsonValue | null;
  sourceType: DifferentialMappingSourceType | string;
  sourceId: string;
  sourceMappingId: string | null;
  sourceRawText: string;
  contextDiagnosisRegistryId: string | null;
  contextDiagnosisRegistry: {
    id: string;
    displayLabel: string;
    canonicalName: string;
  } | null;
  duplicateSuggestions:
    | DiagnosisRegistryCandidateDuplicateSuggestions
    | JsonValue
    | null;
  status: DiagnosisRegistryCandidateStatus;
  reviewerUserId: string | null;
  reviewerUser: {
    id: string;
    email: string | null;
    username: string | null;
  } | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdRegistryId: string | null;
  createdRegistry: {
    id: string;
    displayLabel: string;
    canonicalName: string;
  } | null;
  approvedByUserId: string | null;
  approvedByUser: {
    id: string;
    email: string | null;
    username: string | null;
  } | null;
  approvedAt: string | null;
  mergeTargetCandidateId: string | null;
  mergeTargetCandidate: {
    id: string;
    proposedDisplayLabel: string;
    status: DiagnosisRegistryCandidateStatus;
  } | null;
  creationSnapshot: JsonValue | null;
  sourceMapping?: JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRegistryFromCandidateResult = {
  candidate: DiagnosisRegistryCandidate;
  registry: {
    id: string;
    canonicalName: string;
    canonicalNormalized: string;
    displayLabel: string;
    status: DiagnosisRegistryStatus;
    active: boolean;
    onboardingStatus?: DiagnosisEditorialOnboardingStatus | null;
    onboardingStartedAt?: string | null;
    isPlayable: boolean;
    isGeneratable: boolean;
  };
  createdAliases: Array<{
    aliasId: string;
    term: string;
    normalizedTerm: string;
  }>;
  rejectedAliases: Array<{
    term: string;
    reason: string;
  }>;
  mappingsResolvedCount: number;
  structuredLinksUpdatedCount: number;
};

export type RegistryCandidateFilters = {
  status?: DiagnosisRegistryCandidateStatus;
  limit?: number;
};

export type DiagnosisRegistryCandidateQueueSummary = {
  registryCandidateCount: number;
  unresolvedDifferentialCount: number;
  pendingRegistryCandidateCount: number;
};

export type DiagnosisEditorialOnboardingStatus =
  | 'NEW'
  | 'RULES_STARTED'
  | 'BRIEF_STARTED'
  | 'EDUCATION_STARTED'
  | 'CASE_STARTED'
  | 'READY_FOR_REVIEW'
  | 'COMPLETE';

export type DiagnosisEditorialOnboardingAction =
  | 'mark_ready_for_review'
  | 'mark_complete'
  | 'reopen';

export type DiagnosisEditorialOnboardingSummary = {
  newlyCreatedDiagnoses: number;
  diagnosesMissingRules: number;
  diagnosesMissingEducation: number;
  readyForReviewDiagnoses: number;
};

export type CreateRegistryCandidatePayload = {
  proposedCanonicalName?: string;
  proposedDisplayLabel?: string;
  proposedAliases?: string[];
};

export type ReviewRegistryCandidatePayload =
  | {
      action: 'mark_needs_review';
      note?: string;
    }
  | {
      action: 'reject';
      note?: string;
    }
  | {
      action: 'merge_duplicate_candidate';
      duplicateCandidateId: string;
      note?: string;
    };

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

export type DiagnosisGraphResolutionSuggestion = {
  diagnosisRegistryId: string;
  displayLabel: string;
  canonicalName: string;
  matchType: string;
  confidence: number;
};

export type UnresolvedMimicCandidate = {
  id: string;
  rawText: string;
  normalizedText: string;
  contextDiagnosis: {
    id: string;
    displayLabel: string;
    canonicalName?: string;
  } | null;
  diagnosisRegistryId: string;
  sourceType: DiagnosisGraphSourceType;
  sourceId: string;
  sourcePath: string;
  payload: JsonValue | null;
  suggestions: DiagnosisGraphResolutionSuggestion[];
  createdAt: string;
  status: DiagnosisGraphCandidateStatus;
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

export type ResolveMimicCandidatePayload = {
  action: 'link_existing' | 'add_alias_to_existing' | 'reject';
  targetDiagnosisRegistryId?: string;
  aliasText?: string;
  reason?: string;
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

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

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
  displayLabel: string;
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
  linkedDifferentials?: StructuredDifferentialLink[];
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

export type WorkspaceReadiness = {
  generationReady: boolean;
  educationReadyForReview: boolean;
  publishReady: boolean;
  graphReady: boolean;
  missing: string[];
  nextActions: string[];
};

export type WorkspaceCoverageWarning = {
  code: string;
  item?: string;
  section?: string;
  severity?: 'warning' | 'blocker' | string;
};

export type WorkspaceSectionScores = Record<string, number>;

export type WorkspaceCoverageScores = Record<string, number>;

export type WorkspaceQualityReport = {
  scores?: Record<string, number>;
  sectionScores?: WorkspaceSectionScores;
  coverageScores?: WorkspaceCoverageScores;
  patternComplianceScores?: Record<string, number>;
  coverageWarnings?: WorkspaceCoverageWarning[];
  sectionFailureSummary?: WorkspaceSectionFailureSummary[];
  warnings: string[];
  blockers: string[];
};

export type EducationRegenerableSection =
  | 'differentials'
  | 'investigations'
  | 'examPearls'
  | 'management';

export type WorkspaceSectionFailureSummary = {
  section:
    | EducationRegenerableSection
    | 'pitfalls'
    | 'recallPrompts'
    | 'findings';
  score: number | null;
  coverageScore: number | null;
  patternComplianceScore: number | null;
  blockers: string[];
  warnings: string[];
  regenerationRecommended: boolean;
  reason: string | null;
};

export type RegenerateEducationSectionPayload = {
  section: EducationRegenerableSection;
};

export type WorkspaceGraphSummary = {
  candidates: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  facts: {
    total: number;
    byType: Record<string, number>;
  };
  readiness: 'none' | 'candidate_only' | 'review_needed' | 'fact_ready';
};

export type WorkspaceCaseSummary = {
  total: number;
  byStatus: Record<string, number>;
  latest?: {
    id: string;
    title: string;
    editorialStatus?: string | null;
    difficulty?: string | null;
    updatedAt?: string;
  };
};

export type DiagnosisWorkspaceProjection = {
  diagnosis: {
    id: string;
    displayLabel: string;
    canonicalName?: string | null;
    aliases: string[];
    specialty?: string | null;
    difficultyBand?: string | null;
  };
  sourceSummary: {
    hasEducation: boolean;
    hasPublishedEducation: boolean;
    caseCount: number;
    approvedCaseCount: number;
    publishedCaseCount: number;
    graphCandidateCount: number;
    promotedGraphFactCount: number;
  };
  education: {
    status: 'missing' | 'draft' | 'review' | 'published' | 'archived';
    id?: string;
    version?: number;
    editorialStatus?: string;
    updatedAt?: string;
    qualityReport?: WorkspaceQualityReport;
  };
  cases: WorkspaceCaseSummary;
  graph: WorkspaceGraphSummary;
  readiness: WorkspaceReadiness;
};

export type EducationRevisionSectionHealth = WorkspaceSectionFailureSummary;

export type EducationRevisionQualitySummary = {
  overallScore: number;
  graphReadiness: number;
  sectionScores: Record<string, number>;
  coverageScores: Record<string, number>;
  patternComplianceScores: Record<string, number>;
  warnings: string[];
  blockers: string[];
  coverageWarnings?: WorkspaceCoverageWarning[];
  sectionHealth: EducationRevisionSectionHealth[];
  warningCount: number;
  blockerCount: number;
};

export type DiagnosisEducationRevisionAnalysis = {
  id: string;
  educationId: string;
  version: number;
  editorialStatus: DiagnosisEducationStatus;
  source: DiagnosisEducationSource | string;
  createdByUserId: string | null;
  createdAt: string;
  changedSections?: string[];
  quality: EducationRevisionQualitySummary;
};

export type DiagnosisEducationRevisionListResponse = {
  diagnosisRegistryId: string;
  revisions: DiagnosisEducationRevisionAnalysis[];
};

export type DiagnosisEducationRevisionCompareResult = {
  fromVersion: number;
  toVersion: number;
  blockerChanges: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  warningChanges: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  sectionChanges: Array<{
    section: string;
    fromScore: number | null;
    toScore: number | null;
    delta: number | null;
    direction: 'improved' | 'regressed' | 'unchanged';
  }>;
  changedSections: string[];
  overallDelta: number;
  graphReadinessDelta: number;
  summary: {
    improvements: string[];
    regressions: string[];
  };
};

export type DiagnosisWorkspaceOverallStatus =
  | 'ready'
  | 'needs_review'
  | 'blocked'
  | 'insufficient_data';

export type DiagnosisWorkspaceQualitySummary = {
  diagnosisRegistryId: string;
  diagnosisName: string;
  overallWorkspaceStatus: DiagnosisWorkspaceOverallStatus;
  educationQuality: {
    status: 'missing' | 'draft' | 'review' | 'published' | 'archived';
    version: number | null;
    score: number | null;
    graphReadiness: number | null;
    blockerCount: number;
    warningCount: number;
  };
  caseQuality: {
    status: 'missing' | 'good' | 'warning' | 'blocker' | 'unknown';
    totalCases: number;
    usableCases: number;
    blockerCount: number;
    warningCount: number;
    strongestCaseId: string | null;
  };
  teachingCoverage: {
    overall: number | null;
    scores: Record<string, number>;
    missingItems: WorkspaceCoverageWarning[];
  };
  graphReadiness: {
    status: 'none' | 'candidate_only' | 'review_needed' | 'fact_ready';
    candidateCount: number;
    factCount: number;
    reviewableCandidateCount: number;
  };
  editorialBrief?: {
    status: DiagnosisEditorialBriefStatus | null;
    version: number | null;
    activeForGeneration: boolean;
  };
  revisionTrend: {
    latestVersion: number | null;
    previousVersion: number | null;
    overallDelta: number | null;
    graphReadinessDelta: number | null;
    direction: 'improved' | 'regressed' | 'unchanged' | 'unknown';
  };
  sectionHealth: WorkspaceSectionFailureSummary[];
  blockers: string[];
  warnings: string[];
  recommendedNextActions: string[];
};

export type WorkspaceLifecycleState =
  | 'complete'
  | 'warning'
  | 'blocked'
  | 'not_started';

export type WorkspaceLifecycle = {
  curriculum: WorkspaceLifecycleState;
  brief: WorkspaceLifecycleState;
  education: WorkspaceLifecycleState;
  cases: WorkspaceLifecycleState;
  graph: WorkspaceLifecycleState;
  ready: WorkspaceLifecycleState;
};

export type WorkspaceReadinessSeverity = 'info' | 'warning' | 'blocker';

export type WorkspaceTargetTab =
  | 'overview'
  | 'teaching-rules'
  | 'editorial-brief'
  | 'education'
  | 'cases'
  | 'graph';

export type WorkspaceReadinessItem = {
  severity: WorkspaceReadinessSeverity;
  source: string;
  message: string;
  actionId: string;
  targetTab: WorkspaceTargetTab;
  targetEndpoint?: string;
};

export type WorkspaceCoverageMatrixRow = {
  teachingRuleId: string | null;
  stableKey: string;
  title: string;
  category: DiagnosisTeachingRuleCategory | 'legacy_teaching_rule' | string;
  importance: DiagnosisTeachingRuleImportance | string;
  ruleStatus: DiagnosisTeachingRuleStatus | 'LEGACY' | 'UNKNOWN' | string;
  educationCoverage: TeachingUnitCoverageStatus;
  caseCoverage: TeachingUnitCoverageStatus;
  graphCoverage: TeachingUnitCoverageStatus;
  fullCoverageStatus: TeachingUnitCoverageStatus;
  recommendedAction: string;
};

export type WorkspaceCoverageGap = {
  teachingRuleId: string | null;
  title: string;
  missingEducation: boolean;
  missingCases: boolean;
  missingGraph: boolean;
  severity: WorkspaceReadinessSeverity;
  recommendedAction: string;
  targetTab: WorkspaceTargetTab;
};

export type WorkspaceRecommendedAction = {
  id: string;
  label: string;
  source?: string;
  severity?: WorkspaceReadinessSeverity;
  targetTab: WorkspaceTargetTab;
  enabled: boolean;
  disabledReason: string | null;
  targetEndpoint?: string;
};

export type DiagnosisEditorialOnboarding = {
  diagnosis: {
    id: string;
    canonicalName: string;
    displayLabel: string;
    status: DiagnosisRegistryStatus | string;
    active: boolean;
    isPlayable: boolean;
    isGeneratable: boolean;
  };
  onboardingStatus: DiagnosisEditorialOnboardingStatus;
  onboardingStartedAt: string | null;
  onboardingCompletedAt: string | null;
  readiness: 'in_progress' | 'ready_for_review' | 'complete' | string;
  progress: {
    completedComponents: number;
    totalComponents: number;
    percent: number;
  };
  missingComponents: string[];
  recommendedActions: Array<{
    id: string;
    label: string;
    targetTab: WorkspaceTargetTab;
    reason: string;
  }>;
  existingAssets: {
    teachingRules: number;
    editorialBrief: number;
    education: number;
    cases: number;
    graphFacts: number;
    graphCandidates: number;
    unresolvedDifferentials: number;
  };
};

export type WorkspaceAvailableAction = {
  id: string;
  label: string;
  permission?: string;
  targetTab: WorkspaceTargetTab;
  enabled: boolean;
  disabledReason: string | null;
  targetEndpoint?: string;
};

export type DiagnosisEditorialWorkspace = {
  diagnosis: {
    id: string;
    displayLabel: string;
    canonicalName: string;
    aliases: string[];
    specialty: string | null;
    category: string | null;
    bodySystem: string | null;
    difficultyBand: string | null;
    onboardingStatus?: DiagnosisEditorialOnboardingStatus | null;
    onboardingStartedAt?: string | null;
    onboardingCompletedAt?: string | null;
  };
  onboarding?: DiagnosisEditorialOnboarding | null;
  onboardingStatus?: DiagnosisEditorialOnboardingStatus | null;
  onboardingProgress?: DiagnosisEditorialOnboarding['progress'] | null;
  onboardingRecommendations?: DiagnosisEditorialOnboarding['recommendedActions'];
  lifecycle: WorkspaceLifecycle;
  workspaceSummary: {
    status: DiagnosisWorkspaceOverallStatus | 'ready' | 'needs_review' | string;
    overallScore: number | null;
    graphReadiness: number | string | null;
    educationScore: number | null;
    caseQualitySummary:
      | DiagnosisWorkspaceQualitySummary['caseQuality']
      | WorkspaceCaseSummary;
    blockers: string[];
    warnings: string[];
    recommendedActions: string[];
    unresolvedDifferentialCount?: number;
    registryCandidateCount?: number;
    pendingRegistryCandidateCount?: number;
    differentialResolutionSummary?: {
      resolved: number;
      ambiguous: number;
      unresolved: number;
      rejected: number;
    };
    differentialCoverage?: DifferentialCoverageSummary;
  };
  readinessBreakdown: WorkspaceReadinessItem[];
  coverageMatrix: WorkspaceCoverageMatrixRow[];
  coverageGaps: WorkspaceCoverageGap[];
  teachingRules: {
    summary: {
      total: number;
      active: number;
      approved: number;
      candidates: number;
      needsReview: number;
      critical: number;
    };
    items: DiagnosisTeachingRule[];
  };
  editorialBrief: {
    status: DiagnosisEditorialBriefStatus | string | null;
    version: number | null;
    activeForGeneration: boolean;
    summary: string | null;
    updatedAt: string | null;
  };
  education: {
    id: string | null;
    status:
      | DiagnosisWorkspaceQualitySummary['educationQuality']['status']
      | string;
    version: number | null;
    qualityScore: number | null;
    sectionHealth: WorkspaceSectionFailureSummary[];
    blockers: string[];
    warnings: string[];
    updatedAt: string | null;
  };
  revisions: {
    latest: DiagnosisEducationRevisionAnalysis | null;
    items: DiagnosisEducationRevisionAnalysis[];
  };
  cases: {
    summary: {
      total: number;
      usable: number;
      byStatus: Record<string, number>;
      warningCount: number;
      blockerCount: number;
      latest: WorkspaceCaseSummary['latest'] | null;
    };
    items: Array<{
      id: string;
      title: string;
      editorialStatus: CaseEditorialStatus | null;
      difficulty: string;
      updatedAt: string;
      qualityProjection: AdminCaseQualityProjection;
    }>;
  };
  graph: {
    readiness:
      | 'none'
      | 'candidate_only'
      | 'review_needed'
      | 'fact_ready'
      | string;
    factCount: number;
    candidateCount: number;
    reviewableCandidateCount: number;
    candidates: DiagnosisGraphCandidate[];
    factsSummary: {
      total: number;
      byType: Record<string, number>;
      recent: Array<{
        id: string;
        type: DiagnosisGraphCandidateType;
        label: string;
        targetDiagnosisRegistryId: string | null;
        updatedAt: string;
      }>;
    };
  };
  linkedDifferentials?: StructuredDifferentialLink[];
  editorialLearning: {
    available: boolean;
    candidateCounts: {
      teachingRuleCandidates: number;
      graphFactCandidates: number;
      patternImprovementCandidates: number;
      diagnosisSpecificPearlCandidates: number;
    };
    recentThemes: string[];
  };
  recommendedActions: WorkspaceRecommendedAction[];
  availableActions: WorkspaceAvailableAction[];
};

export type TeachingUnitCoverageStatus =
  | 'covered'
  | 'partial'
  | 'missing'
  | 'unknown';

export type TeachingUnitCoverageMap = {
  diagnosisRegistryId: string;
  diagnosisName: string;
  teachingUnits: Array<{
    id: string;
    title: string;
    source: string;
    status: TeachingUnitCoverageStatus;
    educationCoverage: TeachingUnitCoverageStatus;
    caseCoverage: {
      count: number;
      status: TeachingUnitCoverageStatus;
    };
    graphCoverage: TeachingUnitCoverageStatus;
    relatedSections: string[];
    relatedCaseIds: string[];
    relatedGraphFactIds: string[];
    warnings: string[];
    recommendedAction: string;
  }>;
};

export type DiagnosisTeachingRuleCategory =
  | 'differential_concept'
  | 'finding_concept'
  | 'exam_mechanism'
  | 'investigation_concept'
  | 'pitfall_concept'
  | 'management_concept'
  | 'recall_concept';

export type DiagnosisTeachingRuleImportance =
  | 'critical'
  | 'high'
  | 'supporting';

export type DiagnosisTeachingRuleStatus =
  | 'CANDIDATE'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'DEPRECATED'
  | 'REJECTED';

export type DiagnosisTeachingRuleSource =
  | 'LEGACY_SEED'
  | 'EDITOR_CREATED'
  | 'LEARNED_FROM_REVISION'
  | 'GENERATED'
  | 'GRAPH_DERIVED';

export type DiagnosisTeachingRuleReviewAction =
  | 'approve'
  | 'activate'
  | 'reject'
  | 'deprecate'
  | 'needs_review';

export type DiagnosisTeachingRule = {
  id: string;
  diagnosisRegistryId: string;
  stableKey: string;
  title: string;
  category: DiagnosisTeachingRuleCategory;
  importance: DiagnosisTeachingRuleImportance;
  rationale: string | null;
  acceptableManifestations: JsonValue | null;
  requiredDifferentials: JsonValue | null;
  expectedEvidence: JsonValue | null;
  difficultyHints: JsonValue | null;
  avoidTooEarly: boolean;
  appliesToEducation: boolean;
  appliesToCaseGeneration: boolean;
  appliesToGraph: boolean;
  status: DiagnosisTeachingRuleStatus;
  source: DiagnosisTeachingRuleSource;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type DiagnosisTeachingRulesResponse = {
  diagnosisRegistryId: string;
  diagnosisName: string;
  rules: DiagnosisTeachingRule[];
};

export type DiagnosisTeachingRuleWritePayload = {
  stableKey?: string;
  title?: string;
  category?: DiagnosisTeachingRuleCategory;
  importance?: DiagnosisTeachingRuleImportance;
  rationale?: string | null;
  acceptableManifestations?: JsonValue[];
  requiredDifferentials?: JsonValue[];
  avoidTooEarly?: boolean;
  appliesToEducation?: boolean;
  appliesToCaseGeneration?: boolean;
  appliesToGraph?: boolean;
  status?: DiagnosisTeachingRuleStatus;
  source?: DiagnosisTeachingRuleSource;
};

export type DiagnosisTeachingRuleGenerateResult = {
  diagnosisRegistryId: string;
  generatedCount: number;
  rules: DiagnosisTeachingRule[];
};

export type DiagnosisTeachingRuleSeedResult = {
  diagnosesMatched: number;
  diagnosesSkipped: number;
  rulesUpserted: number;
  skippedDiagnosisKeys: string[];
};

export type DiagnosisEditorialBriefStatus =
  | 'DRAFT'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'DEPRECATED';

export type DiagnosisEditorialBriefReviewAction =
  | 'approve'
  | 'activate'
  | 'deprecate'
  | 'needs_review'
  | 'draft';

export type DiagnosisEditorialBrief = {
  id: string;
  diagnosisRegistryId: string;
  summary: string;
  learningGoals: JsonValue;
  requiredTeachingRuleIds: JsonValue;
  requiredMimicIds: JsonValue | null;
  requiredPitfalls: JsonValue | null;
  keyInvestigations: JsonValue | null;
  managementAnchors: JsonValue | null;
  difficultyGuidance: JsonValue | null;
  caseGenerationGuidance: JsonValue | null;
  educationGuidance: JsonValue | null;
  graphGuidance: JsonValue | null;
  status: DiagnosisEditorialBriefStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type DiagnosisEditorialBriefResponse = {
  diagnosisRegistryId: string;
  diagnosisName: string;
  brief: DiagnosisEditorialBrief | null;
};

export type DiagnosisEditorialBriefWritePayload = {
  summary?: string;
  learningGoals?: JsonValue[];
  requiredTeachingRuleIds?: JsonValue[];
  requiredMimicIds?: JsonValue[] | null;
  requiredPitfalls?: JsonValue[] | null;
  keyInvestigations?: JsonValue[] | null;
  managementAnchors?: JsonValue[] | null;
  difficultyGuidance?: JsonValue[] | null;
  caseGenerationGuidance?: JsonValue[] | null;
  educationGuidance?: JsonValue[] | null;
  graphGuidance?: JsonValue[] | null;
  status?: DiagnosisEditorialBriefStatus;
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

export type CaseQualityStatus = 'good' | 'warning' | 'blocker' | 'unknown';

export type CaseQualityDimension = {
  status: CaseQualityStatus;
  score: number | null;
  warnings: string[];
  blockers: string[];
  summary: string;
};

export type AdminCaseQualityProjection = {
  dimensions: {
    clinicalValidity: CaseQualityDimension;
    differentialPlausibility: CaseQualityDimension;
    teachingAlignment: CaseQualityDimension;
    revealTiming: CaseQualityDimension;
    mimicPersistence: CaseQualityDimension;
    playability: CaseQualityDimension;
    difficultyFit: CaseQualityDimension;
  };
  warnings: string[];
  blockers: string[];
  sourceSummary: {
    hasValidationRun: boolean;
    hasValidationFindings: boolean;
    hasGenerationQuality: boolean;
    hasTeachingAlignment: boolean;
  };
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
  linkedDifferentials?: StructuredDifferentialLink[];
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
  qualityProjection?: AdminCaseQualityProjection;
};

export type GenerateTargetedCaseResult = {
  result: GenerateCasesResult;
  generatedCase: EditorialCaseDetail | null;
  validation: EditorialCaseDetail['validationRuns'][number] | null;
  qualityProjection: AdminCaseQualityProjection | null;
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
