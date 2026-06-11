import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';

export type WorkspaceTab =
  | 'overview'
  | 'teaching-rules'
  | 'editorial-brief'
  | 'education'
  | 'cases'
  | 'graph';

export const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'teaching-rules', label: 'Teaching & Learning' },
  { id: 'editorial-brief', label: 'Objectives' },
  { id: 'education', label: 'Clinical Picture' },
  { id: 'cases', label: 'Cases' },
  { id: 'graph', label: 'Differential Map' },
];

export const VALID_WORKSPACE_TABS = new Set<WorkspaceTab>(
  WORKSPACE_TABS.map((tab) => tab.id),
);

export type RuleDrawerAction =
  | 'education'
  | 'generate-case'
  | 'review-graph'
  | 'edit-rule';

export type CopilotSuggestion = {
  id: string;
  title: string;
  detail: string;
  targetTab: WorkspaceTab;
  source: string;
  tone: StatusBadgeTone;
  enabled: boolean;
};
