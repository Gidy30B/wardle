import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchAttemptsOverTime,
  fetchDashboard,
  type AttemptsOverTimePayload,
  type DashboardPayload,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import AttemptsChart from './AttemptsChart';
import DashboardStats from './DashboardStats';

export default function DashboardPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [attempts, setAttempts] = useState<AttemptsOverTimePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [dashboardResponse, attemptsResponse] = await Promise.all([
          fetchDashboard(client),
          fetchAttemptsOverTime(client),
        ]);

        if (!active) {
          return;
        }

        setDashboard(dashboardResponse);
        setAttempts(attemptsResponse);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load dashboard data',
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

  const totalCases = dashboard?.accuracy.data.length ?? 0;
  const averageAccuracy = useMemo(() => {
    if (!dashboard || dashboard.accuracy.data.length === 0) {
      return 0;
    }

    const total = dashboard.accuracy.data.reduce(
      (sum, item) => sum + item.accuracy * 100,
      0,
    );

    return total / dashboard.accuracy.data.length;
  }, [dashboard]);
  const totalAttempts = useMemo(
    () =>
      attempts?.data.reduce((sum, point) => sum + point.attempts, 0) ?? 0,
    [attempts],
  );

  if (loading) {
    return <p className="text-sm text-slate-600">Loading dashboard...</p>;
  }

  if (error || !dashboard || !attempts) {
    return <p className="text-sm text-red-600">{error ?? 'Unable to load dashboard'}</p>;
  }

  return (
    <div className="space-y-6">
      <DashboardStats
        totalCases={totalCases}
        averageAccuracy={averageAccuracy}
        totalAttempts={totalAttempts}
      />

      <AttemptsChart data={attempts.data} />
    </div>
  );
}
