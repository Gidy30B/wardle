import type {
  DiagnosisEditorialBriefResponse,
  DiagnosisEditorialBriefReviewAction,
  DiagnosisEditorialBriefWritePayload,
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRulesResponse,
} from '../../../../api/admin';
import EditorialBriefCard from '../../../cases/education/EditorialBriefCard';
import { CompactPanel, MetricGrid, TabNextStepCard } from '../EditorialPrimitives';
import { formatDate } from '../workspaceTransforms';
export function ObjectivesTab({
  workspace,
  briefDetail,
  teachingRules,
  loading,
  error,
  pendingAction,
  canReviewBrief,
  reviewDisabledReason,
  onGenerate,
  onCreate,
  onUpdate,
  onReview,
}: {
  workspace: DiagnosisEditorialWorkspace;
  briefDetail: DiagnosisEditorialBriefResponse | null;
  teachingRules: DiagnosisTeachingRulesResponse | null;
  loading: boolean;
  error: string | null;
  pendingAction: string | null;
  canReviewBrief: boolean;
  reviewDisabledReason?: string;
  onGenerate: () => void;
  onCreate: (payload: DiagnosisEditorialBriefWritePayload) => Promise<boolean>;
  onUpdate: (payload: DiagnosisEditorialBriefWritePayload) => Promise<boolean>;
  onReview: (action: DiagnosisEditorialBriefReviewAction) => void;
}) {
  return (
    <div className="space-y-4">
      {!workspace.editorialBrief.version ? (
        <TabNextStepCard
          title="Objectives are not defined"
          description="Create or generate an editorial brief so the diagnosis has learning goals, required mimics, pitfalls, and generation guidance."
          actionLabel="Generate draft brief"
          onAction={onGenerate}
          disabled={pendingAction !== null}
        />
      ) : null}
      <EditorialBriefSummaryCard workspace={workspace} />
      <EditorialBriefCard
        briefResponse={briefDetail}
        teachingRules={teachingRules}
        loading={loading}
        error={error}
        pendingAction={pendingAction}
        onGenerate={onGenerate}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onReview={onReview}
        canReviewBrief={canReviewBrief}
        reviewDisabledReason={reviewDisabledReason}
      />
    </div>
  );
}
function EditorialBriefSummaryCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  return (
    <CompactPanel title="Unified brief summary">
      <MetricGrid
        items={[
          { label: 'Status', value: workspace.editorialBrief.status ?? 'Missing' },
          { label: 'Version', value: workspace.editorialBrief.version ?? 'None' },
          {
            label: 'Generation',
            value: workspace.editorialBrief.activeForGeneration
              ? 'Active'
              : 'Inactive',
          },
          {
            label: 'Updated',
            value: workspace.editorialBrief.updatedAt
              ? formatDate(workspace.editorialBrief.updatedAt)
              : 'Unknown',
          },
        ]}
      />
      {workspace.editorialBrief.summary ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {workspace.editorialBrief.summary}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No editorial brief summary exists yet.
        </p>
      )}
    </CompactPanel>
  );
}
