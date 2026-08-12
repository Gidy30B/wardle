import type { ReasoningCoverageRowViewModel } from '../viewModels/caseReasoningViewModel.ts';

export function ReasoningCoverageRow({
  row,
}: {
  row: ReasoningCoverageRowViewModel;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <p className="text-sm font-semibold text-slate-100">{row.label}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <CoverageCell label="Evidence" covered={row.evidenceCovered} />
        <CoverageCell label="Education" covered={row.educationCovered} />
        <CoverageCell label="Cases" covered={row.casesCovered} />
      </div>
      {row.caseTitles.length ? (
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Cases: {row.caseTitles.join(', ')}
        </p>
      ) : null}
      {row.gapReason ? (
        <p className="mt-2 text-xs leading-5 text-amber-200">
          <span className="font-semibold">Action needed: </span>
          {row.gapReason}
        </p>
      ) : null}
    </article>
  );
}

function CoverageCell({ label, covered }: { label: string; covered: boolean }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.025] px-2 py-1 text-xs">
      <span className={covered ? 'text-[var(--color-green)]' : 'text-[var(--color-amber)]'}>
        {covered ? '✓' : '✕'}
      </span>{' '}
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
