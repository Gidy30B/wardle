import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import MetricCard from '../../components/MetricCard';
import { fetchDashboard, type DashboardPayload } from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import AttemptsChart from '../dashboard/AttemptsChart';
import AccuracyChart from './AccuracyChart';
import WrongGuessesPanel from './WrongGuessesPanel';

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchDashboard(client);
        if (!active) {
          return;
        }

        setDashboard(response);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load analytics data',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [client]);

  if (loading) {
    return (
      <LoadingState
        title="Loading analytics"
        description="Fetching quality and gameplay trend data."
      />
    );
  }

  if (error || !dashboard) {
    return (
      <ErrorState
        title="Unable to load analytics"
        message={error ?? 'Analytics data is unavailable right now.'}
      />
    );
  }

  const signals = dashboard.signals.data[0] ?? {
    embeddingAvg: 0,
    fuzzyAvg: 0,
    ontologyAvg: 0,
  };
  const fallbackRate = (dashboard.fallback.data[0]?.fallbackRate ?? 0) * 100;
  const accuracyItems = dashboard.accuracy.data;
  const averageAccuracy =
    accuracyItems.length === 0
      ? 0
      : accuracyItems.reduce((sum, item) => sum + item.accuracy * 100, 0) /
        accuracyItems.length;
  const totalAttempts = dashboard.attemptsOverTime.data.reduce(
    (sum, point) => sum + point.attempts,
    0,
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Gameplay and quality
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Trend context and performance signals
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Use this page for gameplay trends, answer quality, and retrieval signal
            health rather than the operational overview.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard title="Total Attempts" value={totalAttempts} />
          <MetricCard title="Average Accuracy" value={`${averageAccuracy.toFixed(2)}%`} />
          <MetricCard title="Embedding Avg" value={signals.embeddingAvg.toFixed(2)} />
          <MetricCard title="Fuzzy Avg" value={signals.fuzzyAvg.toFixed(2)} />
          <MetricCard title="Ontology Avg" value={signals.ontologyAvg.toFixed(2)} />
          <MetricCard title="Fallback Rate" value={`${fallbackRate.toFixed(2)}%`} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Activity trends
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Attempts over time
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Review overall player activity here, alongside the quality metrics that help
            explain performance changes.
          </p>
        </div>

        <div className="max-w-5xl">
          <AttemptsChart data={dashboard.attemptsOverTime.data} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Quality detail
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Accuracy and wrong-answer patterns
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Use these views to inspect case-level accuracy and the most common failed
            guesses.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <AccuracyChart data={dashboard.accuracy.data} />
          <WrongGuessesPanel data={dashboard.topWrong.data} />
        </div>
      </section>
    </div>
  );
}
