type ApiEnvelope<T> = {
  data: T;
  meta: {
    generatedAt: number;
    count: number;
  };
};

export type DashboardPayload = {
  topWrong: ApiEnvelope<Array<{ guess: string; count: number }>>;
  accuracy: ApiEnvelope<Array<{ caseId: string; accuracy: number; attempts: number }>>;
  signals: ApiEnvelope<Array<{ embeddingAvg: number; fuzzyAvg: number; ontologyAvg: number }>>;
  fallback: ApiEnvelope<Array<{ fallbackRate: number }>>;
  attemptsOverTime: ApiEnvelope<Array<{ time: string; attempts: number }>>;
};

export async function fetchDashboard(): Promise<DashboardPayload> {
  const res = await fetch('/analytics/dashboard');
  if (!res.ok) {
    throw new Error('Failed to fetch dashboard');
  }

  return res.json();
}

export async function fetchAttemptsOverTime(): Promise<
  ApiEnvelope<Array<{ time: string; attempts: number }>>
> {
  const res = await fetch('/analytics/attempts-over-time');
  if (!res.ok) {
    throw new Error('Failed to fetch attempts over time');
  }

  return res.json();
}
