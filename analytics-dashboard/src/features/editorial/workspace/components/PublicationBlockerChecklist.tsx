import StatusBadge from '../../../../components/ui/StatusBadge';
import type { PublishChecklistItemViewModel } from '../viewModels/editorialWorkflowViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function PublicationBlockerChecklist({
  items,
}: {
  items: PublishChecklistItemViewModel[];
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">
                {item.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {item.detail}
              </p>
            </div>
            <StatusBadge status={item.status} tone={toneToBadge(item.tone)} />
          </div>
        </article>
      ))}
    </div>
  );
}
