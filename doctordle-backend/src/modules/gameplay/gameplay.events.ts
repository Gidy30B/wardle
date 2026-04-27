export const GameplayEventName = {
  AttemptSubmitted: 'attempt.submitted',
  AttemptEvaluated: 'attempt.evaluated',
  AttemptRecorded: 'attempt.recorded',
  AttemptRecordFailed: 'attempt.record_failed',
  SessionCompleted: 'session.completed',
  RewardRequested: 'reward.requested',
  RewardApplied: 'reward.applied',
} as const;

export type AttemptSubmittedEvent = {
  sessionId: string;
  userId: string;
};

export type AttemptEvaluatedEvent = {
  sessionId: string;
  userId: string;
  result: string;
  semanticScore: number;
  evaluatorVersion: string;
  retrievalMode: string;
  submittedDiagnosisRegistryId?: string | null;
  submittedGuessText?: string | null;
  resolvedDiagnosisRegistryId?: string | null;
  resolutionMethod?: string | null;
  resolutionReason?: string | null;
};

export type AttemptRecordedEvent = {
  caseId: string;
  sessionId: string;
  userId: string;
  score: number;
  result: string;
  evaluatorVersion: string;
  latency: number;
};

export type AttemptRecordFailedEvent = {
  caseId: string;
  sessionId: string;
  userId: string;
  evaluatorVersion: string;
  error: unknown;
};

export type SessionCompletedEvent = {
  sessionId: string;
  userId: string;
  reason: 'correct' | 'clues_exhausted';
};

export type RewardRequestedEvent = {
  sessionId: string;
  userId: string;
};

export type RewardAppliedEvent = {
  sessionId: string;
  userId: string;
};
