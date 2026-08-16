import { useMemo } from 'react';

import type { DiagnosisEditorialWorkspace } from '../../../api/admin.types.ts';
import ActionFeedback, {
  type ActionFeedbackState,
} from '../../../components/ui/ActionFeedback.tsx';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from './actions/workspaceActionTypes.ts';
import { WorkspaceHeader } from './WorkspaceHeader.tsx';
import { WorkspaceReviewRail } from './WorkspaceReviewRail.tsx';
import { WorkspaceStatusStrip } from './WorkspaceStatusStrip.tsx';
import { WORKSPACE_WORKFLOW_COMPONENTS } from './WorkspaceWorkflowRegistry.ts';
import { WorkspaceWorkflowNav } from './WorkspaceWorkflowNav.tsx';
import { buildEditorialWorkflowViewModel } from './viewModels/editorialWorkflowViewModel.ts';
import type { WorkflowTone } from './viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkflowNavigationViewModel,
  WorkspaceBoardId,
  WorkspaceWorkflowId,
} from './viewModels/workflowNavigationViewModel.ts';

const HEALTH_WORKFLOW_IDS: WorkspaceWorkflowId[] = [
  'overview',
  'teaching',
  'cases',
  'content',
  'publish',
];

export function WorkspacePageShell({
  workspace,
  navigation,
  actionAccess,
  actionFeedback,
  pendingAction,
  onDismissActionFeedback,
  onRunAction,
  onWorkflowChange,
  onWorkflowTargetChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  navigation: WorkflowNavigationViewModel;
  actionAccess: WorkspaceActionAccess;
  actionFeedback: ActionFeedbackState | null;
  pendingAction: string | null;
  onDismissActionFeedback: () => void;
  onRunAction: WorkspaceActionRequestHandler;
  onWorkflowChange: (workflowId: WorkspaceWorkflowId) => void;
  onWorkflowTargetChange: (target: {
    workflowId: WorkspaceWorkflowId;
    boardId?: WorkspaceBoardId | null;
  }) => void;
}) {
  const viewModel = useMemo(
    () => buildEditorialWorkflowViewModel(workspace),
    [workspace],
  );
  const ActiveWorkflow =
    WORKSPACE_WORKFLOW_COMPONENTS[navigation.activeWorkflowId];

  const workflowTones = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(viewModel.workflows) as WorkspaceWorkflowId[]).map(
          (id) => [id, viewModel.workflows[id].tone],
        ),
      ) as Record<WorkspaceWorkflowId, WorkflowTone>,
    [viewModel],
  );

  const workflowHealth = useMemo(
    () =>
      Object.fromEntries(
        HEALTH_WORKFLOW_IDS.filter((id) => viewModel.workflows[id]).map(
          (id) => [
            id,
            { label: viewModel.workflows[id].label, tone: viewModel.workflows[id].tone },
          ],
        ),
      ) as Partial<
        Record<WorkspaceWorkflowId, { label: string; tone: WorkflowTone }>
      >,
    [viewModel],
  );

  const blockerCount = useMemo(
    () =>
      viewModel.reviewQueue.items.filter((i) => i.severity === 'blocker').length,
    [viewModel],
  );

  const warningCount = useMemo(
    () =>
      viewModel.reviewQueue.items.filter((i) => i.severity === 'warning').length,
    [viewModel],
  );

  return (
    <div className="space-y-0">
      <WorkspaceHeader workspace={workspace} />
      <WorkspaceWorkflowNav
        navigation={navigation}
        workflowTones={workflowTones}
        onWorkflowChange={onWorkflowChange}
      />
      <WorkspaceStatusStrip
        diagnosisName={viewModel.diagnosis.name}
        activeWorkflow={viewModel.workflows[navigation.activeWorkflowId]}
        blockerCount={blockerCount}
        warningCount={warningCount}
        workflowHealth={workflowHealth}
      />

      <div className="pt-5">
        <ActionFeedback
          feedback={actionFeedback}
          onDismiss={pendingAction ? undefined : onDismissActionFeedback}
        />
      </div>

      <div className="grid min-w-0 gap-5 pt-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0">
          <ActiveWorkflow
            viewModel={viewModel}
            actionAccess={actionAccess}
            pendingAction={pendingAction}
            activeBoardId={navigation.activeBoardId}
            onRunAction={onRunAction}
            onNavigate={onWorkflowTargetChange}
          />
        </main>
        <WorkspaceReviewRail
          viewModel={viewModel}
          activeWorkflowId={navigation.activeWorkflowId}
          actionAccess={actionAccess}
          pendingAction={pendingAction}
          onRunAction={onRunAction}
          onNavigate={onWorkflowTargetChange}
        />
      </div>
    </div>
  );
}
