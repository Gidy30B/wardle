import type {
  DiagnosisEducationRevisionAnalysis,
  DiagnosisEducationRevisionCompareResult,
} from '../../../api/admin';

type RevisionCompareCardProps = {
  revisions: DiagnosisEducationRevisionAnalysis[];
  selectedFromVersion: number | null;
  selectedToVersion: number | null;
  comparison: DiagnosisEducationRevisionCompareResult | null;
  loading: boolean;
  error: string | null;
  onFromVersionChange: (version: number | null) => void;
  onToVersionChange: (version: number | null) => void;
};

export default function RevisionCompareCard({
  revisions,
  selectedFromVersion,
  selectedToVersion,
  comparison,
  loading,
  error,
  onFromVersionChange,
  onToVersionChange,
}: RevisionCompareCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Revision compare
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Editorial changes between two saved versions.
          </p>
        </div>
        {comparison ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            v{comparison.fromVersion} to v{comparison.toVersion}
          </span>
        ) : null}
      </div>

      {revisions.length < 2 ? (
        <p className="mt-4 text-sm text-slate-500">
          At least two revisions are needed before comparison is available.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RevisionSelect
              label="Old revision"
              revisions={revisions}
              value={selectedFromVersion}
              onChange={onFromVersionChange}
            />
            <RevisionSelect
              label="New revision"
              revisions={revisions}
              value={selectedToVersion}
              onChange={onToVersionChange}
            />
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">
              Comparing revisions...
            </p>
          ) : error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          ) : comparison ? (
            <ComparisonSummary comparison={comparison} />
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Choose two revisions to compare.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function RevisionSelect({
  label,
  revisions,
  value,
  onChange,
}: {
  label: string;
  revisions: DiagnosisEducationRevisionAnalysis[];
  value: number | null;
  onChange: (version: number | null) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">Select revision</option>
        {revisions.map((revision) => (
          <option key={revision.id} value={revision.version}>
            v{revision.version} - {revisionSelectLabel(revision)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonSummary({
  comparison,
}: {
  comparison: DiagnosisEducationRevisionCompareResult;
}) {
  const improvedSections = comparison.sectionChanges.filter(
    (section) => section.direction === 'improved',
  );
  const regressedSections = comparison.sectionChanges.filter(
    (section) => section.direction === 'regressed',
  );
  const unchanged =
    comparison.blockerChanges.added.length === 0 &&
    comparison.blockerChanges.removed.length === 0 &&
    comparison.warningChanges.added.length === 0 &&
    comparison.warningChanges.removed.length === 0 &&
    improvedSections.length === 0 &&
    regressedSections.length === 0;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">
          v{comparison.fromVersion} {'->'} v{comparison.toVersion}
        </p>
        <ToneBadge label={unchanged ? 'No meaningful change' : 'Improved'} tone={unchanged ? 'muted' : 'good'} hidden={regressedSections.length > 0 && improvedSections.length === 0} />
        {regressedSections.length > 0 ? (
          <ToneBadge label="Regressed" tone="danger" />
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <DeltaTile label="Overall score" delta={comparison.overallDelta} />
        <DeltaTile
          label="Graph readiness"
          delta={comparison.graphReadinessDelta}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListPanel
          title="Blockers removed"
          items={comparison.blockerChanges.removed}
          tone="good"
          empty="No blockers removed."
        />
        <ListPanel
          title="New blockers"
          items={comparison.blockerChanges.added}
          tone="danger"
          empty="No new blockers."
        />
        <ListPanel
          title="Warnings removed"
          items={comparison.warningChanges.removed}
          tone="good"
          empty="No warnings removed."
        />
        <ListPanel
          title="Warnings added"
          items={comparison.warningChanges.added}
          tone="warning"
          empty="No new warnings."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionPanel
          title="Improved sections"
          sections={improvedSections}
          tone="good"
          empty="No improved sections."
        />
        <SectionPanel
          title="Regressed sections"
          sections={regressedSections}
          tone="danger"
          empty="No regressed sections."
        />
        <ChipPanel
          title="Changed sections"
          items={comparison.changedSections}
          empty="No changed sections detected."
        />
      </div>
    </div>
  );
}

function DeltaTile({ label, delta }: { label: string; delta: number }) {
  const tone = delta > 0 ? 'good' : delta < 0 ? 'danger' : 'muted';
  const classes = toneClasses[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${classes}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{formatDelta(delta)}</p>
    </div>
  );
}

function ListPanel({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: 'good' | 'warning' | 'danger';
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.slice(0, 6).map((item) => (
            <span
              key={item}
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${chipClasses[tone]}`}
            >
              {formatCodeLabel(item)}
            </span>
          ))}
          {items.length > 6 ? (
            <span className="px-1 py-1 text-[11px] font-semibold text-slate-500">
              +{items.length - 6} more
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function SectionPanel({
  title,
  sections,
  tone,
  empty,
}: {
  title: string;
  sections: DiagnosisEducationRevisionCompareResult['sectionChanges'];
  tone: 'good' | 'danger';
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {sections.length ? (
        <div className="mt-2 space-y-1">
          {sections.map((section) => (
            <div
              key={section.section}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="font-medium text-slate-700">
                {formatSectionLabel(section.section)}
              </span>
              <span className={`font-semibold ${sectionTextClasses[tone]}`}>
                {formatDelta(section.delta)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function ChipPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
            >
              {formatSectionLabel(item)}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function ToneBadge({
  label,
  tone,
  hidden = false,
}: {
  label: string;
  tone: 'good' | 'danger' | 'muted';
  hidden?: boolean;
}) {
  if (hidden) {
    return null;
  }

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

const toneClasses = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  muted: 'border-slate-200 bg-slate-100 text-slate-600',
};

const chipClasses = {
  good: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
};

const sectionTextClasses = {
  good: 'text-emerald-700',
  danger: 'text-rose-700',
};

function revisionSelectLabel(revision: DiagnosisEducationRevisionAnalysis) {
  if (revision.editorialStatus === 'PUBLISHED') {
    return 'Published';
  }

  if (revision.source === 'MANUAL') {
    return 'Manual edit';
  }

  if (revision.source === 'AI_ASSISTED') {
    return 'AI draft';
  }

  return formatSectionLabel(revision.source);
}

function formatDelta(delta: number | null) {
  if (delta === null || Number.isNaN(delta)) {
    return 'No meaningful change';
  }

  if (Math.abs(delta) < 0.005) {
    return 'No meaningful change';
  }

  const sign = delta > 0 ? '+' : '';
  return `${sign}${Math.round(delta * 100)} pts`;
}

function formatCodeLabel(value: string) {
  return value
    .split(':')
    .map(formatSectionLabel)
    .join(': ');
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
