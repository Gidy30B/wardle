import type { WorkspaceTab } from './workspaceTypes';

const validWorkspaceTabs = new Set<WorkspaceTab>([
  'overview',
  'teaching-rules',
  'editorial-brief',
  'education',
  'integrity',
  'cases',
  'graph',
]);

export type WorkspaceClaimTarget = {
  claimId: string | null;
  sectionId: string | null;
};

export function normalizeWorkspaceTab(value: string | null): WorkspaceTab {
  if (value === 'clinical-picture') {
    return 'education';
  }
  return validWorkspaceTabs.has(value as WorkspaceTab)
    ? (value as WorkspaceTab)
    : 'overview';
}

export function getClaimTarget(searchParams: URLSearchParams): WorkspaceClaimTarget {
  return {
    claimId: searchParams.get('claimId'),
    sectionId: searchParams.get('sectionId'),
  };
}

export function hasClaimTarget(target: WorkspaceClaimTarget) {
  return Boolean(target.claimId || target.sectionId);
}

export function buildUnsupportedClaimDeepLink(input: {
  targetUrl: string;
  claimId?: string | null;
  sectionId?: string | null;
  targetTab?: string | null;
}) {
  const params = new URLSearchParams();
  const tab =
    input.targetTab && input.targetTab !== 'education'
      ? input.targetTab
      : 'integrity';
  params.set('tab', tab);
  if (input.claimId) {
    params.set('claimId', input.claimId);
  }
  if (input.sectionId) {
    params.set('sectionId', input.sectionId);
  }
  return `${input.targetUrl}?${params.toString()}`;
}
