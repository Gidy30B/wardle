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
  ClinicalSignalList,
  CollapsibleDetail,
  CompactMetricGrid,
  EditorialRow,
  EmptyGuidance,
  DraftAIActionsPanel,
  ReasoningCard,
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
      <CollapsibleDetail
        title="Revision history"
        summary={`${revisions.length} revision${revisions.length === 1 ? '' : 's'} available`}
      >
        <RevisionHistoryCard revisions={revisions} loading={false} error={null} />
      </CollapsibleDetail>
      <CollapsibleDetail
        title="Compare education revisions"
        summary="Open when checking drift between draft versions"
      >
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
      </CollapsibleDetail>
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
    <ReasoningCard
      eyebrow="Reviewed claim support"
      title="Accepted repairs"
      subtitle="Draft education content now includes these reviewed claim repairs."
      tone="success"
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
                <EditorialRow
                  key={`${repair.section}-${repair.sourceAuditId ?? repair.acceptedClaim}`}
                  title="Accepted repair"
                  subtitle={repair.originalClaim ? `Replaced: ${repair.originalClaim}` : undefined}
                  tone="success"
                  meta={<StatusBadge status="Evidence-supported" tone="success" />}
                >
                  <p className="mt-1 text-sm leading-6 text-slate-100">
                    {repair.acceptedClaim}
                  </p>
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
                </EditorialRow>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ReasoningCard>
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
  const qualityScore = workspace.education.qualityScore;

  return (
    <ReasoningCard
      eyebrow="Clinical signal health"
      title="Education quality"
      subtitle="Section quality, blockers, and regeneration points for draft-only clinical content."
      tone={workspace.education.blockers.length ? 'danger' : workspace.education.warnings.length ? 'warning' : 'success'}
    >
      <CompactMetricGrid
        items={[
          { label: 'Status', value: formatLabel(workspace.education.status) },
          { label: 'Version', value: workspace.education.version ?? 'None' },
          {
            label: 'Quality',
            value: formatScore(qualityScore),
            tone:
              qualityScore === null || qualityScore === undefined
                ? 'neutral'
                : qualityScore >= 0.75
                ? 'success'
                : qualityScore >= 0.5
                  ? 'warning'
                  : 'danger',
          },
          {
            label: 'Updated',
            value: workspace.education.updatedAt
              ? formatDate(workspace.education.updatedAt)
              : 'Unknown',
          },
        ]}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ClinicalSignalList
          title="Blockers"
          items={workspace.education.blockers}
          empty="No clinical-picture blockers reported."
          tone="danger"
        />
        <ClinicalSignalList
          title="Warnings"
          items={workspace.education.warnings}
          empty="No clinical-picture warnings reported."
          tone="warning"
        />
      </div>
      {workspace.education.sectionHealth.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-navy-border)]">
          <table className="min-w-full divide-y divide-[var(--color-navy-border)] text-sm">
            <thead className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Regenerate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-navy-border)]">
              {workspace.education.sectionHealth.map((section) => (
                <tr key={section.section}>
                  <td className="px-3 py-2 font-medium text-slate-100">
                    {formatLabel(section.section)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
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
                        className="editorial-action px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
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
        <EmptyGuidance
          title="No section health yet"
          description="Section health will appear after education quality analysis runs."
        />
      )}
    </ReasoningCard>
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
