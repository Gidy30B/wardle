import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';

export type WorkspaceTab =
  | 'overview'
  | 'teaching-rules'
  | 'editorial-brief'
  | 'education'
  | 'integrity'
  | 'cases'
  | 'graph';

export const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'editorial-brief', label: 'Objectives' },
  { id: 'education', label: 'Clinical Picture' },
  { id: 'teaching-rules', label: 'Teaching & Learning' },
  { id: 'graph', label: 'Differential Map' },
  { id: 'cases', label: 'Cases' },
  { id: 'integrity', label: 'Integrity' },
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
