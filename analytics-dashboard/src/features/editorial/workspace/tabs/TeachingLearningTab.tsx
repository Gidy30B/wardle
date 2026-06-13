import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRuleReviewAction,
  DiagnosisTeachingRuleWritePayload,
  DiagnosisTeachingRulesResponse,
  WorkspaceCoverageMatrixRow,
} from '../../../../api/admin';
import TeachingRulesCard from '../../../cases/education/TeachingRulesCard';
import { CoverageMatrixCard } from '../CoveragePanels';
import {
  CollapsibleDetail,
  PrototypeSectionHeader,
  StatusStrip,
  TabNextStepCard,
} from '../EditorialPrimitives';

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
  const focusRule = workspace.teachingRules.items.find(
    (rule) => rule.status !== 'ACTIVE',
  );
  const focusDetail =
    focusRule?.title ??
    (workspace.teachingRules.summary.needsReview
      ? 'Review candidates'
      : 'Maintain active rules');

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
      <section className="editorial-panel rounded-lg p-4">
        <PrototypeSectionHeader
          eyebrow="Teaching distinctions"
          title="Rule readiness"
          subtitle="Approved distinctions should drive the education draft, cases, and differential graph coverage."
        />
        <div className="mt-3">
          <StatusStrip
            items={[
              {
                label: 'Active',
                value: workspace.teachingRules.summary.active,
                detail: 'Approved rules',
                tone: workspace.teachingRules.summary.active ? 'success' : 'warning',
              },
              {
                label: 'Needs review',
                value: workspace.teachingRules.summary.needsReview,
                detail: 'Candidate or blocked rules',
                tone: workspace.teachingRules.summary.needsReview
                  ? 'warning'
                  : 'success',
              },
              {
                label: 'Total',
                value: workspace.teachingRules.items.length,
                detail: 'Rules in this workspace',
                tone: workspace.teachingRules.items.length ? 'info' : 'warning',
              },
              {
                label: 'Focus',
                value: workspace.teachingRules.summary.needsReview
                  ? 'Review'
                  : 'Maintain',
                detail: focusDetail,
                tone: workspace.teachingRules.summary.needsReview
                  ? 'warning'
                  : 'success',
              },
            ]}
          />
        </div>
      </section>
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
      <CollapsibleDetail
        title="Teaching coverage matrix"
        summary={`${workspace.coverageMatrix.length} teaching rules with education, case, and graph coverage`}
      >
        <CoverageMatrixCard
          rows={workspace.coverageMatrix}
          selectedRow={selectedRow}
          onRowSelect={onRowSelect}
        />
      </CollapsibleDetail>
    </div>
  );
}
