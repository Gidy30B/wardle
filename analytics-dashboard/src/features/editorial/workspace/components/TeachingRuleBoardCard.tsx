import StatusBadge from '../../../../components/ui/StatusBadge';
import type { TeachingRuleCardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';
import { getSafeReviewActionIds } from '../actions/workspaceReviewActionPolicy.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import { WorkspaceReviewActionButtons } from './WorkspaceReviewActionButtons.tsx';

export function TeachingRuleBoardCard({
  rule,
  actionAccess,
  pendingAction,
  onRunAction,
  reviewEnabled,
}: {
  rule: TeachingRuleCardViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
  reviewEnabled: boolean;
}) {
  const scope = [
    rule.appliesToEducation ? 'education' : null,
    rule.appliesToCaseGeneration ? 'case generation' : null,
    rule.appliesToGraph ? 'graph' : null,
    rule.supportsDiagnosticDiscrimination ? 'discriminator support' : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{rule.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {rule.category} · {rule.importance}
          </p>
        </div>
        <StatusBadge status={rule.status} tone={toneToBadge(rule.tone)} />
      </div>

      {rule.rationale ? (
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {rule.rationale}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {scope.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400"
          >
            {item}
          </span>
        ))}
      </div>

      {rule.warnings.length ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-200">
          {rule.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}

      <WorkspaceReviewActionButtons
        actionIds={
          reviewEnabled
            ? getSafeReviewActionIds({
                kind: 'teachingRule',
                sourceId: rule.id,
                status: rule.status,
              })
            : []
        }
        access={actionAccess}
        payload={{ ruleId: rule.id }}
        pendingAction={pendingAction}
        subjectId={rule.id}
        subjectLabel={rule.title}
        onRunAction={onRunAction}
      />
    </article>
  );
}
