import type {
  DiagnosisEditorialBriefResponse,
  DiagnosisEditorialBriefReviewAction,
  DiagnosisEditorialBriefWritePayload,
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRulesResponse,
} from '../../../../api/admin';
import EditorialBriefCard from '../../../cases/education/EditorialBriefCard';
import {
  CompactMetricGrid,
  EditorialStream,
  ReasoningCard,
  StreamDisclosure,
  TabNextStepCard,
} from '../EditorialPrimitives';
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
      <EditorialStream
        eyebrow="Objectives"
        title="Editorial intent stream"
        subtitle="Keep learning goals, required mimics, pitfalls, and generation guidance pointed at one clinical teaching outcome."
        action={
          <button
            type="button"
            onClick={onGenerate}
            disabled={pendingAction !== null}
            className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generate draft brief
          </button>
        }
      >
        <EditorialBriefSummaryCard workspace={workspace} />
        <StreamDisclosure
          title="Brief authoring and review"
          summary="Create, edit, review, and activate the full editorial brief"
        >
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
        </StreamDisclosure>
      </EditorialStream>
    </div>
  );
}
function EditorialBriefSummaryCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const generationActive = workspace.editorialBrief.activeForGeneration;

  return (
    <ReasoningCard
      eyebrow="Intent sheet"
      title="Unified brief summary"
      subtitle="Learning goals, mimics, pitfalls, and generation guidance should point in the same editorial direction."
      tone={generationActive ? 'success' : 'warning'}
    >
      <CompactMetricGrid
        items={[
          { label: 'Status', value: workspace.editorialBrief.status ?? 'Missing' },
          { label: 'Version', value: workspace.editorialBrief.version ?? 'None' },
          {
            label: 'Generation',
            value: generationActive ? 'Active' : 'Inactive',
            tone: generationActive ? 'success' : 'warning',
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
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {workspace.editorialBrief.summary}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No editorial brief summary exists yet.
        </p>
      )}
    </ReasoningCard>
  );
}
