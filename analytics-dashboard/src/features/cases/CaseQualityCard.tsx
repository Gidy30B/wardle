import type {
  AdminCaseQualityProjection,
  CaseQualityDimension,
  CaseQualityStatus,
} from '../../api/admin';
import CaseDetailSection from './CaseDetailSection';

type CaseQualityCardProps = {
  projection?: AdminCaseQualityProjection;
};

const dimensionLabels: Array<{
  key: keyof AdminCaseQualityProjection['dimensions'];
  label: string;
}> = [
  { key: 'clinicalValidity', label: 'Clinical validity' },
  { key: 'differentialPlausibility', label: 'Differential plausibility' },
  { key: 'teachingAlignment', label: 'Teaching alignment' },
  { key: 'revealTiming', label: 'Reveal timing' },
  { key: 'mimicPersistence', label: 'Mimic persistence' },
  { key: 'playability', label: 'Playability' },
  { key: 'difficultyFit', label: 'Difficulty fit' },
];

const toneClasses: Record<CaseQualityStatus, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  blocker: 'border-rose-200 bg-rose-50 text-rose-700',
  unknown: 'border-slate-200 bg-slate-100 text-slate-600',
};

export default function CaseQualityCard({ projection }: CaseQualityCardProps) {
  if (!projection) {
    return (
      <CaseDetailSection
        title="Case Quality"
        description="Clinical validity, playability, and teaching alignment."
      >
        <p className="text-sm text-slate-500">
          No case quality projection is available yet.
        </p>
      </CaseDetailSection>
    );
  }

  return (
    <CaseDetailSection
      title="Case Quality"
      description="Clinical validity, playability, and teaching alignment."
    >
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {dimensionLabels.map(({ key, label }) => (
            <DimensionTile
              key={key}
              label={label}
              dimension={projection.dimensions[key]}
            />
          ))}
        </div>

        {projection.blockers.length || projection.warnings.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <IssueList
              title="Blockers"
              items={projection.blockers}
              empty="No quality blockers."
              tone="blocker"
            />
            <IssueList
              title="Warnings"
              items={projection.warnings}
              empty="No quality warnings."
              tone="warning"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          <SourceChip
            active={projection.sourceSummary.hasValidationRun}
            label="Validation"
          />
          <SourceChip
            active={projection.sourceSummary.hasGenerationQuality}
            label="Generation quality"
          />
          <SourceChip
            active={projection.sourceSummary.hasTeachingAlignment}
            label="Teaching alignment"
          />
        </div>
      </div>
    </CaseDetailSection>
  );
}

function DimensionTile({
  label,
  dimension,
}: {
  label: string;
  dimension: CaseQualityDimension;
}) {
  return (
    <div className={`rounded-xl border p-3 ${toneClasses[dimension.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold capitalize">
            {statusLabel(dimension.status)}
          </p>
        </div>
        {dimension.score !== null ? (
          <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold">
            {formatScore(dimension.score)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm opacity-90">{dimension.summary}</p>
    </div>
  );
}

function IssueList({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: 'warning' | 'blocker';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.slice(0, 8).map((item) => (
            <span
              key={item}
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${tone === 'blocker' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}
            >
              {formatCodeLabel(item)}
            </span>
          ))}
          {items.length > 8 ? (
            <span className="px-1 py-1 text-[11px] font-semibold text-slate-500">
              +{items.length - 8} more
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function SourceChip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
        active ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {label}: {active ? 'present' : 'missing'}
    </span>
  );
}

function statusLabel(status: CaseQualityStatus) {
  if (status === 'blocker') {
    return 'Weak';
  }

  return status;
}

function formatScore(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatCodeLabel(value: string) {
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
