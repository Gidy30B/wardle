import StatusBadge from '../../../../components/ui/StatusBadge';
import type { WorkflowTone } from '../viewModels/editorialWorkflowViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function ClinicalJudgementRow({
  label,
  status,
  detail,
  tone,
}: {
  label: string;
  status: string;
  detail: string;
  tone: WorkflowTone;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
        </div>
        <StatusBadge status={status} tone={toneToBadge(tone)} />
      </div>
    </article>
  );
}
