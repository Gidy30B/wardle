import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchDashboard, type AccuracyPoint } from '../../api/admin';
import { createApiClient } from '../../api/client';
import CaseDetail from './CaseDetail';
import CaseTable from './CaseTable';

export default function CasesPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [rows, setRows] = useState<AccuracyPoint[]>([]);
  const [selectedCase, setSelectedCase] = useState<AccuracyPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const dashboard = await fetchDashboard(client);

        if (!active) {
          return;
        }

        setRows(dashboard.accuracy.data);
        setSelectedCase(dashboard.accuracy.data[0] ?? null);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load case data',
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
    return <p className="text-sm text-slate-600">Loading cases...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <CaseTable
          rows={rows}
          selectedCaseId={selectedCase?.caseId ?? null}
          onSelect={setSelectedCase}
        />
        <CaseDetail row={selectedCase} />
      </div>
    </div>
  );
}
