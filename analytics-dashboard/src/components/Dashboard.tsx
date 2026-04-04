import { useEffect, useMemo, useState } from 'react';
import MetricCard from './MetricCard';
import AttemptsChart from './Charts/AttemptsChart';
import AccuracyChart from './Charts/AccuracyChart';
import SignalsChart from './Charts/SignalsChart';
import { fetchDashboard, fetchAttemptsOverTime, type DashboardPayload } from '../services/analytics.api';

type AttemptsResponse = {
  data: Array<{ time: string; attempts: number }>;
};

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [attempts, setAttempts] = useState<Array<{ time: string; attempts: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [dash, attemptsData] = await Promise.all([
          fetchDashboard(),
          fetchAttemptsOverTime() as Promise<AttemptsResponse>,
        ]);

        setDashboard(dash);
        setAttempts(attemptsData.data);
      } catch {
        setError('Failed to load analytics dashboard');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const totalAttempts = useMemo(
    () => attempts.reduce((sum, point) => sum + point.attempts, 0),
    [attempts],
  );

  const avgAccuracy = useMemo(() => {
    if (!dashboard || dashboard.accuracy.data.length === 0) {
      return 0;
    }

    const total = dashboard.accuracy.data.reduce(
      (sum, item) => sum + item.accuracy,
      0,
    );

    return total / dashboard.accuracy.data.length;
  }, [dashboard]);

  if (loading) {
    return <p className="p-6 text-slate-600">Loading analytics...</p>;
  }

  if (error || !dashboard) {
    return <p className="p-6 text-red-600">{error ?? 'Unable to load data'}</p>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Fallback Rate"
          value={`${((dashboard.fallback.data[0]?.fallbackRate ?? 0) * 100).toFixed(2)}%`}
        />
        <MetricCard
          title="Top Wrong Guess"
          value={dashboard.topWrong.data[0]?.guess ?? 'N/A'}
        />
        <MetricCard title="Total Attempts" value={totalAttempts} />
        <MetricCard title="Avg Accuracy" value={avgAccuracy.toFixed(2)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AttemptsChart data={attempts} />
        <AccuracyChart data={dashboard.accuracy.data} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SignalsChart
          data={
            dashboard.signals.data[0] ?? {
              embeddingAvg: 0,
              fuzzyAvg: 0,
              ontologyAvg: 0,
            }
          }
        />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Top Wrong Guesses</h2>
        <ul>
          {dashboard.topWrong.data.map((item, index) => (
            <li key={`${item.guess}-${index}`} className="flex justify-between border-b border-slate-100 py-2 text-sm">
              <span className="text-slate-700">{item.guess}</span>
              <span className="font-medium text-slate-900">{item.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
