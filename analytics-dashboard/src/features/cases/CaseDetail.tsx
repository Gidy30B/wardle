import type { AccuracyPoint } from '../../api/admin';

type CaseDetailProps = {
  row: AccuracyPoint | null;
};

function getPerformanceLabel(accuracy: number): string {
  if (accuracy >= 0.8) {
    return 'Strong';
  }

  if (accuracy >= 0.5) {
    return 'Moderate';
  }

  return 'Needs review';
}

export default function CaseDetail({ row }: CaseDetailProps) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        Select a case to inspect its performance summary.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        Case Detail
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">{row.caseId}</h2>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-3">
          <dt className="text-slate-500">Accuracy</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {(row.accuracy * 100).toFixed(2)}%
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-3">
          <dt className="text-slate-500">Attempts</dt>
          <dd className="mt-1 font-semibold text-slate-900">{row.attempts}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-3">
          <dt className="text-slate-500">Performance</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {getPerformanceLabel(row.accuracy)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
