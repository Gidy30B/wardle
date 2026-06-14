import type {
  AiDraftDecisionAction,
  ClaimRepairResult,
  DiagnosisEditorialWorkspace,
  DiagnosisEducationRevisionAnalysis,
  DiagnosisEducationRevisionCompareResult,
  EducationRegenerableSection,
} from '../../../../api/admin';
import StatusBadge from '../../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import RevisionCompareCard from '../../../cases/education/RevisionCompareCard';
import RevisionHistoryCard from '../../../cases/education/RevisionHistoryCard';
import { ClaimRepairPanel } from '../ClaimRepairPanel';
import {
  ClinicalSignalList,
  DraftAIActionsPanel,
  EditorialRow,
  EmptyGuidance,
  ReasoningCard,
  StreamDisclosure,
  TabNextStepCard,
} from '../EditorialPrimitives';
import { repairsBySection } from '../acceptedRepairs';
import {
  formatDate,
  formatLabel,
  formatScore,
} from '../workspaceTransforms';

export function IntegrityTab({
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
  const unsupportedClaims = workspace.unsupportedClaimsBySection ?? [];
  const sections = workspace.education.sectionHealth;
  const blockerCount = sections.reduce(
    (count, section) => count + section.blockers.length,
    0,
  );
  const regenerableSections = sections.filter((section) =>
    isRegenerableEducationSection(section.section),
  );

  return (
    <div className="space-y-4">
      {!workspace.education.id ? (
        <TabNextStepCard
          title="No education content yet"
          description="Generate or draft education content before integrity review."
        />
      ) : null}
      <StreamDisclosure
        title="Claims & Evidence"
        summary={`${unsupportedClaims.length} unsupported claim${unsupportedClaims.length === 1 ? '' : 's'}`}
      >
        <div className="space-y-3">
          <ClaimRepairPanel
            claims={unsupportedClaims}
            repairs={claimRepairs}
            pendingAction={pendingAction}
            targetClaimId={targetClaimId}
            targetSectionId={targetSectionId}
            onRepairUnsupportedClaim={onRepairUnsupportedClaim}
            onClaimRepairDecision={onClaimRepairDecision}
          />
          <AcceptedRepairsPanel workspace={workspace} />
        </div>
      </StreamDisclosure>
      <StreamDisclosure
        title="Section quality"
        summary={`${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`}
      >
        <div className="space-y-3">
          <DraftAIActionsPanel
            actions={regenerableSections.map((section) => ({
              id: `regenerate-${section.section}`,
              label: `Regenerate ${formatLabel(section.section)}`,
              detail:
                section.reason ??
                section.blockers[0] ??
                section.warnings[0] ??
                'Generate a fresh draft for this education section.',
              disabled: pendingAction !== null,
              onAction: () =>
                onRegenerateSection(section.section as EducationRegenerableSection),
            }))}
            empty="No regenerable education sections are available."
          />
          {sections.length ? (
            <div className="space-y-2">
              {sections.map((section) => {
                const tone = sectionQualityTone(section.score);
                return (
                  <EditorialRow
                    key={section.section}
                    title={formatLabel(section.section)}
                    subtitle={
                      section.reason ??
                      section.blockers[0] ??
                      section.warnings[0] ??
                      'Section quality is within target.'
                    }
                    tone={tone}
                    meta={
                      <StatusBadge
                        status={`Quality ${section.score === null ? 'Unscored' : formatScore(section.score)}`}
                        tone={tone}
                      />
                    }
                    action={
                      isRegenerableEducationSection(section.section) ? (
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
                          Regenerate section
                        </button>
                      ) : null
                    }
                  >
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <ClinicalSignalList
                        title="Blockers"
                        items={section.blockers}
                        empty="No blockers reported."
                        tone="danger"
                      />
                      <ClinicalSignalList
                        title="Warnings"
                        items={section.warnings}
                        empty="No warnings reported."
                        tone="warning"
                      />
                    </div>
                  </EditorialRow>
                );
              })}
            </div>
          ) : (
            <EmptyGuidance
              title="No section quality analysis"
              description="Run education section analysis so blockers, warnings, and regeneration options can be reviewed here."
            />
          )}
        </div>
      </StreamDisclosure>
      <StreamDisclosure
        title="AI Draft Reviews"
        summary={`${(workspace.aiDraftAuditTrail ?? []).length + (workspace.discriminatorDraftReviews ?? []).length} draft review${(workspace.aiDraftAuditTrail ?? []).length + (workspace.discriminatorDraftReviews ?? []).length === 1 ? '' : 's'}`}
      >
        <AIDraftReviewSummary workspace={workspace} />
      </StreamDisclosure>
      <StreamDisclosure
        title="Case Revision Drafts"
        summary={`${(workspace.materializedClueRevisionDrafts ?? []).length} clue revision draft${(workspace.materializedClueRevisionDrafts ?? []).length === 1 ? '' : 's'}`}
      >
        <CaseRevisionDraftSummary workspace={workspace} />
      </StreamDisclosure>
      <StreamDisclosure
        title="Revision History"
        summary={`${revisions.length} revision${revisions.length === 1 ? '' : 's'} available`}
      >
        <div className="space-y-3">
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
      </StreamDisclosure>
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
    return (
      <EmptyGuidance
        title="No accepted repairs"
        description="Accepted claim repairs will appear here after editor review."
      />
    );
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
                  subtitle={
                    repair.originalClaim
                      ? `Replaced: ${repair.originalClaim}`
                      : undefined
                  }
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

function AIDraftReviewSummary({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const audits = workspace.aiDraftAuditTrail ?? [];
  const discriminatorDrafts = workspace.discriminatorDraftReviews ?? [];
  const items = [
    ...audits.slice(0, 8).map((audit) => ({
      id: audit.id,
      title: formatLabel(audit.affectedArtifactType ?? audit.actionType),
      subtitle: audit.reviewNote ?? formatLabel(audit.actionType),
      status: audit.reviewStatus,
    })),
    ...discriminatorDrafts.slice(0, 8).map((draft) => ({
      id: draft.auditId,
      title: `${draft.discriminatorDraftReview.mimicName} discriminator draft`,
      subtitle:
        draft.discriminatorDraftReview.reviewGuidance.primaryQuestion ??
        draft.discriminatorDraftReview.discriminator,
      status: draft.reviewStatus,
    })),
  ];

  if (!items.length) {
    return (
      <EmptyGuidance
        title="No AI draft reviews"
        description="Generated draft review queues will appear here when they need editor attention."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <EditorialRow
          key={item.id}
          title={item.title}
          subtitle={item.subtitle}
          tone={reviewTone(item.status)}
          meta={
            <StatusBadge
              status={formatLabel(item.status)}
              tone={reviewTone(item.status)}
            />
          }
        />
      ))}
    </div>
  );
}

function CaseRevisionDraftSummary({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const drafts = workspace.materializedClueRevisionDrafts ?? [];
  if (!drafts.length) {
    return (
      <EmptyGuidance
        title="No case revision drafts"
        description="Accepted clue revision proposals will appear here after materialization."
      />
    );
  }

  return (
    <div className="space-y-2">
      {drafts.slice(0, 12).map((draft) => (
        <EditorialRow
          key={draft.id}
          title={draft.revisedClue ?? draft.addedClue ?? 'Clue revision draft'}
          subtitle={
            draft.expectedEffect ??
            draft.rationale ??
            draft.originalClue ??
            undefined
          }
          tone={reviewTone(draft.status)}
          meta={
            <StatusBadge
              status={formatLabel(draft.status)}
              tone={reviewTone(draft.status)}
            />
          }
        />
      ))}
    </div>
  );
}

function reviewTone(status: string): StatusBadgeTone {
  if (['APPROVED', 'APPLIED', 'ACCEPTED'].includes(status)) return 'success';
  if (['REJECTED', 'BLOCKED_CASE_NOT_EDITABLE', 'FAILED'].includes(status)) {
    return 'danger';
  }
  if (['PENDING_REVIEW', 'REVIEW_REQUIRED', 'NEEDS_CHANGES'].includes(status)) {
    return 'warning';
  }
  return 'neutral';
}

function sectionQualityTone(score: number | null | undefined): StatusBadgeTone {
  if (score === null || score === undefined) return 'warning';
  if (score < 0.5) return 'danger';
  if (score < 0.75) return 'warning';
  return 'success';
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
