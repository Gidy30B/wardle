import StatusBadge from '../../../../components/ui/StatusBadge';
import type { CurriculumCoverageGoalViewModel } from '../viewModels/editorialWorkflowViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function CoverageGoalRow({
  goal,
}: {
  goal: CurriculumCoverageGoalViewModel;
}) {
  const support = [
    `${goal.linkedCasesCount} linked case(s)`,
    `${goal.evidenceSupportCount} evidence support item(s)`,
    goal.missingCaseSupport ? 'missing case support' : null,
    goal.missingEducationSupport ? 'missing education support' : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{goal.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {goal.category} · {goal.importance}
          </p>
        </div>
        <StatusBadge status={goal.status} tone={toneToBadge(goal.tone)} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <CoveragePill label="Education" value={goal.educationCoverage} />
        <CoveragePill label="Cases" value={goal.caseCoverage} />
        <CoveragePill label="Graph" value={goal.graphCoverage} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {support.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400"
          >
            {item}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        {goal.recommendedAction}
      </p>
    </article>
  );
}

function CoveragePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.025] px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="ml-1 font-semibold text-slate-300">{value}</span>
    </div>
  );
}
