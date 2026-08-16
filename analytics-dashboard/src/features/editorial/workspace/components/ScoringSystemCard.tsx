import StatusBadge from '../../../../components/ui/StatusBadge';
import type { ScoringSystemCardViewModel } from '../viewModels/contentCoverageViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function ScoringSystemCard({
  scoringSystem,
}: {
  scoringSystem: ScoringSystemCardViewModel;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            {scoringSystem.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {scoringSystem.criteriaCount} criteria · {scoringSystem.educationCoverage}
          </p>
        </div>
        <StatusBadge
          status={scoringSystem.status}
          tone={toneToBadge(scoringSystem.tone)}
        />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <span>Mnemonic: {scoringSystem.hasMnemonic ? 'yes' : 'no'}</span>
        <span>Recall: {scoringSystem.recallPromptCount}</span>
        <span>Cases: {scoringSystem.caseCoverageCount}</span>
      </div>

      {scoringSystem.issues.length ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-200">
          {scoringSystem.issues.map((issue) => (
            <li key={issue}>- {issue}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
