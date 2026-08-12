import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { TeachingRuleBoardCard } from '../components/TeachingRuleBoardCard.tsx';
import type {
  TeachingRuleCardViewModel,
  TeachingRulesBoardViewModel,
} from '../viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';

export function TeachingRulesBoard({
  board,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  board: TeachingRulesBoardViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail={`${board.activeRules.length} active, ${board.candidateRules.length} candidate/review, ${board.weakRules.length} weak rule(s).`}
        tone={board.tone}
      />

      <RuleSection
        title="Active rules"
        rules={board.activeRules}
        actionAccess={actionAccess}
        pendingAction={pendingAction}
        onRunAction={onRunAction}
      />
      <RuleSection
        title="Candidate rules under review"
        rules={board.candidateRules}
        reviewEnabled
        actionAccess={actionAccess}
        pendingAction={pendingAction}
        onRunAction={onRunAction}
      />
      <RuleSection
        title="Weak or unsupported discrimination"
        rules={board.weakRules}
        actionAccess={actionAccess}
        pendingAction={pendingAction}
        onRunAction={onRunAction}
      />

      {!board.itemCount ? (
        <BoardEmptyState
          title="No teaching rules projected"
          detail="Teaching rules will appear once generation or editorial review has started."
        />
      ) : null}
    </div>
  );
}

function RuleSection({
  title,
  rules,
  actionAccess,
  pendingAction,
  onRunAction,
  reviewEnabled = false,
}: {
  title: string;
  rules: TeachingRuleCardViewModel[];
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
  reviewEnabled?: boolean;
}) {
  if (!rules.length) return null;

  return (
    <CompactPanel title={title}>
      <div className="space-y-3">
        {rules.map((rule) => (
          <TeachingRuleBoardCard
            key={rule.id}
            rule={rule}
            actionAccess={actionAccess}
            pendingAction={pendingAction}
            onRunAction={onRunAction}
            reviewEnabled={reviewEnabled}
          />
        ))}
      </div>
    </CompactPanel>
  );
}
