import type { DiagnosisWorkspaceQualitySummary } from '../../../api/admin';

type DiagnosisWorkspaceSummaryCardProps = {
  summary: DiagnosisWorkspaceQualitySummary | null;
  loading: boolean;
  error: string | null;
};

const statusClasses: Record<string, string> = {
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  needs_review: 'border-amber-200 bg-amber-50 text-amber-700',
  blocked: 'border-rose-200 bg-rose-50 text-rose-700',
  insufficient_data: 'border-slate-200 bg-slate-100 text-slate-600',
};

export default function DiagnosisWorkspaceSummaryCard({
  summary,
  loading,
  error,
}: DiagnosisWorkspaceSummaryCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Workspace Quality Summary
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Diagnosis-level readiness across education, cases, graph, and revisions.
          </p>
        </div>
        {summary ? (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses[summary.overallWorkspaceStatus]}`}
          >
            {formatLabel(summary.overallWorkspaceStatus)}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">
          Loading workspace summary...
        </p>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : summary ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <Metric
              label="Education"
              value={formatScore(summary.educationQuality.score)}
              hint={formatLabel(summary.educationQuality.status)}
            />
            <Metric
              label="Case quality"
              value={`${summary.caseQuality.usableCases}/${summary.caseQuality.totalCases}`}
              hint={formatLabel(summary.caseQuality.status)}
            />
            <Metric
              label="Coverage"
              value={formatScore(summary.teachingCoverage.overall)}
              hint={`${summary.teachingCoverage.missingItems.length} missing`}
            />
            <Metric
              label="Graph"
              value={formatLabel(summary.graphReadiness.status)}
              hint={`${summary.graphReadiness.factCount} facts`}
            />
            <Metric
              label="Brief"
              value={summary.editorialBrief?.status
                ? formatLabel(summary.editorialBrief.status)
                : 'Missing'}
              hint={summary.editorialBrief?.activeForGeneration
                ? 'Drives generation'
                : 'Not active'}
            />
            <Metric
              label="Trend"
              value={formatTrend(summary.revisionTrend)}
              hint={formatTrendDelta(summary.revisionTrend.overallDelta)}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ChipList
              title="Top blockers"
              items={summary.blockers}
              empty="No blockers."
              tone="danger"
            />
            <ChipList
              title="Top warnings"
              items={summary.warnings}
              empty="No warnings."
              tone="warning"
            />
            <ChipList
              title="Next actions"
              items={summary.recommendedNextActions}
              empty="No action needed."
              tone="info"
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No workspace summary is available yet.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function ChipList({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: 'danger' | 'warning' | 'info';
}) {
  const classes = {
    danger: 'bg-rose-50 text-rose-700',
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-sky-50 text-sky-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.slice(0, 5).map((item) => (
            <span
              key={item}
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${classes[tone]}`}
            >
              {formatLabel(item)}
            </span>
          ))}
          {items.length > 5 ? (
            <span className="px-1 py-1 text-[11px] font-semibold text-slate-500">
              +{items.length - 5} more
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function formatScore(value: number | null) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Unknown';
}

function formatTrend(
  trend: DiagnosisWorkspaceQualitySummary['revisionTrend'],
) {
  return formatLabel(trend.direction);
}

function formatTrendDelta(delta: number | null) {
  if (delta === null || Math.abs(delta) < 0.005) {
    return 'No score delta';
  }

  return `${delta > 0 ? '+' : ''}${Math.round(delta * 100)} pts`;
}

function formatLabel(value: string) {
  return value
    .split(':')
    .map((part) =>
      part
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    )
    .join(': ');
}
