import type { ApiClient } from './client';

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

export function fetchAdminViewer(client: ApiClient) {
  return client.get<AdminViewer>('/auth/me');
}

export function fetchDashboard(client: ApiClient) {
  return client.get<DashboardPayload>('/dashboard');
}

export function fetchAttemptsOverTime(client: ApiClient) {
  return client.get<AttemptsOverTimePayload>('/attempts-over-time');
}

export function generateCases(client: ApiClient, payload: GenerateCasesPayload) {
  return client.post<GenerateCasesResult>('/admin/generate-cases', payload);
}
