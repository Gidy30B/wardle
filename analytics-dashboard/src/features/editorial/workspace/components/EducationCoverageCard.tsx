import StatusBadge from '../../../../components/ui/StatusBadge';
import type { EducationRegenerableSection } from '../../../../api/admin.types.ts';
import type { EducationCoverageCardViewModel } from '../viewModels/contentCoverageViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';
import {
  getSafeReviewActionIds,
  getWorkspaceActionPendingKey,
} from '../actions/workspaceReviewActionPolicy.ts';
import { canRunWorkspaceAction } from '../actions/workspaceActionRegistry.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import { WorkspaceReviewActionButtons } from './WorkspaceReviewActionButtons.tsx';

const REGENERABLE_SECTIONS = new Set<EducationRegenerableSection>([
  'differentials',
  'investigations',
  'examPearls',
  'management',
]);

export function EducationCoverageCard({
  section,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  section: EducationCoverageCardViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  const regenerableSection = isRegenerableEducationSection(section.section)
    ? section.section
    : null;
  const canShowRegenerateSectionAction =
    section.regenerationRecommended && regenerableSection !== null;
  const regenerateSectionActionId = 'education.regenerateSection' as const;
  const regenerateSectionPendingKey = getWorkspaceActionPendingKey(
    regenerateSectionActionId,
    section.section,
  );
  const regenerateSectionPending = pendingAction === regenerateSectionPendingKey;
  const canRunRegenerateSectionAction = canRunWorkspaceAction(
    regenerateSectionActionId,
    actionAccess,
  );

  function handleRegenerateSection() {
    if (!canShowRegenerateSectionAction) {
      return;
    }
    if (typeof section.educationVersion !== 'number') {
      return;
    }

    const confirmed = window.confirm(
      `Regenerate ${section.label.toLowerCase()} using current canonical sources?`,
    );

    if (!confirmed) {
      return;
    }

    void onRunAction(
      regenerateSectionActionId,
      {
        section: regenerableSection,
        expectedVersion: section.educationVersion,
        confirmed: true,
      },
      section.section,
    );
  }

  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{section.label}</p>
          <p className="mt-1 text-xs text-slate-500">{section.status}</p>
        </div>
        <StatusBadge status={section.tone} tone={toneToBadge(section.tone)} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <span>Score: {formatScore(section.score)}</span>
        <span>Coverage: {formatScore(section.coverageScore)}</span>
        <span>Claims: {section.unsupportedClaims.length}</span>
      </div>

      {section.blockers.length || section.warnings.length ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
          {[...section.blockers, ...section.warnings].map((issue) => (
            <li key={issue}>- {issue}</li>
          ))}
        </ul>
      ) : null}

      {canShowRegenerateSectionAction ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <button
            type="button"
            disabled={!canRunRegenerateSectionAction || regenerateSectionPending}
            title={
              canRunRegenerateSectionAction
                ? undefined
                : 'Requires editorial access'
            }
            onClick={handleRegenerateSection}
            className="rounded-md border border-[var(--color-navy-border)] bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[var(--color-teal)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {regenerateSectionPending
              ? 'Regenerating...'
              : `Regenerate ${section.label}`}
          </button>
        </div>
      ) : null}

      {section.unsupportedClaims.length ? (
        <div className="mt-3 space-y-2">
          {section.unsupportedClaims.map((claim) => (
            <div
              key={claim.id}
              className="rounded-md border border-amber-400/20 bg-amber-400/10 p-2 text-xs leading-5 text-amber-100"
            >
              <p>{claim.claimText}</p>
              <WorkspaceReviewActionButtons
                actionIds={getSafeReviewActionIds({
                  kind: 'unsupportedClaim',
                  sourceId: claim.id,
                  repairable: claim.repairableAutomatically,
                })}
                access={actionAccess}
                payload={{ claimId: claim.id }}
                pendingAction={pendingAction}
                subjectId={claim.id}
                subjectLabel={claim.claimText}
                onRunAction={onRunAction}
              />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function formatScore(value: number | null): string {
  return value === null ? 'n/a' : `${Math.round(value * 100)}%`;
}

function isRegenerableEducationSection(
  section: string,
): section is EducationRegenerableSection {
  return REGENERABLE_SECTIONS.has(section as EducationRegenerableSection);
}
