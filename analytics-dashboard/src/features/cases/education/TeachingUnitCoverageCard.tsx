import type {
  TeachingUnitCoverageMap,
  TeachingUnitCoverageStatus,
} from '../../../api/admin';

type Props = {
  coverage: TeachingUnitCoverageMap | null;
  loading: boolean;
  error: string | null;
};

const statusClasses: Record<TeachingUnitCoverageStatus, string> = {
  covered: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  missing: 'bg-rose-50 text-rose-700',
  unknown: 'bg-slate-100 text-slate-600',
};

export default function TeachingUnitCoverageCard({
  coverage,
  loading,
  error,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          Teaching Unit Coverage Map
        </p>
        <p className="mt-1 text-sm text-slate-500">
          What this diagnosis should teach, and where that teaching is covered.
        </p>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">
          Loading teaching unit coverage...
        </p>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : !coverage || coverage.teachingUnits.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No teaching units are configured for this diagnosis yet.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Teaching Unit</th>
                <th className="px-3 py-2 text-left">Education</th>
                <th className="px-3 py-2 text-left">Cases</th>
                <th className="px-3 py-2 text-left">Graph</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {coverage.teachingUnits.map((unit) => (
                <tr key={unit.id}>
                  <td className="px-3 py-3 font-medium text-slate-800">
                    {unit.title}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={unit.educationCoverage} />
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses[unit.caseCoverage.status]}`}
                    >
                      {unit.caseCoverage.count
                        ? `${unit.caseCoverage.count} cases`
                        : label(unit.caseCoverage.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={unit.graphCoverage} />
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {unit.recommendedAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: TeachingUnitCoverageStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses[status]}`}
    >
      {label(status)}
    </span>
  );
}

function label(status: TeachingUnitCoverageStatus) {
  if (status === 'covered') {
    return 'Covered';
  }
  if (status === 'partial') {
    return 'Partial';
  }
  if (status === 'missing') {
    return 'Missing';
  }
  return 'Unknown';
}
