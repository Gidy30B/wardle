import type { DiagnosisEducationRevisionAnalysis } from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import {
  EmptyGuidance,
  PrototypeSectionHeader,
} from '../../editorial/workspace/EditorialPrimitives';
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
    <section className="editorial-panel rounded-lg p-4">
      <PrototypeSectionHeader
        eyebrow="Editorial checkpoints"
        title="Revision history"
        subtitle="Quality trend across saved education versions."
        action={
          revisions.length > 0 ? (
            <StatusBadge status={`${revisions.length} versions`} tone="info" />
          ) : null
        }
      />

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading revision history...</p>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : revisions.length === 0 ? (
        <div className="mt-4">
          <EmptyGuidance
            title="No saved education revisions yet"
            description="Saved drafts and review decisions will appear here as lightweight checkpoints."
          />
        </div>
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
    good: 'border-[var(--color-green)]/30 bg-[var(--color-green)]/10 text-[var(--color-green)]',
    warning: 'border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 text-[var(--color-amber)]',
    danger: 'border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 text-[var(--color-rose)]',
  };

  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">
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
              className="rounded-full border border-[var(--color-navy-border)] bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300"
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
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
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
