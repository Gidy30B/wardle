import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { CoverageGoalRow } from '../components/CoverageGoalRow.tsx';
import type { CurriculumCoverageBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function CurriculumCoverageBoard({
  board,
}: {
  board: CurriculumCoverageBoardViewModel;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail={`${board.missingCaseSupportCount} missing case support, ${board.missingEducationSupportCount} missing education support, ${board.discriminatorExpectationCount} discriminator expectation(s).`}
        tone={board.tone}
      />

      <CompactPanel title="Teaching objectives" subtitle="Curriculum coverage from the workflow projection.">
        {board.goals.length ? (
          <div className="space-y-3">
            {board.goals.map((goal) => (
              <CoverageGoalRow key={goal.id} goal={goal} />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No teaching objectives projected"
            detail="Teaching objective coverage will appear once curriculum projections are available."
          />
        )}
      </CompactPanel>

      {board.gaps.length ? (
        <CompactPanel title="Coverage deficiencies" subtitle="Blockers and warnings from the coverage projection.">
          <div className="space-y-2">
            {board.gaps.map((gap) => (
              <article
                key={gap.id}
                className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {gap.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {gap.recommendedAction}
                </p>
              </article>
            ))}
          </div>
        </CompactPanel>
      ) : null}
    </div>
  );
}
