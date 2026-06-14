import { useState } from 'react';
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
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import { ClaimRepairPanel } from '../ClaimRepairPanel';
import {
  ClinicalSignalList,
  CompactMetricGrid,
  EditorialEntity,
  EditorialRow,
  EditorialStream,
  EmptyGuidance,
  StreamDisclosure,
  ReasoningCard,
  SidebarDetailLayout,
  TabNextStepCard,
  WorkflowStateInline,
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
  const [activeSection, setActiveSection] = useState(
    workspace.education.sectionHealth[0]?.section ?? 'summary',
  );
  const sectionSidebar = (
    <>
      {workspace.education.sectionHealth.length ? (
        workspace.education.sectionHealth.map((section) => (
          <button
            key={section.section}
            type="button"
            onClick={() => setActiveSection(section.section)}
            className={[
              'rounded-lg border p-2.5 text-left transition',
              activeSection === section.section
                ? 'border-[rgba(0,180,166,0.4)] bg-[var(--color-teal-bg)]'
                : 'border-[var(--color-navy-border)] bg-[var(--color-navy-mid)]',
            ].join(' ')}
          >
            <div className="flex items-start gap-2">
              <span
                className={[
                  'mt-1 h-[6px] w-[6px] shrink-0 rounded-full',
                  section.blockers.length
                    ? 'bg-[var(--color-rose)]'
                    : section.warnings.length
                      ? 'bg-[var(--color-amber)]'
                      : 'bg-[var(--color-teal)]',
                ].join(' ')}
              />
              <div className="min-w-0">
                <p
                  className={`text-[12px] font-medium leading-snug ${
                    activeSection === section.section
                      ? 'text-[var(--color-teal)]'
                      : 'text-[var(--color-white-text)]'
                  }`}
                >
                  {formatLabel(section.section)}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--color-slate)]">
                    Quality {formatScore(section.score)}
                  </span>
                  {section.blockers.length + section.warnings.length > 0 ? (
                    <StatusBadge
                      status={`${section.blockers.length + section.warnings.length} issues`}
                      tone={section.blockers.length ? 'danger' : 'warning'}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </button>
        ))
      ) : (
        <div className="rounded-lg border border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] p-2.5 text-[12px] text-[var(--color-slate)]">
          No sections
        </div>
      )}
    </>
  );

  const activeSectionHealth = workspace.education.sectionHealth.find(
    (section) => section.section === activeSection,
  );
  const sectionTone: StatusBadgeTone = activeSectionHealth
    ? activeSectionHealth.blockers.length > 0
      ? 'danger'
      : activeSectionHealth.warnings.length > 0 ||
          activeSectionHealth.regenerationRecommended
        ? 'warning'
        : 'success'
    : 'neutral';
  const qualityTone: StatusBadgeTone =
    activeSectionHealth?.score === null || activeSectionHealth?.score === undefined
      ? 'neutral'
      : activeSectionHealth.score >= 0.75
        ? 'success'
        : activeSectionHealth.score >= 0.5
          ? 'warning'
          : 'danger';
  const canRegenerateActiveSection = Boolean(
    activeSectionHealth &&
      isRegenerableEducationSection(activeSectionHealth.section),
  );
  const activeSectionClaims = (workspace.unsupportedClaimsBySection ?? []).filter(
    (claim) => claim.sectionId === activeSection,
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
      <EditorialStream
        eyebrow="Clinical picture"
        title="Recognition and teaching flow"
        subtitle="Shape the diagnosis narrative, repair unsupported claims in context, and keep revision checkpoints lightweight."
      >
        <SidebarDetailLayout
          sidebar={sectionSidebar}
          sidebarWidth={190}
          detail={
            <>
              {activeSectionHealth ? (
                <EditorialEntity
                  eyebrow="Section health"
                  title={formatLabel(activeSectionHealth.section)}
                  subtitle={
                    activeSectionHealth.reason ??
                    activeSectionHealth.blockers[0] ??
                    activeSectionHealth.warnings[0] ??
                    'Recognition signal is acceptable.'
                  }
                  tone={sectionTone}
                  state={
                    <WorkflowStateInline
                      label={
                        activeSectionHealth.regenerationRecommended
                          ? 'Regeneration recommended'
                          : 'Healthy'
                      }
                      tone={sectionTone}
                    />
                  }
                  action={
                    canRegenerateActiveSection ? (
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() =>
                          onRegenerateSection(
                            activeSectionHealth.section as EducationRegenerableSection,
                          )
                        }
                        className="editorial-action px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Regenerate section
                      </button>
                    ) : null
                  }
                >
                  <CompactMetricGrid
                    items={[
                      {
                        label: 'Quality',
                        value: formatScore(activeSectionHealth.score),
                        tone: qualityTone,
                      },
                      {
                        label: 'Coverage',
                        value: formatScore(activeSectionHealth.coverageScore),
                      },
                      {
                        label: 'Pattern compliance',
                        value: formatScore(activeSectionHealth.patternComplianceScore),
                      },
                      {
                        label: 'Regeneration',
                        value: activeSectionHealth.regenerationRecommended
                          ? 'Recommended'
                          : 'Not needed',
                        tone: activeSectionHealth.regenerationRecommended
                          ? 'warning'
                          : 'success',
                      },
                    ]}
                  />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <ClinicalSignalList
                      title="Blockers"
                      items={activeSectionHealth.blockers}
                      empty="No blockers reported for this section."
                      tone="danger"
                    />
                    <ClinicalSignalList
                      title="Warnings"
                      items={activeSectionHealth.warnings}
                      empty="No warnings reported for this section."
                      tone="warning"
                    />
                  </div>
                </EditorialEntity>
              ) : (
                <EmptyGuidance
                  title="No section health yet"
                  description="Section health will appear after education quality analysis runs."
                />
              )}
              <ClaimRepairPanel
                claims={activeSectionClaims}
                repairs={claimRepairs}
                pendingAction={pendingAction}
                targetClaimId={targetClaimId}
                targetSectionId={targetSectionId}
                onRepairUnsupportedClaim={onRepairUnsupportedClaim}
                onClaimRepairDecision={onClaimRepairDecision}
              />
              <AcceptedRepairsPanel workspace={workspace} />
              <StreamDisclosure
                title="Revision checkpoints"
                summary={`${revisions.length} revision${revisions.length === 1 ? '' : 's'} available`}
              >
                <div className="space-y-3">
                  <RevisionHistoryCard
                    revisions={revisions}
                    loading={false}
                    error={null}
                  />
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
              </StreamDisclosure>
            </>
          }
        />
      </EditorialStream>
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
