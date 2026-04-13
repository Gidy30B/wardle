import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import MetricCard from '../../components/MetricCard';
import { fetchDashboard, type DashboardPayload } from '../../api/admin';
import { createApiClient } from '../../api/client';
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
    return <p className="text-sm text-slate-600">Loading analytics...</p>;
  }

  if (error || !dashboard) {
    return <p className="text-sm text-red-600">{error ?? 'Unable to load analytics'}</p>;
  }

  const signals = dashboard.signals.data[0] ?? {
    embeddingAvg: 0,
    fuzzyAvg: 0,
    ontologyAvg: 0,
  };
  const fallbackRate = (dashboard.fallback.data[0]?.fallbackRate ?? 0) * 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Embedding Avg" value={signals.embeddingAvg.toFixed(2)} />
        <MetricCard title="Fuzzy Avg" value={signals.fuzzyAvg.toFixed(2)} />
        <MetricCard title="Ontology Avg" value={signals.ontologyAvg.toFixed(2)} />
        <MetricCard title="Fallback Rate" value={`${fallbackRate.toFixed(2)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <AccuracyChart data={dashboard.accuracy.data} />
        <WrongGuessesPanel data={dashboard.topWrong.data} />
      </div>
    </div>
  );
}
