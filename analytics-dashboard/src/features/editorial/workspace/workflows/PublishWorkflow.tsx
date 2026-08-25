import StatusBadge from '../../../../components/ui/StatusBadge';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { PublicationBlockerChecklist } from '../components/PublicationBlockerChecklist.tsx';
import { ReviewQueueItem } from '../components/ReviewQueueItem.tsx';
import { EducationPublicationPacket } from '../components/EducationWorkPackets.tsx';
import { CompactPanel } from '../EditorialPrimitives.tsx';
import type { WorkspaceWorkflowComponentProps } from '../WorkspaceWorkflowRegistry.ts';

export function PublishWorkflow({
  viewModel,
  actionAccess,
  pendingAction,
  onRunAction,
  onNavigate,
}: WorkspaceWorkflowComponentProps) {
  const workflow = viewModel.publish;
  const publicationGovernanceItems = viewModel.reviewQueue.items.filter(
    (item) =>
      item.kind === 'publication_authorization' ||
      item.kind === 'case_revision' ||
      item.kind === 'education_publication',
  );

  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={workflow.label}
        question={workflow.question}
        verdict={workflow.verdict}
        detail={workflow.detail}
        topConcerns={workflow.blocked.map((item) => item.label)}
        tone={workflow.tone}
      />

      <CompactPanel
        title="Publication readiness checklist"
        subtitle="Canonical blockers and warnings for governed publication."
        action={
          <StatusBadge
            status={`${workflow.blocked.length} blocked`}
            tone={workflow.blocked.length ? 'danger' : 'success'}
          />
        }
      >
        <PublicationBlockerChecklist items={workflow.checklist} />
      </CompactPanel>

      <CompactPanel
        title="Governed publication path"
        subtitle="Case and Education publication work remain exact-revision decisions with artifact-specific authority."
      >
        {workflow.educationPublicationPacket ? (
          <div className="mb-3">
            <EducationPublicationPacket
              packet={workflow.educationPublicationPacket}
              actionAccess={actionAccess}
              pendingAction={pendingAction}
              onRunAction={onRunAction}
            />
          </div>
        ) : null}
        {publicationGovernanceItems.length ? (
          <div className="space-y-2">
            {publicationGovernanceItems.map((item) => (
              <ReviewQueueItem
                key={item.id}
                item={item}
                actionAccess={actionAccess}
                pendingAction={pendingAction}
                onRunAction={onRunAction}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No publication governance items"
            detail="Exact revision approval, publication authorization, and schedule binding are complete or not yet applicable."
          />
        )}
      </CompactPanel>

      <CompactPanel
        title="Passing criteria"
        subtitle="Publication criteria currently passing."
      >
        {workflow.passing.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {workflow.passing.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-[var(--color-green)]/20 bg-[var(--color-green)]/10 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-green-100">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-green-100/80">
                      {item.detail}
                    </p>
                  </div>
                  <StatusBadge status="Passing" tone="success" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No passing criteria yet"
            detail="All publication readiness criteria require review or are blocked."
          />
        )}
      </CompactPanel>
    </div>
  );
}
