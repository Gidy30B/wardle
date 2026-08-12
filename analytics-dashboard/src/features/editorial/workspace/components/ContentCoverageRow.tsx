import StatusBadge from '../../../../components/ui/StatusBadge';
import type { ContentCoverageRowViewModel } from '../viewModels/contentCoverageViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function ContentCoverageRow({
  row,
}: {
  row: ContentCoverageRowViewModel;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{row.label}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            {row.kind.replace(/_/g, ' ')}
          </p>
        </div>
        <StatusBadge status={row.tone} tone={toneToBadge(row.tone)} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <CoverageCell label="Education" covered={row.educationCovered} />
        <CoverageCell label="Recall" covered={row.recallCovered} />
        <CoverageCell label="Cases" covered={row.caseCovered} />
      </div>

      {row.gapReason ? (
        <p className="mt-3 text-xs leading-5 text-amber-200">{row.gapReason}</p>
      ) : null}
    </article>
  );
}

function CoverageCell({ label, covered }: { label: string; covered: boolean }) {
  return (
    <span className="rounded-md border border-white/10 bg-black/10 px-2 py-1">
      {label}: {covered ? 'covered' : 'missing'}
    </span>
  );
}
