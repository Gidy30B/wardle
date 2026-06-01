import type { DiagnosisEducationRevisionAnalysis } from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import { formatDateLabel } from '../cases.helpers';

type RevisionHistoryCardProps = {
  revisions: DiagnosisEducationRevisionAnalysis[];
  loading: boolean;
  error: string | null;
};

export default function RevisionHistoryCard({
  revisions,
  loading,
  error,
}: RevisionHistoryCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Revision history
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Quality trend across saved education versions.
          </p>
        </div>
        {revisions.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {revisions.length} versions
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading revision history...</p>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : revisions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No saved education revisions yet.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {revisions.map((revision) => (
            <RevisionRow key={revision.id} revision={revision} />
          ))}
        </div>
      )}
    </section>
  );
}

function RevisionRow({
  revision,
}: {
  revision: DiagnosisEducationRevisionAnalysis;
}) {
  const tone = getQualityTone(revision);
  const qualityClasses = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              v{revision.version} · {revisionActionLabel(revision)}
            </p>
            <StatusBadge status={revision.editorialStatus} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatDateLabel(revision.createdAt)}
          </p>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${qualityClasses[tone]}`}
        >
          {qualityLabel(revision)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric label="Quality" value={formatScore(revision.quality.overallScore)} />
        <Metric
          label="Graph"
          value={formatScore(revision.quality.graphReadiness)}
        />
        <Metric label="Blockers" value={String(revision.quality.blockerCount)} />
        <Metric label="Warnings" value={String(revision.quality.warningCount)} />
      </div>

      {revision.changedSections?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {revision.changedSections.slice(0, 5).map((section) => (
            <span
              key={section}
              className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
            >
              {formatSectionLabel(section)}
            </span>
          ))}
          {revision.changedSections.length > 5 ? (
            <span className="px-1 py-1 text-[11px] font-semibold text-slate-500">
              +{revision.changedSections.length - 5} more
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getQualityTone(revision: DiagnosisEducationRevisionAnalysis) {
  if (revision.quality.blockerCount > 0) {
    return 'danger';
  }

  if (revision.quality.warningCount > 0) {
    return 'warning';
  }

  return 'good';
}

function qualityLabel(revision: DiagnosisEducationRevisionAnalysis) {
  if (revision.quality.blockerCount > 0) {
    return 'Blockers';
  }

  if (revision.quality.warningCount > 0) {
    return 'Warnings';
  }

  return 'Good';
}

function revisionActionLabel(revision: DiagnosisEducationRevisionAnalysis) {
  if (revision.editorialStatus === 'PUBLISHED') {
    return 'Published';
  }

  if (revision.source === 'MANUAL') {
    return 'Manual edit';
  }

  const changed = revision.changedSections ?? [];
  const changedRegenerable = changed.filter((section) =>
    ['differentials', 'investigations', 'examPearls', 'management'].includes(
      section,
    ),
  );

  if (revision.source === 'AI_ASSISTED' && changedRegenerable.length === 1) {
    return `Regenerated ${formatSectionLabel(changedRegenerable[0]).toLowerCase()}`;
  }

  if (revision.source === 'AI_ASSISTED') {
    return 'AI draft';
  }

  if (revision.source === 'HYBRID') {
    return 'Hybrid edit';
  }

  if (revision.source === 'IMPORTED') {
    return 'Imported';
  }

  return formatSectionLabel(revision.source);
}

function formatScore(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Not scored';
  }

  return `${Math.round(value * 100)}%`;
}

function formatSectionLabel(value: string) {
  const words = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ');

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
