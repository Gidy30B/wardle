import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRuleReviewAction,
  DiagnosisTeachingRuleWritePayload,
  DiagnosisTeachingRulesResponse,
  WorkspaceCoverageMatrixRow,
} from '../../../../api/admin';
import TeachingRulesCard from '../../../cases/education/TeachingRulesCard';
import { CoverageMatrixCard } from '../CoveragePanels';
import { TabNextStepCard } from '../EditorialPrimitives';

export function TeachingLearningTab({
  workspace,
  rules,
  loading,
  pendingAction,
  selectedRow,
  canReviewRules,
  reviewDisabledReason,
  onGenerateCandidates,
  onSeedLegacy,
  onCreateRule,
  onUpdateRule,
  onReviewRule,
  onRowSelect,
}: {
  workspace: DiagnosisEditorialWorkspace;
  rules: DiagnosisTeachingRulesResponse | null;
  loading: boolean;
  pendingAction: string | null;
  selectedRow: WorkspaceCoverageMatrixRow | null;
  canReviewRules: boolean;
  reviewDisabledReason: string;
  onGenerateCandidates: () => void;
  onSeedLegacy: () => void;
  onCreateRule: (payload: DiagnosisTeachingRuleWritePayload) => Promise<boolean>;
  onUpdateRule: (
    ruleId: string,
    payload: DiagnosisTeachingRuleWritePayload,
  ) => Promise<boolean>;
  onReviewRule: (
    ruleId: string,
    action: DiagnosisTeachingRuleReviewAction,
  ) => void;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
}) {
  return (
    <div className="space-y-4">
      {workspace.teachingRules.items.length === 0 ? (
        <TabNextStepCard
          title="No teaching rules yet"
          description="Start by generating constrained teaching rule candidates or seeding legacy rules, then approve the rules that should drive education, cases, and graph coverage."
          actionLabel="Generate candidates"
          onAction={onGenerateCandidates}
          disabled={pendingAction !== null}
        />
      ) : null}
      <TeachingRulesCard
        rules={rules}
        loading={loading}
        error={null}
        pendingAction={pendingAction}
        onGenerateCandidates={onGenerateCandidates}
        onSeedLegacy={onSeedLegacy}
        onCreateRule={onCreateRule}
        onUpdateRule={onUpdateRule}
        onReviewRule={onReviewRule}
        canReviewRules={canReviewRules}
        reviewDisabledReason={reviewDisabledReason}
      />
      <CoverageMatrixCard
        rows={workspace.coverageMatrix}
        selectedRow={selectedRow}
        onRowSelect={onRowSelect}
      />
    </div>
  );
}
