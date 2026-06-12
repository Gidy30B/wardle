import type {
  ClaimRepairResult,
  AiDraftDecisionAction,
  DiagnosisEditorialWorkspace,
  DiagnosisEducationRevisionAnalysis,
  DiagnosisEducationRevisionCompareResult,
  EducationRegenerableSection,
} from '../../../../api/admin';
import RevisionCompareCard from '../../../cases/education/RevisionCompareCard';
import RevisionHistoryCard from '../../../cases/education/RevisionHistoryCard';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { ClaimRepairPanel } from '../ClaimRepairPanel';
import {
  CompactPanel,
  DraftAIActionsPanel,
  MessageList,
  MetricGrid,
  TabNextStepCard,
} from '../EditorialPrimitives';
import { formatDate, formatLabel, formatScore } from '../workspaceTransforms';
import { repairsBySection } from '../acceptedRepairs';
export function ClinicalPictureTab({
  workspace,
  revisions,
  revisionCompare,
  revisionCompareLoading,
  revisionCompareError,
  compareFromVersion,
  compareToVersion,
  pendingAction,
  claimRepairs,
  targetClaimId,
  targetSectionId,
  onRegenerateSection,
  onRepairUnsupportedClaim,
  onClaimRepairDecision,
  onFromVersionChange,
  onToVersionChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  revisions: DiagnosisEducationRevisionAnalysis[];
  revisionCompare: DiagnosisEducationRevisionCompareResult | null;
  revisionCompareLoading: boolean;
  revisionCompareError: string | null;
  compareFromVersion: number | null;
  compareToVersion: number | null;
  pendingAction: string | null;
  claimRepairs: Record<string, ClaimRepairResult>;
  targetClaimId: string | null;
  targetSectionId: string | null;
  onRegenerateSection: (section: EducationRegenerableSection) => void;
  onRepairUnsupportedClaim: (
    claim: NonNullable<
      DiagnosisEditorialWorkspace['unsupportedClaimsBySection']
    >[number],
  ) => void;
  onClaimRepairDecision: (
    claim: { sectionId: string; claimId: string },
    repair: ClaimRepairResult,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
  onFromVersionChange: (version: number | null) => void;
  onToVersionChange: (version: number | null) => void;
}) {
  const weakSections = workspace.education.sectionHealth.filter(
    (section) =>
      section.regenerationRecommended ||
      section.blockers.length > 0 ||
      section.warnings.length > 0,
  );

  return (
    <div className="space-y-4">
      {!workspace.education.id ? (
        <TabNextStepCard
          title="Clinical picture is missing"
          description="Generate or draft education content, then run section quality analysis so weak clinical-picture sections can be regenerated deliberately."
        />
      ) : weakSections.length ? (
        <TabNextStepCard
          title={`${weakSections.length} clinical section${weakSections.length === 1 ? '' : 's'} need review`}
          description={`Prioritize ${weakSections
            .slice(0, 3)
            .map((section) => formatLabel(section.section))
            .join(', ')} before marking this diagnosis mature.`}
        />
      ) : null}
      <EducationQualityCard
        workspace={workspace}
        pendingAction={pendingAction}
        onRegenerateSection={onRegenerateSection}
      />
      <AcceptedRepairsPanel workspace={workspace} />
      <ClaimRepairPanel
        claims={workspace.unsupportedClaimsBySection ?? []}
        repairs={claimRepairs}
        pendingAction={pendingAction}
        targetClaimId={targetClaimId}
        targetSectionId={targetSectionId}
        onRepairUnsupportedClaim={onRepairUnsupportedClaim}
        onClaimRepairDecision={onClaimRepairDecision}
      />
      <DraftAIActionsPanel
        actions={weakSections.slice(0, 4).map((section) => ({
          id: `regenerate-${section.section}`,
          label: `Regenerate ${formatLabel(section.section)}`,
          detail:
            section.reason ??
            section.blockers[0] ??
            section.warnings[0] ??
            'Section quality analysis recommends regeneration.',
          disabled:
            pendingAction !== null ||
            !isRegenerableEducationSection(section.section),
          onAction: () =>
            onRegenerateSection(section.section as EducationRegenerableSection),
        }))}
        empty="No weak regenerable sections are currently reported."
      />
      <RevisionHistoryCard revisions={revisions} loading={false} error={null} />
      <RevisionCompareCard
        revisions={revisions}
        selectedFromVersion={compareFromVersion}
        selectedToVersion={compareToVersion}
        comparison={revisionCompare}
        loading={revisionCompareLoading}
        error={revisionCompareError}
        onFromVersionChange={onFromVersionChange}
        onToVersionChange={onToVersionChange}
      />
    </div>
  );
}

function AcceptedRepairsPanel({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const repairs = workspace.education.acceptedRepairs ?? [];
  if (!repairs.length) {
    return null;
  }
  const groups = repairsBySection(repairs);

  return (
    <CompactPanel
      title="Accepted repairs"
      subtitle="Draft education content now includes these reviewed claim repairs."
    >
      <div className="space-y-3">
        {Object.entries(groups).map(([section, sectionRepairs]) => (
          <div
            key={section}
            className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={formatLabel(section)} tone="success" />
              <StatusBadge
                status={`${sectionRepairs.length} accepted`}
                tone="neutral"
              />
            </div>
            <div className="mt-3 space-y-2">
              {sectionRepairs.map((repair) => (
                <div
                  key={`${repair.section}-${repair.sourceAuditId ?? repair.acceptedClaim}`}
                  className="rounded-md border border-[var(--color-teal)]/25 bg-[var(--color-teal)]/10 px-3 py-2"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Accepted repair
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-100">
                    {repair.acceptedClaim}
                  </p>
                  {repair.originalClaim ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Replaced: {repair.originalClaim}
                    </p>
                  ) : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                      Evidence-supported details
                    </summary>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Evidence:{' '}
                      {repair.evidenceIds.length
                        ? repair.evidenceIds.join(', ')
                        : 'none linked'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Accepted:{' '}
                      {repair.acceptedAt ? formatDate(repair.acceptedAt) : 'Unknown'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Source audit: {repair.sourceAuditId ?? 'unknown'}
                    </p>
                  </details>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompactPanel>
  );
}

function EducationQualityCard({
  workspace,
  pendingAction,
  onRegenerateSection,
}: {
  workspace: DiagnosisEditorialWorkspace;
  pendingAction: string | null;
  onRegenerateSection: (section: EducationRegenerableSection) => void;
}) {
  const regenerableSections: EducationRegenerableSection[] = [
    'differentials',
    'investigations',
    'examPearls',
    'management',
  ];

  return (
    <CompactPanel title="Education quality">
      <MetricGrid
        items={[
          { label: 'Status', value: formatLabel(workspace.education.status) },
          { label: 'Version', value: workspace.education.version ?? 'None' },
          { label: 'Quality', value: formatScore(workspace.education.qualityScore) },
          {
            label: 'Updated',
            value: workspace.education.updatedAt
              ? formatDate(workspace.education.updatedAt)
              : 'Unknown',
          },
        ]}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MessageList title="Blockers" tone="blocker" messages={workspace.education.blockers} />
        <MessageList title="Warnings" tone="warning" messages={workspace.education.warnings} />
      </div>
      {workspace.education.sectionHealth.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Regenerate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.education.sectionHealth.map((section) => (
                <tr key={section.section}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {formatLabel(section.section)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {formatScore(section.score)}
                  </td>
                  <td className="px-3 py-2">
                    {regenerableSections.includes(
                      section.section as EducationRegenerableSection,
                    ) ? (
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() =>
                          onRegenerateSection(
                            section.section as EducationRegenerableSection,
                          )
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Regenerate
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Section health will appear after education quality analysis runs.
        </p>
      )}
    </CompactPanel>
  );
}

function isRegenerableEducationSection(
  section: string,
): section is EducationRegenerableSection {
  return [
    'differentials',
    'investigations',
    'examPearls',
    'management',
  ].includes(section);
}
