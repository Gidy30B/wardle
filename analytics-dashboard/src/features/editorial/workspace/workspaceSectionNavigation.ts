import type { WorkspaceTab } from './workspaceTypes';

export type WorkspaceSectionTarget = {
  tab: WorkspaceTab;
  sectionId: string;
};

export type WorkspaceCommandTarget = {
  label: string;
  target: WorkspaceSectionTarget;
  enabled: boolean;
  disabledReason?: string | null;
};

export function normalizeWorkspaceTargetTab(
  value: string | null | undefined,
): WorkspaceTab {
  if (
    value === 'overview' ||
    value === 'editorial-brief' ||
    value === 'education' ||
    value === 'teaching-rules' ||
    value === 'graph' ||
    value === 'cases' ||
    value === 'integrity'
  ) {
    return value;
  }

  if (value === 'clinical-picture') return 'education';
  if (value === 'differential-map') return 'graph';
  return 'overview';
}

export const WORKSPACE_SECTION_IDS_BY_TAB: Record<WorkspaceTab, string[]> = {
  overview: ['workspace-diagnosis-health'],
  'teaching-rules': [
    'teaching-rules-stream',
    'teaching-coverage-matrix',
    'mimic-separation-stream',
  ],
  'editorial-brief': [
    'brief-status',
    'brief-objectives',
    'brief-recommendations',
  ],
  education: [
    'education-summary',
    'education-clinical-pattern',
    'education-investigations',
    'education-management',
    'education-pitfalls',
    'education-repairs',
    'education-publication-state',
  ],
  cases: [
    'case-inventory',
    'case-difficulty-spectrum',
    'case-quality-flags',
    'case-validation-state',
    'case-generation-actions',
  ],
  graph: [
    'graph-readiness',
    'teaching-relationship-details',
    'evidence-graph',
    'evidence-coverage',
    'graph-candidates',
    'mimic-separation-stream',
  ],
  integrity: [
    'integrity-blockers',
    'integrity-validation-failures',
    'integrity-unsupported-claims',
    'integrity-accepted-repairs',
    'integrity-audit-trail',
    'integrity-case-revision-drafts',
    'integrity-revision-history',
  ],
};

const WORKSPACE_TAB_BY_SECTION_ID = Object.entries(
  WORKSPACE_SECTION_IDS_BY_TAB,
).reduce((acc, [tab, sectionIds]) => {
  sectionIds.forEach((sectionId) => {
    acc.set(sectionId, tab as WorkspaceTab);
  });
  return acc;
}, new Map<string, WorkspaceTab>());

export function getWorkspaceSectionTarget(
  sectionId: string | null | undefined,
): WorkspaceSectionTarget | null {
  if (!sectionId) return null;
  const tab = WORKSPACE_TAB_BY_SECTION_ID.get(sectionId);
  return tab ? { tab, sectionId } : null;
}

export function getDefaultWorkspaceSectionForTab(
  value: string | null | undefined,
): WorkspaceSectionTarget {
  const tab = normalizeWorkspaceTargetTab(value);
  return {
    tab,
    sectionId: WORKSPACE_SECTION_IDS_BY_TAB[tab][0],
  };
}

export function getWorkspaceSectionForEducationSection(
  section: string | null | undefined,
): WorkspaceSectionTarget {
  if (!section) return getDefaultWorkspaceSectionForTab('education');

  const normalized = section.toLowerCase();
  if (normalized.includes('investigation') || normalized.includes('diagnostic')) {
    return { tab: 'education', sectionId: 'education-investigations' };
  }
  if (normalized.includes('management')) {
    return { tab: 'education', sectionId: 'education-management' };
  }
  if (
    normalized.includes('differential') ||
    normalized.includes('presentation') ||
    normalized.includes('pattern')
  ) {
    return { tab: 'education', sectionId: 'education-clinical-pattern' };
  }
  if (normalized.includes('pearl') || normalized.includes('pitfall')) {
    return { tab: 'education', sectionId: 'education-pitfalls' };
  }

  return getDefaultWorkspaceSectionForTab('education');
}

export function focusWorkspaceSection(sectionId: string, behavior: ScrollBehavior) {
  const element = document.getElementById(sectionId);
  if (!element) return false;

  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }

  element.scrollIntoView({ behavior, block: 'start' });
  element.focus({ preventScroll: true });
  return true;
}

export function markWorkspaceSectionReached(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (!element) return;

  element.setAttribute('data-workspace-section-focus', 'true');
  window.setTimeout(() => {
    if (element.getAttribute('data-workspace-section-focus') === 'true') {
      element.removeAttribute('data-workspace-section-focus');
    }
  }, 1600);
}

export function replaceWorkspaceHash(sectionId: string) {
  const url = new URL(window.location.href);
  url.hash = sectionId;
  window.history.replaceState(window.history.state, '', url);
}

export function getCurrentWorkspaceHashTarget() {
  const hash = window.location.hash.replace(/^#/, '');
  return getWorkspaceSectionTarget(hash);
}
