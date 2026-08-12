import StatusBadge from '../../../../components/ui/StatusBadge';
import type { ContentTeachingRiskViewModel } from '../viewModels/contentCoverageViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function ContentTeachingRiskCard({
  risk,
}: {
  risk: ContentTeachingRiskViewModel;
}) {
  const tone = risk.severity === 'blocker' ? 'danger' : 'warning';

  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{risk.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{risk.detail}</p>
        </div>
        <StatusBadge status={risk.severity} tone={toneToBadge(tone)} />
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
        {risk.targetBoard}
      </p>
    </article>
  );
}
