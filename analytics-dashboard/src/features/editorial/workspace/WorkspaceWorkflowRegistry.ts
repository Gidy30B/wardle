import type { ComponentType } from 'react';

import { CasesWorkflow } from './workflows/CasesWorkflow.tsx';
import { ContentWorkflow } from './workflows/ContentWorkflow.tsx';
import { OverviewWorkflow } from './workflows/OverviewWorkflow.tsx';
import { PublishWorkflow } from './workflows/PublishWorkflow.tsx';
import { ReasoningWorkflow } from './workflows/ReasoningWorkflow.tsx';
import { ReviewQueueWorkflow } from './workflows/ReviewQueueWorkflow.tsx';
import { TeachingWorkflow } from './workflows/TeachingWorkflow.tsx';
import type { EditorialWorkflowViewModel } from './viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from './actions/workspaceActionTypes.ts';
import type {
  WorkspaceBoardId,
  WorkspacePacketTarget,
  WorkspaceWorkflowId,
} from './viewModels/workflowNavigationViewModel.ts';

export type WorkspaceWorkflowComponentProps = {
  viewModel: EditorialWorkflowViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  activeBoardId?: WorkspaceBoardId | null;
  activePacketTarget?: WorkspacePacketTarget | null;
  onRunAction: WorkspaceActionRequestHandler;
  onNavigate?: (target: {
    workflowId: WorkspaceWorkflowId;
    boardId?: WorkspaceBoardId | null;
    packetType?: WorkspacePacketTarget['type'] | null;
    packetId?: string | null;
  }) => void;
};

export type WorkspaceWorkflowRegistryItem = {
  id: WorkspaceWorkflowId;
  label: string;
  component: ComponentType<WorkspaceWorkflowComponentProps>;
};

export const WORKSPACE_WORKFLOW_COMPONENTS: Record<
  WorkspaceWorkflowId,
  WorkspaceWorkflowRegistryItem['component']
> = {
  reviewQueue: ReviewQueueWorkflow,
  overview: OverviewWorkflow,
  teaching: TeachingWorkflow,
  reasoning: ReasoningWorkflow,
  cases: CasesWorkflow,
  content: ContentWorkflow,
  publish: PublishWorkflow,
};

export const WORKSPACE_WORKFLOW_REGISTRY: WorkspaceWorkflowRegistryItem[] = [
  { id: 'reviewQueue', label: 'Review Queue', component: ReviewQueueWorkflow },
  { id: 'overview', label: 'Overview', component: OverviewWorkflow },
  { id: 'teaching', label: 'Teaching', component: TeachingWorkflow },
  { id: 'reasoning', label: 'Reasoning', component: ReasoningWorkflow },
  { id: 'cases', label: 'Cases', component: CasesWorkflow },
  { id: 'content', label: 'Content', component: ContentWorkflow },
  { id: 'publish', label: 'Publish', component: PublishWorkflow },
];

export function getWorkspaceWorkflowComponent(
  workflowId: WorkspaceWorkflowId,
): WorkspaceWorkflowRegistryItem['component'] {
  return WORKSPACE_WORKFLOW_COMPONENTS[workflowId];
}
