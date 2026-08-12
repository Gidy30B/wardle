import StatusBadge from '../../../../components/ui/StatusBadge';
import type { ClueProgressionCaseViewModel } from '../viewModels/caseReasoningViewModel.ts';
import { BoardEmptyState } from './BoardEmptyState.tsx';
import { toneToBadge } from './BoardVerdict.tsx';

export function ClueProgressionTimeline({
  progression,
}: {
  progression: ClueProgressionCaseViewModel;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {progression.caseTitle}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {progression.discriminatorTiming} · {progression.reviewStatus} ·{' '}
            {progression.annotationCount} annotation(s), {progression.draftCount}{' '}
            draft(s)
          </p>
        </div>
        <StatusBadge
          status={progression.quality}
          tone={toneToBadge(progression.tone)}
        />
      </div>

      {progression.steps.length ? (
        <ol className="mt-4 space-y-3">
          {progression.steps.map((step) => (
            <li key={step.id} className="relative border-l border-white/10 pl-4">
              <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[var(--color-teal)]" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Clue {step.clueIndex + 1}
                </p>
                <StatusBadge
                  status={step.risk}
                  tone={step.risk === 'weak' ? 'danger' : step.risk === 'watch' ? 'warning' : 'success'}
                  className="px-1.5 py-0.5 text-[9px]"
                />
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {step.clue}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {step.interpretation}
              </p>
              {step.editorialConcern ? (
                <p className="mt-1 text-xs leading-5 text-amber-200">
                  {step.editorialConcern}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <BoardEmptyState
          title="No clue progression states"
          detail="This case does not yet have analyzed clue progression."
        />
      )}
    </article>
  );
}
