import StatusBadge from '../../../../components/ui/StatusBadge';
import type { CaseTeachingRiskViewModel } from '../viewModels/caseReasoningViewModel.ts';

export function CaseTeachingRiskCard({
  risk,
}: {
  risk: CaseTeachingRiskViewModel;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{risk.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {risk.detail}
          </p>
        </div>
        <StatusBadge
          status={risk.severity}
          tone={risk.severity === 'blocker' ? 'danger' : 'warning'}
        />
      </div>
    </article>
  );
}
