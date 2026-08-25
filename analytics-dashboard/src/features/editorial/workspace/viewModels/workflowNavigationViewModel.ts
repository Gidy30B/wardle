export type WorkspaceWorkflowId =
  | 'reviewQueue'
  | 'overview'
  | 'teaching'
  | 'reasoning'
  | 'cases'
  | 'content'
  | 'publish';

export type WorkspaceBoardId =
  | 'diagnosisHealth'
  | 'curriculumCoverage'
  | 'teachingRules'
  | 'diagnosticReasoning'
  | 'evidence'
  | 'differentials'
  | 'reasoningPaths'
  | 'diagnosticCases'
  | 'clueProgression'
  | 'reasoningCoverage'
  | 'discriminatorCoverage'
  | 'education'
  | 'scoringSystems'
  | 'mnemonics'
  | 'recallPrompts'
  | 'publicationReadiness';

export type WorkspaceWorkflowNavItem = {
  id: WorkspaceWorkflowId;
  label: string;
  question: string;
  boardIds: WorkspaceBoardId[];
};

export type WorkflowNavigationViewModel = {
  activeWorkflowId: WorkspaceWorkflowId;
  activeBoardId: WorkspaceBoardId | null;
  activePacketTarget: WorkspacePacketTarget | null;
  items: WorkspaceWorkflowNavItem[];
};

export type WorkflowSearchTarget = {
  workflowId: WorkspaceWorkflowId;
  boardId?: WorkspaceBoardId | null;
  packetType?: WorkspacePacketTarget['type'] | null;
  packetId?: string | null;
};

export type WorkspacePacketTarget = {
  type: 'educationCandidate' | 'educationRevision' | 'educationPublication' | 'caseDraft' | 'caseRevision' | 'casePublication';
  id: string;
};

export const WORKSPACE_WORKFLOW_NAV_ITEMS: WorkspaceWorkflowNavItem[] = [
  {
    id: 'reviewQueue',
    label: 'Editorial Review',
    question: 'Editorial review queue',
    boardIds: [],
  },
  {
    id: 'overview',
    label: 'Diagnosis Governance',
    question: 'Educational safety review',
    boardIds: ['diagnosisHealth'],
  },
  {
    id: 'teaching',
    label: 'Teaching Objectives',
    question: 'Teaching objective coverage',
    boardIds: ['curriculumCoverage', 'teachingRules'],
  },
  {
    id: 'reasoning',
    label: 'Diagnostic Reasoning',
    question: 'Differential diagnosis support',
    boardIds: [
      'diagnosticReasoning',
      'evidence',
      'differentials',
      'reasoningPaths',
    ],
  },
  {
    id: 'cases',
    label: 'Clinical Case Coverage',
    question: 'Diagnostic reasoning coverage',
    boardIds: [
      'diagnosticCases',
      'clueProgression',
      'reasoningCoverage',
      'discriminatorCoverage',
    ],
  },
  {
    id: 'content',
    label: 'Learner Content',
    question: 'Learner-facing content review',
    boardIds: ['education', 'scoringSystems', 'mnemonics', 'recallPrompts'],
  },
  {
    id: 'publish',
    label: 'Publication Readiness',
    question: 'Publication readiness',
    boardIds: ['publicationReadiness'],
  },
];

const WORKFLOW_IDS = new Set<WorkspaceWorkflowId>(
  WORKSPACE_WORKFLOW_NAV_ITEMS.map((item) => item.id),
);

const BOARD_TO_WORKFLOW: Record<WorkspaceBoardId, WorkspaceWorkflowId> = {
  diagnosisHealth: 'overview',
  curriculumCoverage: 'teaching',
  teachingRules: 'teaching',
  diagnosticReasoning: 'reasoning',
  evidence: 'reasoning',
  differentials: 'reasoning',
  reasoningPaths: 'reasoning',
  diagnosticCases: 'cases',
  clueProgression: 'cases',
  reasoningCoverage: 'cases',
  discriminatorCoverage: 'cases',
  education: 'content',
  scoringSystems: 'content',
  mnemonics: 'content',
  recallPrompts: 'content',
  publicationReadiness: 'publish',
};

const LEGACY_TAB_TARGETS: Record<
  string,
  { workflowId: WorkspaceWorkflowId; boardId: WorkspaceBoardId | null }
> = {
  overview: { workflowId: 'overview', boardId: 'diagnosisHealth' },
  'editorial-brief': {
    workflowId: 'teaching',
    boardId: 'curriculumCoverage',
  },
  'teaching-rules': { workflowId: 'teaching', boardId: 'teachingRules' },
  graph: { workflowId: 'reasoning', boardId: 'differentials' },
  cases: { workflowId: 'cases', boardId: 'diagnosticCases' },
  education: { workflowId: 'content', boardId: 'education' },
  integrity: { workflowId: 'publish', boardId: 'publicationReadiness' },
};

export function buildWorkflowNavigationViewModel(params: {
  workflowParam?: string | null;
  boardParam?: string | null;
  legacyTabParam?: string | null;
  packetTypeParam?: string | null;
  packetIdParam?: string | null;
}): WorkflowNavigationViewModel {
  const activeWorkflowId = resolveWorkflowId(
    params.workflowParam,
    params.legacyTabParam,
  );
  const legacyBoardId =
    params.legacyTabParam && LEGACY_TAB_TARGETS[params.legacyTabParam]
      ? LEGACY_TAB_TARGETS[params.legacyTabParam].boardId
      : null;
  const activeBoardId = resolveBoardId(
    params.boardParam ?? legacyBoardId,
    activeWorkflowId,
  );

  return {
    activeWorkflowId,
    activeBoardId,
    activePacketTarget: resolvePacketTarget(
      params.packetTypeParam,
      params.packetIdParam,
    ),
    items: WORKSPACE_WORKFLOW_NAV_ITEMS,
  };
}

export function resolveWorkflowId(
  workflowParam?: string | null,
  legacyTabParam?: string | null,
): WorkspaceWorkflowId {
  if (isWorkspaceWorkflowId(workflowParam)) {
    return workflowParam;
  }

  if (legacyTabParam && LEGACY_TAB_TARGETS[legacyTabParam]) {
    return LEGACY_TAB_TARGETS[legacyTabParam].workflowId;
  }

  return 'reviewQueue';
}

export function resolveBoardId(
  boardParam: string | null | undefined,
  workflowId: WorkspaceWorkflowId,
): WorkspaceBoardId | null {
  if (isWorkspaceBoardId(boardParam) && BOARD_TO_WORKFLOW[boardParam] === workflowId) {
    return boardParam;
  }

  return (
    WORKSPACE_WORKFLOW_NAV_ITEMS.find((item) => item.id === workflowId)
      ?.boardIds[0] ?? null
  );
}

export function getWorkflowForBoard(
  boardId: WorkspaceBoardId,
): WorkspaceWorkflowId {
  return BOARD_TO_WORKFLOW[boardId];
}

export function buildWorkflowSearchParams(
  currentParams: URLSearchParams,
  target: WorkflowSearchTarget,
): URLSearchParams {
  const next = new URLSearchParams(currentParams);
  const boardId = resolveBoardId(target.boardId, target.workflowId);

  next.set('workflow', target.workflowId);
  next.delete('tab');

  if (boardId) {
    next.set('board', boardId);
  } else {
    next.delete('board');
  }

  if (target.packetType && target.packetId) {
    next.set('packet', target.packetType);
    next.set('packetId', target.packetId);
  } else {
    next.delete('packet');
    next.delete('packetId');
  }

  return next;
}

function resolvePacketTarget(
  packetType: string | null | undefined,
  packetId: string | null | undefined,
): WorkspacePacketTarget | null {
  if (!packetType || !packetId) return null;
  if (
    packetType === 'educationCandidate' ||
    packetType === 'educationRevision' ||
    packetType === 'educationPublication' ||
    packetType === 'caseDraft' ||
    packetType === 'caseRevision' ||
    packetType === 'casePublication'
  ) {
    return { type: packetType, id: packetId };
  }
  return null;
}

function isWorkspaceWorkflowId(
  value: string | null | undefined,
): value is WorkspaceWorkflowId {
  return Boolean(value && WORKFLOW_IDS.has(value as WorkspaceWorkflowId));
}

function isWorkspaceBoardId(
  value: string | null | undefined,
): value is WorkspaceBoardId {
  return Boolean(value && value in BOARD_TO_WORKFLOW);
}
