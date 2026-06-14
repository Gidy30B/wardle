import { Network } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  generateDiagnosisTeachingRelationshipCandidates,
  generateEvidenceGraphCandidates,
  generateReasoningPathCandidates,
  reviewDiagnosisTeachingRelationship,
  reviewEvidenceGraphRelationship,
  reviewReasoningPath,
  strengthenDifferentialDraft,
  suggestTeachingDistinctionDraft,
  type DiagnosisEditorialWorkspace,
  type DiagnosisEvidenceRelationship,
  type DiagnosisGraphCandidate,
  type DiagnosisTeachingRelationship,
  type DiagnosisTeachingRelationshipReviewAction,
  type EvidenceGraphReviewAction,
  type GenerateClueRevisionProposalPayload,
  type GenerateTargetedCasePayload,
  type GenerateTargetedDiscriminatorCasePayload,
  type DiscriminatorDraftReview,
  type ReasoningPath,
  type ReasoningPathReviewAction,
  type StructuredDifferentialLink,
  type TargetedDiscriminatorGenerationRequest,
  type WorkspaceCoverageMatrixRow,
} from '../../../../api/admin';
import type { ApiClient } from '../../../../api/client';
import StatusBadge from '../../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import type { ConsoleAccessState } from '../../../../hooks/useConsoleAccess';
import { CoverageMatrixCard } from '../CoveragePanels';
import {
  DiscriminatorReveal,
  EditorialNarrativeThread,
  LearnerFailureProjection,
  NarrativeCheckpoint,
  NarrativeStream,
  ReasoningTransition,
} from '../EditorialNarrativePrimitives';
import {
  CompactMetricGrid,
  CompactPanel,
  DraftAIActionsPanel,
  EditorialEntity,
  EditorialStream,
  EditorialRow,
  EmbeddedActionBar,
  EmptyGuidance,
  ExplainabilityMetric,
  InlineReviewBar,
  MetricGrid,
  RelationshipActionButton,
  ReasoningThread,
  SecondaryActionDisclosure,
  SidebarDetailLayout,
  StreamDisclosure,
  StatusStrip,
  TabNextStepCard,
  WorkflowStateInline,
} from '../EditorialPrimitives';
import {
  buildMimicSurvivalSummary,
  type MimicSurvivalSummary,
  mimicSurvivalState,
  mimicSurvivalStateMeta,
} from '../mimicSurvival';
import {
  errorMessage,
  formatLabel,
  groupEvidenceRelationships,
  groupReasoningPaths,
} from '../workspaceTransforms';
export function DifferentialMapTab({
  workspace,
  selectedRow,
  onRowSelect,
  access,
  client,
  onRefresh,
  onGenerateTargetedCase,
  onGenerateDiscriminatorCase,
  onGenerateClueRevision,
  showError,
  showPending,
  showSuccess,
}: {
  workspace: DiagnosisEditorialWorkspace;
  selectedRow: WorkspaceCoverageMatrixRow | null;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
  access: ConsoleAccessState;
  client: ApiClient;
  onRefresh: () => Promise<void>;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
  onGenerateDiscriminatorCase: (
    payload: GenerateTargetedDiscriminatorCasePayload,
  ) => void;
  onGenerateClueRevision: (payload: GenerateClueRevisionProposalPayload) => void;
  showError: (message: string) => void;
  showPending: (message: string) => void;
  showSuccess: (message: string) => void;
}) {
  const [graphDraftAction, setGraphDraftAction] = useState<string | null>(null);
  const [activeMimicId, setActiveMimicId] = useState<string | null>(null);

  const activeRelationships = workspace.graph.teachingRelationships.filter(
    (relationship) => relationship.status === 'ACTIVE',
  );
  const mimicGroups = useMemo(
    () => buildMimicReasoningGroups(workspace, activeRelationships),
    [workspace, activeRelationships],
  );
  const allMimicItems = mimicGroups.flatMap((group) => group.items);
  const activeMimic =
    allMimicItems.find((item) => item.id === activeMimicId) ?? allMimicItems[0] ?? null;

  async function runGraphDraftAction(
    id: string,
    pending: string,
    success: string,
    action: () => Promise<unknown>,
  ) {
    try {
      setGraphDraftAction(id);
      showPending(pending);
      await action();
      await onRefresh();
      showSuccess(success);
    } catch (error) {
      showError(errorMessage(error, 'Draft action failed.'));
    } finally {
      setGraphDraftAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {workspace.graph.factCount === 0 &&
      workspace.evidenceGraph.summary.active === 0 ? (
        <TabNextStepCard
          title="Differential map has no active evidence"
          description="Generate or review graph and evidence candidates so discriminators, mimics, and reasoning paths can support this diagnosis."
        />
      ) : null}
      <div style={{ minHeight: 500 }}>
      <SidebarDetailLayout
        sidebar={
          <MimicSurvivalSelector
            groups={mimicGroups}
            activeMimicId={activeMimic?.id ?? null}
            onSelect={setActiveMimicId}
          />
        }
        sidebarWidth={220}
        detail={
          <EditorialStream
            eyebrow="Differential map"
            title="Mimic separation stream"
            subtitle="Pick a mimic, check why it is plausible, what separates it, case support, and the next action."
          >
            {allMimicItems.length === 0 ? (
              <EmptyGuidance
                title="No mimics mapped yet"
                description="Generate graph candidates, add a teaching relationship, or add a differential mapping to populate the mimic survival narrative."
                action={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={graphDraftAction !== null}
                      onClick={() =>
                        runGraphDraftAction(
                          'strengthen-differential',
                          'Generating reasoning path candidates...',
                          'Reasoning path candidates generated for review.',
                          () =>
                            strengthenDifferentialDraft(client, workspace.diagnosis.id),
                        )
                      }
                      className="editorial-action px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Generate reasoning path candidates
                    </button>
                    <button
                      type="button"
                      disabled={graphDraftAction !== null}
                      onClick={() =>
                        runGraphDraftAction(
                          'teaching-distinction',
                          'Generating teaching distinction candidates...',
                          'Teaching distinction candidates generated for review.',
                          () =>
                            suggestTeachingDistinctionDraft(client, workspace.diagnosis.id),
                        )
                      }
                      className="editorial-action px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Suggest teaching distinction
                    </button>
                    <Link
                      to="/diagnosis-graph/candidates"
                      className="editorial-action px-3 py-1.5 text-xs"
                    >
                      Open graph candidate queue
                    </Link>
                  </div>
                }
              />
            ) : (
              <MimicSurvivalNarrative
                item={activeMimic!}
                pendingAction={graphDraftAction}
                onSuggestTeachingDistinction={() =>
                  runGraphDraftAction(
                    'teaching-distinction',
                    'Generating teaching distinction candidates...',
                    'Teaching distinction candidates generated for review.',
                    () =>
                      suggestTeachingDistinctionDraft(
                        client,
                        workspace.diagnosis.id,
                      ),
                  )
                }
                onStrengthenDifferential={() =>
                  runGraphDraftAction(
                    'strengthen-differential',
                    'Generating reasoning path candidates...',
                    'Reasoning path candidates generated for review.',
                    () =>
                      strengthenDifferentialDraft(client, workspace.diagnosis.id),
                  )
                }
                onGenerateTargetedCase={onGenerateTargetedCase}
                onGenerateDiscriminatorCase={onGenerateDiscriminatorCase}
                onGenerateClueRevision={onGenerateClueRevision}
              />
            )}
            <StreamDisclosure
              title="Map context"
              summary={`${workspace.graph.reviewableCandidateCount} reviewable graph candidate${workspace.graph.reviewableCandidateCount === 1 ? '' : 's'}`}
            >
              <CompactPanel title="Graph readiness">
                <StatusStrip
                  items={[
                    {
                      label: 'Status',
                      value: formatLabel(workspace.graph.readiness),
                      detail: 'Graph maturity',
                      tone:
                        workspace.graph.readiness === 'ready'
                          ? 'success'
                          : 'warning',
                    },
                    {
                      label: 'Facts',
                      value: workspace.graph.factCount,
                      detail: 'Reviewed graph facts',
                      tone: workspace.graph.factCount ? 'success' : 'warning',
                    },
                    {
                      label: 'Candidates',
                      value: workspace.graph.candidateCount,
                      detail: 'Generated graph objects',
                      tone: workspace.graph.candidateCount ? 'info' : 'neutral',
                    },
                    {
                      label: 'Reviewable',
                      value: workspace.graph.reviewableCandidateCount,
                      detail: 'Awaiting editorial action',
                      tone: workspace.graph.reviewableCandidateCount
                        ? 'warning'
                        : 'success',
                    },
                  ]}
                />
                <Link
                  to="/diagnosis-graph/candidates"
                  className="mt-3 inline-flex text-sm font-semibold text-[var(--color-teal)] underline"
                >
                  Open graph candidate queue
                </Link>
              </CompactPanel>
              <DifferentialMapOverviewCard
                workspace={workspace}
                mimicGroups={mimicGroups}
                pendingAction={graphDraftAction}
                onSuggestTeachingDistinction={() =>
                  runGraphDraftAction(
                    'teaching-distinction',
                    'Generating teaching distinction candidates...',
                    'Teaching distinction candidates generated for review.',
                    () =>
                      suggestTeachingDistinctionDraft(
                        client,
                        workspace.diagnosis.id,
                      ),
                  )
                }
                onStrengthenDifferential={() =>
                  runGraphDraftAction(
                    'strengthen-differential',
                    'Generating reasoning path candidates...',
                    'Reasoning path candidates generated for review.',
                    () =>
                      strengthenDifferentialDraft(client, workspace.diagnosis.id),
                  )
                }
                onGenerateTargetedCase={onGenerateTargetedCase}
              />
            </StreamDisclosure>
            <StreamDisclosure
              title="Teaching relationship details"
              summary={`${workspace.graph.teachingRelationships?.length ?? 0} relationship${(workspace.graph.teachingRelationships?.length ?? 0) === 1 ? '' : 's'}`}
            >
              <TeachingRelationshipPanel
                diagnosisRegistryId={workspace.diagnosis.id}
                relationships={workspace.graph.teachingRelationships ?? []}
                access={access}
                client={client}
                onRefresh={onRefresh}
                showError={showError}
                showPending={showPending}
                showSuccess={showSuccess}
              />
            </StreamDisclosure>
            <StreamDisclosure
              title="Reasoning paths"
              summary={`${workspace.reasoningPaths?.length ?? 0} draft or active path${(workspace.reasoningPaths?.length ?? 0) === 1 ? '' : 's'}`}
            >
              <ReasoningPathsPanel
                diagnosisRegistryId={workspace.diagnosis.id}
                paths={workspace.reasoningPaths ?? []}
                access={access}
                client={client}
                onRefresh={onRefresh}
                onGenerateTargetedCase={onGenerateTargetedCase}
                showError={showError}
                showPending={showPending}
                showSuccess={showSuccess}
              />
            </StreamDisclosure>
            <StreamDisclosure
              title="Evidence supporting this distinction"
              summary={`${workspace.evidenceGraph?.relationships?.length ?? 0} evidence relationship${(workspace.evidenceGraph?.relationships?.length ?? 0) === 1 ? '' : 's'}`}
            >
              <EvidenceGraphPanel
                diagnosisRegistryId={workspace.diagnosis.id}
                relationships={workspace.evidenceGraph?.relationships ?? []}
                summary={workspace.evidenceGraph?.summary}
                access={access}
                client={client}
                onRefresh={onRefresh}
                showError={showError}
                showPending={showPending}
                showSuccess={showSuccess}
              />
            </StreamDisclosure>
            <StreamDisclosure
              title="Evidence coverage details"
              summary="Scores, readiness, gaps, and draft trust signals"
            >
              <EvidenceCoveragePanel coverage={workspace.evidenceCoverage} />
            </StreamDisclosure>
            <StreamDisclosure
              title="Coverage matrix"
              summary={`${workspace.coverageMatrix.filter((row) => row.graphCoverage !== 'covered').length} uncovered or partial rows`}
            >
              <CoverageMatrixCard
                rows={workspace.coverageMatrix.filter(
                  (row) => row.graphCoverage !== 'covered',
                )}
                selectedRow={selectedRow}
                onRowSelect={onRowSelect}
              />
            </StreamDisclosure>
            <StreamDisclosure
              title="Linked differential records"
              summary={`${(workspace.linkedDifferentials ?? []).length} linked differential${(workspace.linkedDifferentials ?? []).length === 1 ? '' : 's'}`}
            >
              <LinkedDifferentialsList links={workspace.linkedDifferentials ?? []} />
            </StreamDisclosure>
            <StreamDisclosure
              title="Unreviewed graph candidates"
              summary={`${workspace.graph.candidates.length} candidate${workspace.graph.candidates.length === 1 ? '' : 's'}`}
            >
              <GraphCandidateList candidates={workspace.graph.candidates} />
            </StreamDisclosure>
          </EditorialStream>
        }
      />
      </div>
    </div>
  );
}

function MimicSurvivalSelector({
  groups,
  activeMimicId,
  onSelect,
}: {
  groups: MimicReasoningGroup[];
  activeMimicId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Mimic survival
      </p>
      {groups.map((group) =>
        group.items.length ? (
          <div key={group.id} className="space-y-1.5">
            <p className="px-1 text-xs font-semibold text-slate-400">
              {group.label}
            </p>
            {group.items.map((item) => {
              const survivalState = mimicSurvivalState(
                item.caseEliminationSupport,
                item.caseNeeded,
              );
              const meta = mimicSurvivalStateMeta(survivalState);
              const active = item.id === activeMimicId;
              const isDangerGroup =
                group.id === 'must_not_miss' || group.id === 'escalation';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={[
                    'w-full rounded-lg border px-3 py-2 text-left transition',
                    active
                      ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)]'
                      : isDangerGroup
                        ? 'border-[var(--color-rose)]/30 bg-[var(--color-rose)]/5 hover:border-[var(--color-rose)]/50'
                        : 'border-[var(--color-navy-border)] bg-white/[0.03] hover:border-slate-500',
                  ].join(' ')}
                >
                  <span className="block text-sm font-semibold text-[var(--color-white-text)]">
                    {item.label}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <StatusBadge status={meta.label} tone={meta.tone} />
                    {isDangerGroup ? (
                      <StatusBadge status="Must-not-miss" tone="danger" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}

function DifferentialMapOverviewCard({
  workspace,
  mimicGroups,
  pendingAction,
  onSuggestTeachingDistinction,
  onStrengthenDifferential,
  onGenerateTargetedCase,
}: {
  workspace: DiagnosisEditorialWorkspace;
  mimicGroups: MimicReasoningGroup[];
  pendingAction: string | null;
  onSuggestTeachingDistinction: () => void;
  onStrengthenDifferential: () => void;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
}) {
  const visibleItems = mimicGroups.flatMap((group) => group.items);
  const explicitCount = visibleItems.reduce(
    (count, item) => count + item.caseEliminationSupport.explicitSeparationCount,
    0,
  );
  const heuristicCount = visibleItems.reduce(
    (count, item) => count + item.caseEliminationSupport.heuristicOnlyCount,
    0,
  );
  const unresolvedCount = visibleItems.reduce(
    (count, item) =>
      count +
      item.caseEliminationSupport.unresolvedCount +
      item.caseEliminationSupport.persistentConfusionCount,
    0,
  );
  const activeRelationships = workspace.graph.teachingRelationships.filter(
    (relationship) => relationship.status === 'ACTIVE',
  );
  const mimicRelationships = activeRelationships.filter(
    (relationship) => relationship.relationshipType === 'MIMIC_CONFUSION',
  );
  const discriminatorRelationships = activeRelationships.filter(
    (relationship) =>
      relationship.relationshipType === 'DIFFERENTIAL_DISCRIMINATOR',
  );
  const confusionRisks = workspace.graph.teachingRelationships.filter(
    (relationship) =>
      relationship.commonConfusionReason || relationship.learnerPitfall,
  );
  const weakReasoningPath = workspace.reasoningPaths.find(
    (path) => path.status !== 'REJECTED' && path.readinessTier !== 'ready',
  );
  const activeCasePath = workspace.reasoningPaths.find(
    (path) =>
      path.status === 'ACTIVE' &&
      path.generationPurpose === 'CASE_GENERATION' &&
      path.discriminatorEvidenceNodeIds.length > 0,
  );
  const escalationCoverage = workspace.escalationCoverage;
  const explicitEscalations = (workspace.caseEscalationCoverage ?? []).filter(
    (item) => item.coverageSource === 'explicit' && item.covered,
  ).length;
  const inferredEscalations = (workspace.caseEscalationCoverage ?? []).filter(
    (item) => item.coverageSource === 'inferred' && item.covered,
  ).length;
  const relationshipNodes = [
    {
      label: 'Mimic',
      value: mimicRelationships.length,
      tone: mimicRelationships.length ? 'success' : 'warning',
      detail: 'Active confusion relationships',
    },
    {
      label: 'Discriminator',
      value: discriminatorRelationships.length,
      tone: discriminatorRelationships.length ? 'success' : 'warning',
      detail: 'Active teaching distinctions',
    },
    {
      label: 'Escalation',
      value: explicitEscalations + inferredEscalations,
      tone: explicitEscalations
        ? 'success'
        : inferredEscalations
          ? 'info'
          : 'warning',
      detail: `${explicitEscalations} explicit / ${inferredEscalations} inferred`,
    },
    {
      label: 'Case',
      value: workspace.cases.summary.usable,
      tone: workspace.cases.summary.usable ? 'success' : 'warning',
      detail: 'Usable assessment cases',
    },
  ] satisfies Array<{
    label: string;
    value: number;
    tone: StatusBadgeTone;
    detail: string;
  }>;
  const reasoningSummary = buildReasoningSummary(
    workspace,
    visibleItems,
    discriminatorRelationships,
  );

  return (
    <EditorialNarrativeThread
      eyebrow="Mimic survival"
      title="Case-governed differential separation"
      subtitle={`${explicitCount} explicit / ${heuristicCount} heuristic-only / ${unresolvedCount} unresolved`}
      tone={unresolvedCount || heuristicCount ? 'warning' : 'success'}
    >
      <RelationshipSummaryStrip summary={reasoningSummary} />
      <StreamDisclosure
        title="Signal legend and relationship metrics"
        summary="Support legend, relationship counts, and explainability detail"
      >
        <SignalLegend />
        <RelationshipStrip nodes={relationshipNodes} />
        <div className="grid gap-3 lg:grid-cols-2">
          <ExplainabilityMetric
            label="Discriminator coverage"
            value={`${discriminatorRelationships.length} active`}
            detail={`${workspace.evidenceGraph.summary.discriminatorEvidence} active discriminator evidence relationships are available.`}
            tone={discriminatorRelationships.length ? 'success' : 'warning'}
          />
          <ExplainabilityMetric
            label="Missing mimic coverage"
            value={`${mimicRelationships.length} active`}
            detail={
              mimicRelationships.length
                ? 'Active mimic-confusion teaching relationships are present.'
                : 'No active mimic-confusion relationship is available for learner contrast.'
            }
            tone={mimicRelationships.length ? 'success' : 'warning'}
          />
          <ExplainabilityMetric
            label="Case coverage"
            value={
              workspace.evidenceCoverage
                ? `${workspace.evidenceCoverage.coverageBreakdown.caseEvidenceCoverage}%`
                : `${workspace.cases.summary.usable} usable`
            }
            detail="Uses evidence coverage caseEvidenceCoverage when available; otherwise uses usable case inventory."
            tone={workspace.cases.summary.usable ? 'success' : 'warning'}
          />
          <ExplainabilityMetric
            label="Learner-confusion risk"
            value={`${confusionRisks.length} signals`}
            detail={
              confusionRisks[0]?.commonConfusionReason ??
              confusionRisks[0]?.learnerPitfall ??
              'No explicit confusion reason or learner pitfall is attached.'
            }
            tone={confusionRisks.length ? 'warning' : 'success'}
          />
          <ExplainabilityMetric
            label="Escalation coverage"
            value={escalationCoverage?.coversEscalation ? 'Covered' : 'Missing'}
            detail={
              explicitEscalations || inferredEscalations
                ? `${explicitEscalations} explicit, ${inferredEscalations} inferred case escalation links.`
                : escalationCoverage
                ? [
                    escalationCoverage.missingEscalationTeaching
                      ? 'missing teaching'
                      : null,
                    escalationCoverage.weakEscalationEvidence
                      ? 'weak evidence'
                      : null,
                    escalationCoverage.noPlayableEscalationCase
                      ? 'no playable case'
                      : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Active escalation support is available.'
                : `${workspace.reasoningPaths.filter((path) => path.escalationEvidenceNodeIds.length > 0).length} reasoning paths include escalation evidence.`
            }
            tone={escalationCoverage?.coversEscalation ? 'success' : 'warning'}
          />
        </div>
      </StreamDisclosure>
      <DraftAIActionsPanel
        actions={[
          {
            id: 'strengthen-differential',
            label: 'Strengthen differential',
            detail:
              weakReasoningPath?.readinessReasons[0] ??
              'Generate draft reasoning paths to improve differential support.',
            disabled: pendingAction !== null,
            onAction: onStrengthenDifferential,
          },
          {
            id: 'suggest-teaching-distinction',
            label: 'Suggest teaching distinction',
            detail:
              confusionRisks[0]?.learnerPitfall ??
              'Generate draft teaching relationship candidates for discriminator review.',
            disabled: pendingAction !== null,
            onAction: onSuggestTeachingDistinction,
          },
          {
            id: 'case-from-differential-path',
            label: 'Generate case from uncovered goal',
            detail:
              activeCasePath?.title ??
              'Requires an active case-generation reasoning path with discriminator evidence.',
            disabled: pendingAction !== null || !activeCasePath,
            onAction: () => {
              if (!activeCasePath) return;
              onGenerateTargetedCase({
                difficulty: 'MEDIUM',
                teachingUnitIds: [],
                reasoningPathId: activeCasePath.id,
                clueRevealStrategy: 'late_discriminator',
              });
            },
          },
        ]}
      />
    </EditorialNarrativeThread>
  );
}

function MimicSurvivalNarrative({
  item,
  pendingAction,
  onSuggestTeachingDistinction,
  onStrengthenDifferential,
  onGenerateTargetedCase,
  onGenerateDiscriminatorCase,
  onGenerateClueRevision,
}: {
  item: MimicReasoningItem;
  pendingAction: string | null;
  onSuggestTeachingDistinction: () => void;
  onStrengthenDifferential: () => void;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
  onGenerateDiscriminatorCase: (
    payload: GenerateTargetedDiscriminatorCasePayload,
  ) => void;
  onGenerateClueRevision: (payload: GenerateClueRevisionProposalPayload) => void;
}) {
  const survival = item.caseEliminationSupport;
  const survivalState = mimicSurvivalState(survival, item.caseNeeded);
  const stateMeta = mimicSurvivalStateMeta(survivalState);
  const group = groupMimicItem(item);
  const groupDef = mimicGroupDefinitions.find(
    (definition) => definition.id === group,
  );
  const primaryAction = mimicPrimaryAction(item);
  const primaryOpportunity = item.generationOpportunities[0];
  const topDiscriminator = item.discriminators[0] ?? null;
  const discriminatorChips = item.discriminators.slice(0, 3);
  const remainingDiscriminators = item.discriminators.slice(3);

  const entryReason =
    item.relationship?.commonConfusionReason ??
    item.relationship?.learnerPitfall ??
    item.link?.sourceText ??
    'No documented reason for this differential entry yet.';
  const entryDetail = item.link
    ? `Linked as ${formatLabel(item.link.role)} from structured differential mapping.`
    : item.relationship
      ? `Relationship purpose: ${formatLabel(item.relationship.teachingPurpose)}.`
      : null;

  const transitionText =
    survival.total === 0
      ? 'No case has yet been checked against this discriminator.'
      : survival.explicitSeparationCount > 0
        ? `Cases have used ${topDiscriminator ? 'the discriminator above' : 'a discriminator'} to separate this mimic.`
        : 'Cases eliminate this mimic, but not explicitly via the discriminator above.';
  const transitionTone =
    survival.total === 0 || survival.heuristicOnlyCount > 0 ? 'warning' : 'info';

  const unresolvedTotal = survival.unresolvedCount + survival.persistentConfusionCount;
  const checkpoint3Title =
    survival.total === 0
      ? 'No case-level elimination evidence is available for this mimic yet.'
      : `${survival.explicitSeparationCount} case${survival.explicitSeparationCount === 1 ? '' : 's'} explicitly separate this mimic${
          survival.heuristicOnlyCount > 0
            ? `, ${survival.heuristicOnlyCount} more via heuristic-only elimination`
            : ''
        }${
          unresolvedTotal > 0
            ? `; ${unresolvedTotal} case${unresolvedTotal === 1 ? '' : 's'} leave it unresolved`
            : '.'
        }`;

  const checkpoint4Title =
    group === 'must_not_miss' && survivalState === 'unresolved'
      ? 'This is a must-not-miss mimic and remains unresolved — learners may proceed without ruling it out.'
      : item.caseNeeded || survival.total === 0
        ? 'No case currently exercises this differential — generate one to verify learner separation.'
        : survivalState === 'weak_elimination'
          ? 'Cases eliminate this mimic, but only weakly or via heuristic — strengthen the discriminator or case design.'
          : item.escalationSupport === 'missing' && group === 'escalation'
            ? 'This escalation mimic has no escalation-path case coverage.'
            : 'This mimic is well-separated — monitor for drift as new cases are added.';

  const hasSupportDetails =
    remainingDiscriminators.length > 0 ||
    Boolean(item.relationship?.supportingTeachingRule) ||
    Boolean(item.relationship?.supportingGraphFact) ||
    Boolean(item.link);

  return (
    <EditorialNarrativeThread
      eyebrow={groupDef?.label}
      title={item.label}
      subtitle={formatLabel(item.relationshipType)}
      tone={groupTone(group)}
      state={<StatusBadge status={stateMeta.label} tone={stateMeta.tone} />}
    >
      <NarrativeStream>
        <NarrativeCheckpoint
          tone={group === 'must_not_miss' || group === 'escalation' ? 'danger' : 'info'}
          marker={
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Why this mimic enters the differential
            </span>
          }
          title={`${formatLabel(item.relationshipType)} — ${entryReason}`}
        >
          {entryDetail ? (
            <p className="text-xs leading-5 text-slate-500">{entryDetail}</p>
          ) : null}
          {item.learnerRisk ? (
            <LearnerFailureProjection tone="warning">
              {item.learnerRisk}
            </LearnerFailureProjection>
          ) : null}
        </NarrativeCheckpoint>

        <NarrativeCheckpoint
          tone={item.evidenceSupport === 'missing' ? 'warning' : 'success'}
          marker={
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              What should separate it
            </span>
          }
          title={
            topDiscriminator
              ? `Discriminator: ${topDiscriminator}`
              : 'No discriminator has been documented for this mimic yet.'
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {discriminatorChips.length ? (
              discriminatorChips.map((discriminator) => (
                <DiscriminatorReveal key={discriminator} label={discriminator} />
              ))
            ) : (
              <StatusBadge
                status="No discriminator summary attached yet"
                tone="warning"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge
              status={`Evidence ${formatLabel(item.evidenceSupport)}`}
              tone={supportTone(item.evidenceSupport)}
            />
            <StatusBadge
              status={`Teaching ${formatLabel(item.teachingSupport)}`}
              tone={supportTone(item.teachingSupport)}
            />
          </div>
        </NarrativeCheckpoint>

        <ReasoningTransition tone={transitionTone}>{transitionText}</ReasoningTransition>

        <NarrativeCheckpoint
          tone={stateMeta.tone}
          marker={
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              What cases currently teach
            </span>
          }
          state={<StatusBadge status={stateMeta.label} tone={stateMeta.tone} />}
          title={checkpoint3Title}
        >
          {survival.total === 0 ? (
            <p className="text-xs leading-5 text-slate-500">
              No case-level elimination evidence yet.
            </p>
          ) : (
            <CompactMetricGrid
              items={[
                {
                  label: 'Explicit separation',
                  value: survival.explicitSeparationCount,
                  tone: survival.explicitSeparationCount ? 'success' : 'neutral',
                },
                {
                  label: 'Heuristic only',
                  value: survival.heuristicOnlyCount,
                  tone: survival.heuristicOnlyCount ? 'warning' : 'neutral',
                },
                {
                  label: 'Unresolved/persistent',
                  value: unresolvedTotal,
                  tone: unresolvedTotal ? 'danger' : 'success',
                },
                {
                  label: 'Weak elimination',
                  value: survival.weakEliminationCount,
                  tone: survival.weakEliminationCount ? 'warning' : 'success',
                },
              ]}
            />
          )}
          {survival.persistentConfusionCount > 0 ||
          survival.highRiskFlags.remainingConfusion ? (
            <LearnerFailureProjection tone="danger">
              {survival.persistentConfusionCount} case
              {survival.persistentConfusionCount === 1 ? '' : 's'} show persistent
              confusion — learners may still believe this mimic is plausible even
              after elimination.
            </LearnerFailureProjection>
          ) : null}
        </NarrativeCheckpoint>

        <NarrativeCheckpoint
          tone={
            group === 'must_not_miss' && survivalState === 'unresolved'
              ? 'danger'
              : 'neutral'
          }
          marker={
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Editorial risk and next move
            </span>
          }
          title={checkpoint4Title}
        >
          <MimicDraftRepairIndicator reviews={item.discriminatorDraftReviews} />
          {primaryOpportunity ? (
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                status={formatLabel(primaryOpportunity.generationIntent)}
                tone="warning"
              />
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() =>
                  onGenerateDiscriminatorCase({
                    target: primaryOpportunity,
                    difficulty: 'MEDIUM',
                    clueRevealStrategy: 'late_discriminator',
                  })
                }
                className="editorial-action editorial-action-primary px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                Generate discriminator case
              </button>
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() =>
                  onGenerateClueRevision({
                    target: primaryOpportunity,
                    desiredClueOrder:
                      primaryOpportunity.sourceClueOrder ??
                      primaryOpportunity.sourceClueIndex,
                  })
                }
                className="editorial-action px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                Strengthen pathway
              </button>
            </div>
          ) : null}
          <InlineReviewBar
            note={
              item.caseNeeded
                ? 'Case support is missing for this mimic.'
                : 'Review support before changing graph state.'
            }
          >
            <button
              type="button"
              disabled={
                pendingAction !== null ||
                (primaryAction.kind === 'generate-case' && !item.targetDiagnosisId)
              }
              onClick={() => {
                if (primaryAction.kind === 'generate-case' && item.targetDiagnosisId) {
                  onGenerateTargetedCase({
                    difficulty: 'MEDIUM',
                    teachingUnitIds: [],
                    mimicDiagnosisIds: [item.targetDiagnosisId],
                    clueRevealStrategy: 'late_discriminator',
                  });
                } else if (primaryAction.kind === 'strengthen-differential') {
                  onStrengthenDifferential();
                } else if (primaryAction.kind === 'suggest-distinction') {
                  onSuggestTeachingDistinction();
                }
              }}
              className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {primaryAction.label}
            </button>
          </InlineReviewBar>
          {hasSupportDetails ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400">
                Support details
              </summary>
              <div className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
                {remainingDiscriminators.map((discriminator) => (
                  <p key={discriminator}>{discriminator}</p>
                ))}
                {item.relationship?.supportingTeachingRule ? (
                  <p>
                    Teaching rule: {item.relationship.supportingTeachingRule.title}
                  </p>
                ) : null}
                {item.relationship?.supportingGraphFact ? (
                  <p>Graph fact: {item.relationship.supportingGraphFact.label}</p>
                ) : null}
                {item.link ? <p>Structured link: {item.link.sourceText}</p> : null}
              </div>
            </details>
          ) : null}
        </NarrativeCheckpoint>
      </NarrativeStream>
    </EditorialNarrativeThread>
  );
}

type MimicGroupId =
  | 'primary'
  | 'common'
  | 'must_not_miss'
  | 'escalation'
  | 'related'
  | 'other';

type SupportState = 'explicit' | 'inferred' | 'missing';

type MimicReasoningItem = {
  id: string;
  label: string;
  targetDiagnosisId: string | null;
  relationshipType: string;
  learnerRisk: string | null;
  discriminators: string[];
  evidenceSupport: SupportState;
  teachingSupport: SupportState;
  caseSupport: SupportState;
  escalationSupport: SupportState;
  caseNeeded: boolean;
  caseEliminationSupport: MimicSurvivalSummary;
  generationOpportunities: TargetedDiscriminatorGenerationRequest[];
  discriminatorDraftReviews: DiscriminatorDraftReview[];
  relationship?: DiagnosisTeachingRelationship;
  link?: StructuredDifferentialLink;
};

type MimicReasoningGroup = {
  id: MimicGroupId;
  label: string;
  detail: string;
  items: MimicReasoningItem[];
};

function RelationshipSummaryStrip({
  summary,
}: {
  summary: Array<{
    label: string;
    value: number;
    detail: string;
    tone: StatusBadgeTone;
  }>;
}) {
  return (
    <div className="mb-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {summary.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {item.label}
            </p>
            <StatusBadge status={String(item.value)} tone={item.tone} />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function buildMimicReasoningGroups(
  workspace: DiagnosisEditorialWorkspace,
  activeRelationships: DiagnosisTeachingRelationship[],
): MimicReasoningGroup[] {
  const linkedByRegistryId = new Map(
    (workspace.linkedDifferentials ?? []).map((link) => [
      link.diagnosisRegistryId,
      link,
    ]),
  );
  const items = new Map<string, MimicReasoningItem>();

  for (const relationship of activeRelationships) {
    if (!isReasoningMimicRelationship(relationship)) {
      continue;
    }
    const link = linkedByRegistryId.get(relationship.targetDiagnosisRegistryId);
    const item = buildMimicReasoningItem(workspace, relationship, link);
    items.set(item.id, item);
  }

  for (const link of workspace.linkedDifferentials ?? []) {
    if (items.has(link.diagnosisRegistryId)) {
      continue;
    }
    const item = buildMimicReasoningItem(workspace, undefined, link);
    items.set(item.id, item);
  }

  return mimicGroupDefinitions.map((group) => ({
    ...group,
    items: [...items.values()]
      .filter((item) => groupMimicItem(item) === group.id)
      .sort((left, right) => mimicSortRank(left) - mimicSortRank(right)),
  }));
}

function buildMimicReasoningItem(
  workspace: DiagnosisEditorialWorkspace,
  relationship?: DiagnosisTeachingRelationship,
  link?: StructuredDifferentialLink,
): MimicReasoningItem {
  const label =
    relationship?.targetDiagnosisRegistry.displayLabel ??
    link?.displayLabel ??
    'Unresolved mimic';
  const targetDiagnosisId =
    relationship?.targetDiagnosisRegistryId ?? link?.diagnosisRegistryId ?? null;
  const matchedCaseCoverage = (workspace.caseLearningGoalCoverage ?? []).some(
    (coverage) => textListMatchesTarget(coverage.coveredMimics, label, targetDiagnosisId),
  );
  const caseMissing = (workspace.caseLearningGoalCoverage ?? []).some((coverage) =>
    textListMatchesTarget(coverage.missingMimics, label, targetDiagnosisId),
  );
  const explicitEscalation = (workspace.caseEscalationCoverage ?? []).some(
    (coverage) => coverage.coverageSource === 'explicit' && coverage.covered,
  );
  const inferredEscalation = (workspace.caseEscalationCoverage ?? []).some(
    (coverage) => coverage.coverageSource === 'inferred' && coverage.covered,
  );

  return {
    id: targetDiagnosisId ?? relationship?.id ?? link?.sourceText ?? label,
    label,
    targetDiagnosisId,
    relationshipType: relationship?.relationshipType ?? link?.role ?? 'OTHER',
    learnerRisk:
      relationship?.commonConfusionReason ??
      relationship?.learnerPitfall ??
      null,
    discriminators: [
      relationship?.discriminatorSummary ?? null,
      relationship?.commonConfusionReason ?? null,
      relationship?.learnerPitfall ?? null,
      link?.sourceText ?? null,
    ].filter((item): item is string => Boolean(item)),
    evidenceSupport: relationship?.supportingGraphFact
      ? 'explicit'
      : relationship?.supportingGraphFactId
        ? 'inferred'
        : 'missing',
    teachingSupport: relationship?.supportingTeachingRule
      ? 'explicit'
      : relationship
        ? 'inferred'
        : 'missing',
    caseSupport: matchedCaseCoverage
      ? 'explicit'
      : workspace.cases.summary.usable > 0 && !caseMissing
        ? 'inferred'
        : 'missing',
    escalationSupport: explicitEscalation
      ? 'explicit'
      : inferredEscalation
        ? 'inferred'
        : 'missing',
    caseNeeded: !matchedCaseCoverage && (caseMissing || workspace.cases.summary.usable === 0),
    caseEliminationSupport: caseEliminationSupportForMimic(
      workspace,
      label,
      targetDiagnosisId,
    ),
    generationOpportunities: generationOpportunitiesForMimic(
      workspace,
      label,
      targetDiagnosisId,
    ),
    discriminatorDraftReviews: discriminatorDraftReviewsForMimic(
      workspace,
      label,
      targetDiagnosisId,
    ),
    relationship,
    link,
  };
}

function MimicDraftRepairIndicator({
  reviews,
}: {
  reviews: DiscriminatorDraftReview[];
}) {
  const pending = reviews.filter((review) =>
    ['PENDING_REVIEW', 'REVIEW_REQUIRED', 'NEEDS_CHANGES'].includes(
      review.reviewStatus,
    ),
  );
  const primary = pending[0] ?? reviews[0];
  if (!primary) {
    return null;
  }
  const payload = primary.discriminatorDraftReview;
  return (
    <div className="mt-3 rounded-md border border-[var(--color-amber)]/25 bg-[var(--color-amber)]/10 p-3">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status="Generated repair draft" tone="warning" />
        <StatusBadge status={formatLabel(primary.reviewStatus)} tone="warning" />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        Pending draft: {payload.mimicName} {formatLabel(payload.draftKind)}.
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Expected effect:{' '}
        {payload.proposedOutput.expectedMimicElimination
          ? `${payload.proposedOutput.expectedMimicElimination} separated by ${payload.discriminator}.`
          : payload.proposedOutput.clueRevision?.expectedEffect ??
            payload.reviewGuidance.primaryQuestion}
      </p>
    </div>
  );
}

function generationOpportunitiesForMimic(
  workspace: DiagnosisEditorialWorkspace,
  label: string,
  targetDiagnosisId: string | null,
) {
  return workspace.cases.items.flatMap((caseItem) =>
    (caseItem.clueProgression?.targetedGenerationOpportunities ?? []).filter(
      (opportunity) => {
        if (
          targetDiagnosisId &&
          opportunity.mimicDiagnosisId &&
          targetDiagnosisId === opportunity.mimicDiagnosisId
        ) {
          return true;
        }
        return opportunity.mimicName.toLowerCase() === label.toLowerCase();
      },
    ),
  );
}

function discriminatorDraftReviewsForMimic(
  workspace: DiagnosisEditorialWorkspace,
  label: string,
  targetDiagnosisId: string | null,
) {
  return (workspace.discriminatorDraftReviews ?? []).filter((review) => {
    const payload = review.discriminatorDraftReview;
    if (
      targetDiagnosisId &&
      payload.mimicDiagnosisId &&
      targetDiagnosisId === payload.mimicDiagnosisId
    ) {
      return true;
    }
    return payload.mimicName.toLowerCase() === label.toLowerCase();
  });
}

function caseEliminationSupportForMimic(
  workspace: DiagnosisEditorialWorkspace,
  label: string,
  targetDiagnosisId: string | null,
) {
  return buildMimicSurvivalSummary(workspace, label, targetDiagnosisId);
}

function buildReasoningSummary(
  workspace: DiagnosisEditorialWorkspace,
  items: MimicReasoningItem[],
  discriminatorRelationships: DiagnosisTeachingRelationship[],
) {
  const mustNotMissCount = items.filter(
    (item) => groupMimicItem(item) === 'must_not_miss',
  ).length;
  const mimicsWithoutCases = items.filter(
    (item) => item.caseSupport === 'missing',
  ).length;
  const weakDiscriminatorCount = items.filter(
    (item) => !item.discriminators.length || item.evidenceSupport === 'missing',
  ).length;
  const escalationGaps = workspace.escalationCoverage?.coversEscalation
    ? 0
    : [
        workspace.escalationCoverage?.missingEscalationTeaching,
        workspace.escalationCoverage?.weakEscalationEvidence,
        workspace.escalationCoverage?.noPlayableEscalationCase,
      ].filter(Boolean).length;

  return [
    {
      label: 'Mimics',
      value: items.length,
      detail: 'Visible mimic relationships',
      tone: items.length ? 'success' : 'warning',
    },
    {
      label: 'Must not miss',
      value: mustNotMissCount,
      detail: 'Dangerous exclusions',
      tone: mustNotMissCount ? 'danger' : 'success',
    },
    {
      label: 'No cases',
      value: mimicsWithoutCases,
      detail: 'Mimics lacking case support',
      tone: mimicsWithoutCases ? 'warning' : 'success',
    },
    {
      label: 'Weak discrim.',
      value: weakDiscriminatorCount,
      detail: 'Needs clearer separation',
      tone: weakDiscriminatorCount ? 'warning' : 'success',
    },
    {
      label: 'Escalation gaps',
      value: escalationGaps,
      detail: 'Must-not-miss coverage gaps',
      tone: escalationGaps ? 'danger' : 'success',
    },
    {
      label: 'Evidence links',
      value:
        workspace.evidenceGraph.summary.active ||
        discriminatorRelationships.length,
      detail: 'Active evidence relationships',
      tone: workspace.evidenceGraph.summary.active ? 'success' : 'warning',
    },
  ] satisfies Array<{
    label: string;
    value: number;
    detail: string;
    tone: StatusBadgeTone;
  }>;
}

const mimicGroupDefinitions: Array<Omit<MimicReasoningGroup, 'items'>> = [
  {
    id: 'primary',
    label: 'Primary mimic',
    detail: 'Closest differential or primary mimic from structured links.',
  },
  {
    id: 'common',
    label: 'Common confusion',
    detail: 'Likely learner mix-ups and common diagnostic traps.',
  },
  {
    id: 'must_not_miss',
    label: 'Must-not-miss',
    detail: 'Dangerous exclusions, complications, or important misses.',
  },
  {
    id: 'escalation',
    label: 'Escalation mimic',
    detail: 'Mimics tied to worsening, complication, or escalation decisions.',
  },
  {
    id: 'related',
    label: 'Related entity',
    detail: 'Adjacent conditions with shared presentations or teaching links.',
  },
  {
    id: 'other',
    label: 'Other / uncategorized',
    detail: 'Available relationships without enough metadata for a stronger bucket.',
  },
];

function isReasoningMimicRelationship(relationship: DiagnosisTeachingRelationship) {
  return [
    'MIMIC_CONFUSION',
    'SHARED_PRESENTATION',
    'ESCALATION_CONTRAST',
    'COMPLICATION_RELATIONSHIP',
    'DIFFERENTIAL_DISCRIMINATOR',
    'MANAGEMENT_CONTRAST',
    'INVESTIGATION_CONTRAST',
  ].includes(relationship.relationshipType);
}

function groupMimicItem(item: MimicReasoningItem): MimicGroupId {
  const role = item.link?.role;
  const relationshipType = item.relationship?.relationshipType;
  const text = [
    item.label,
    item.learnerRisk,
    ...item.discriminators,
    role,
    relationshipType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (role === 'PRIMARY_MIMIC') return 'primary';
  if (relationshipType === 'ESCALATION_CONTRAST' || text.includes('escalat')) {
    return 'escalation';
  }
  if (
    role === 'IMPORTANT_EXCLUSION' ||
    relationshipType === 'COMPLICATION_RELATIONSHIP' ||
    text.includes('must') ||
    text.includes('danger') ||
    text.includes('fatal') ||
    text.includes('miss')
  ) {
    return 'must_not_miss';
  }
  if (
    relationshipType === 'MIMIC_CONFUSION' ||
    item.relationship?.teachingPurpose === 'PREVENT_COMMON_ERROR' ||
    Boolean(item.learnerRisk)
  ) {
    return 'common';
  }
  if (relationshipType || role) return 'related';
  return 'other';
}

function mimicSortRank(item: MimicReasoningItem) {
  if (item.caseNeeded) return 0;
  if (item.evidenceSupport === 'missing') return 1;
  if (item.teachingSupport === 'missing') return 2;
  return 3;
}

function textListMatchesTarget(
  values: string[],
  label: string,
  targetDiagnosisId: string | null,
) {
  const needle = normalizeMimicText(label);
  return values.some((value) => {
    const normalized = normalizeMimicText(value);
    return (
      normalized === needle ||
      normalized.includes(needle) ||
      needle.includes(normalized) ||
      (targetDiagnosisId ? value === targetDiagnosisId : false)
    );
  });
}

function normalizeMimicText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function supportTone(state: SupportState): StatusBadgeTone {
  if (state === 'explicit') return 'success';
  if (state === 'inferred') return 'info';
  return 'warning';
}

function groupTone(groupId: MimicGroupId): StatusBadgeTone {
  if (groupId === 'must_not_miss' || groupId === 'escalation') return 'danger';
  if (groupId === 'common') return 'warning';
  if (groupId === 'primary') return 'info';
  return 'neutral';
}

function mimicPrimaryAction(item: MimicReasoningItem):
  | { kind: 'generate-case'; label: string }
  | { kind: 'strengthen-differential'; label: string }
  | { kind: 'suggest-distinction'; label: string } {
  if (item.caseNeeded) {
    return { kind: 'generate-case', label: 'Generate case for this mimic' };
  }
  if (item.evidenceSupport === 'missing') {
    return { kind: 'strengthen-differential', label: 'Strengthen evidence path' };
  }
  return { kind: 'suggest-distinction', label: 'Suggest teaching distinction' };
}

function SignalLegend() {
  const items: Array<{ label: string; tone: StatusBadgeTone; detail: string }> = [
    { label: 'Supported', tone: 'success', detail: 'Active and reviewed' },
    { label: 'Weak', tone: 'warning', detail: 'Needs evidence or cases' },
    { label: 'Blocked', tone: 'danger', detail: 'Publication blocker' },
    { label: 'Inferred', tone: 'info', detail: 'Derived fallback' },
    { label: 'Explicit', tone: 'success', detail: 'Editor annotated' },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2 rounded-lg bg-white/4 p-3 ring-1 ring-white/8">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <StatusBadge status={item.label} tone={item.tone} />
          <span className="text-xs text-slate-500">{item.detail}</span>
        </div>
      ))}
    </div>
  );
}

function RelationshipStrip({
  nodes,
}: {
  nodes: Array<{
    label: string;
    value: number;
    tone: StatusBadgeTone;
    detail: string;
  }>;
}) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {nodes.map((node) => (
        <div
          key={node.label}
          className="rounded-lg bg-white/5 p-3 ring-1 ring-white/8"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Network
                className="h-4 w-4 text-[var(--color-teal)]"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-100">
                {node.label}
              </p>
            </div>
            <StatusBadge status={String(node.value)} tone={node.tone} />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {node.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

function EvidenceCoveragePanel({
  coverage,
}: {
  coverage: DiagnosisEditorialWorkspace['evidenceCoverage'];
}) {
  if (!coverage) {
    return (
      <CompactPanel title="Evidence coverage">
        <p className="text-sm text-slate-500">
          Evidence coverage scoring is not available for this diagnosis yet.
        </p>
      </CompactPanel>
    );
  }

  return (
    <CompactPanel title="Evidence coverage">
      <MetricGrid
        items={[
          { label: 'Coverage score', value: `${coverage.coverageScore}%` },
          {
            label: 'Readiness',
            value: `${coverage.generationReadinessScore}% ${formatLabel(
              coverage.generationReadinessTier,
            )}`,
          },
          {
            label: 'Discriminators',
            value: coverage.coverageBreakdown.discriminatorEvidenceCount,
          },
          {
            label: 'Diversity',
            value: coverage.coverageBreakdown.evidenceDiversityCount,
          },
          {
            label: 'Case coverage',
            value: `${coverage.coverageBreakdown.caseEvidenceCoverage}%`,
          },
          {
            label: 'Education coverage',
            value: `${coverage.coverageBreakdown.educationEvidenceCoverage}%`,
          },
          {
            label: 'Low-trust drafts',
            value: coverage.coverageBreakdown.lowTrustDraftCount,
          },
          {
            label: 'Blocked drafts',
            value: coverage.coverageBreakdown.blockedDraftCount,
          },
          {
            label: 'Risk signals',
            value: coverage.coverageBreakdown.hallucinationRiskDraftCount,
          },
        ]}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ReadinessIndicator
          label="Case generation"
          readiness={coverage.generationReadiness.caseGeneration}
        />
        <ReadinessIndicator
          label="Differential generation"
          readiness={coverage.generationReadiness.differentialGeneration}
        />
        <ReadinessIndicator
          label="Teaching generation"
          readiness={coverage.generationReadiness.teachingRuleGeneration}
        />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <EvidenceList
          title="Evidence gaps"
          items={coverage.missingEvidence.map((item) => item.label)}
          empty="No evidence gaps reported."
        />
        <EvidenceList
          title="Overused evidence"
          items={coverage.redundancy.overusedEvidence.map(
            (item) => `${formatLabel(item.evidenceKey)} (${item.count})`,
          )}
          empty="No overused evidence patterns reported."
        />
      </div>
      {coverage.generationHooks.suggestedGenerationPrerequisites.length ? (
        <div className="mt-4 rounded-lg border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-amber)]">
            Generation prerequisites
          </p>
          <p className="mt-2 text-sm text-amber-100">
            {coverage.generationHooks.suggestedGenerationPrerequisites.join(', ')}
          </p>
        </div>
      ) : null}
      {coverage.generationHooks.suggestedDraftValidationReview ? (
        <div className="mt-4 rounded-lg border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-amber)]">
            Draft trust review
          </p>
          <p className="mt-2 text-sm text-amber-100">
            Low-trust, blocked, or hallucination-risk generated drafts need
            senior review or regeneration before publication decisions.
          </p>
        </div>
      ) : null}
    </CompactPanel>
  );
}

function ReadinessIndicator({
  label,
  readiness,
}: {
  label: string;
  readiness: {
    score: number;
    tier: string;
    reasons: string[];
  };
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <StatusBadge
          status={`${readiness.score}% ${readiness.tier}`}
          tone={readiness.tier === 'weak' ? 'warning' : 'info'}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {readiness.reasons.slice(0, 2).join(', ') || 'Ready prerequisites met'}
      </p>
    </div>
  );
}

function EvidenceList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.slice(0, 8).map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--color-navy-border)] bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function EvidenceGraphPanel({
  diagnosisRegistryId,
  relationships,
  summary,
  access,
  client,
  onRefresh,
  showError,
  showPending,
  showSuccess,
}: {
  diagnosisRegistryId: string;
  relationships: DiagnosisEvidenceRelationship[];
  summary?: DiagnosisEditorialWorkspace['evidenceGraph']['summary'];
  access: ConsoleAccessState;
  client: ApiClient;
  onRefresh: () => Promise<void>;
  showError: (message: string) => void;
  showPending: (message: string) => void;
  showSuccess: (message: string) => void;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const grouped = useMemo(() => groupEvidenceRelationships(relationships), [relationships]);

  async function generateCandidates() {
    try {
      setBusyAction('generate-evidence');
      showPending('Generating evidence graph candidates...');
      const result = await generateEvidenceGraphCandidates(
        client,
        diagnosisRegistryId,
      );
      await onRefresh();
      showSuccess(`Generated ${result.createdCount} evidence candidates.`);
    } catch (error) {
      showError(errorMessage(error, 'Failed to generate evidence graph.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function reviewRelationship(
    id: string,
    action: EvidenceGraphReviewAction,
  ) {
    try {
      setBusyAction(`${action}:${id}`);
      showPending('Updating evidence relationship...');
      await reviewEvidenceGraphRelationship(client, id, action);
      await onRefresh();
      showSuccess('Evidence relationship updated.');
    } catch (error) {
      showError(errorMessage(error, 'Failed to update evidence relationship.'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-navy-border)] bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-navy-border)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Evidence graph</p>
          <p className="text-xs text-slate-500">
            Findings, clues, labs, imaging, and reasoning evidence linked to this diagnosis.
          </p>
        </div>
        <button
          type="button"
          onClick={generateCandidates}
          disabled={busyAction !== null}
          className="editorial-action px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate candidates
        </button>
      </div>
      <MetricGrid
        items={[
          { label: 'Evidence', value: summary?.total ?? 0 },
          { label: 'Active', value: summary?.active ?? 0 },
          { label: 'Discriminators', value: summary?.discriminatorEvidence ?? 0 },
          { label: 'Weak coverage', value: summary?.weakEvidenceCoverage ?? 0 },
        ]}
      />
      {relationships.length ? (
        <div className="space-y-4 border-t border-[var(--color-navy-border)] px-4 py-4">
          {grouped.map(([type, items]) => (
            <div key={type}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {formatLabel(type)}
              </p>
              <div className="mt-2 grid gap-2">
                {items.slice(0, 12).map((relationship) => (
                  <div
                    key={relationship.id}
                    className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {relationship.evidenceNode.displayLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatLabel(relationship.relationshipType)} · strength{' '}
                          {relationship.strength} · discriminator{' '}
                          {relationship.discriminatorWeight}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--color-navy-border)] bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {formatLabel(relationship.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {relationship.reasoningSummary || 'No reasoning summary yet.'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {relationship.supportingCase ? (
                        <Link
                          to={`/cases/${relationship.supportingCase.id}`}
                          className="font-semibold text-[var(--color-teal)] underline"
                        >
                          Open case
                        </Link>
                      ) : null}
                      {relationship.supportingTeachingRule ? (
                        <Link
                          to={`/editorial/diagnoses/${diagnosisRegistryId}?tab=teaching-rules`}
                          className="font-semibold text-[var(--color-teal)] underline"
                        >
                          Open rule
                        </Link>
                      ) : null}
                      {relationship.supportingTeachingRelationship ? (
                        <span className="text-slate-500">
                          Teaching relationship linked
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <RelationshipActionButton
                        label="Activate"
                        disabled={!access.canPublishEditorial || busyAction !== null}
                        onClick={() =>
                          reviewRelationship(relationship.id, 'activate')
                        }
                      />
                      <RelationshipActionButton
                        label="Reject"
                        disabled={!access.canPublishEditorial || busyAction !== null}
                        onClick={() => reviewRelationship(relationship.id, 'reject')}
                      />
                      <RelationshipActionButton
                        label="Deprecate"
                        disabled={!access.canPublishEditorial || busyAction !== null}
                        onClick={() =>
                          reviewRelationship(relationship.id, 'deprecate')
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t border-[var(--color-navy-border)] px-4 py-6 text-sm text-slate-500">
          No evidence relationships have been created for this diagnosis yet.
        </div>
      )}
    </section>
  );
}

function TeachingRelationshipPanel({
  diagnosisRegistryId,
  relationships,
  access,
  client,
  onRefresh,
  showError,
  showPending,
  showSuccess,
}: {
  diagnosisRegistryId: string;
  relationships: DiagnosisTeachingRelationship[];
  access: ConsoleAccessState;
  client: ApiClient;
  onRefresh: () => Promise<void>;
  showError: (message: string) => void;
  showPending: (message: string) => void;
  showSuccess: (message: string) => void;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const canReview = access.canPublishEditorial;

  async function generateCandidates() {
    try {
      setBusyAction('generate');
      showPending('Generating teaching relationship candidates...');
      const result = await generateDiagnosisTeachingRelationshipCandidates(
        client,
        diagnosisRegistryId,
      );
      await onRefresh();
      showSuccess(
        `Generated ${result.createdCount} teaching relationship candidates.`,
      );
    } catch (error) {
      showError(errorMessage(error, 'Failed to generate teaching relationships.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function reviewRelationship(
    id: string,
    action: DiagnosisTeachingRelationshipReviewAction,
  ) {
    try {
      setBusyAction(`${action}:${id}`);
      showPending('Updating teaching relationship...');
      await reviewDiagnosisTeachingRelationship(client, id, action);
      await onRefresh();
      showSuccess('Teaching relationship updated.');
    } catch (error) {
      showError(errorMessage(error, 'Failed to update teaching relationship.'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-navy-border)] bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-navy-border)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Teaching graph</p>
          <p className="text-xs text-slate-500">
            Reviewed teaching relationships layered over graph and differential evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={generateCandidates}
          disabled={busyAction !== null}
          className="editorial-action px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate candidates
        </button>
      </div>
      {relationships.length ? (
        <div className="space-y-2 p-3">
          {relationships.slice(0, 30).map((relationship) => (
            <EditorialEntity
              key={relationship.id}
              eyebrow="Reasoning relationship"
              title={`${relationship.sourceDiagnosisRegistry.displayLabel} -> ${relationship.targetDiagnosisRegistry.displayLabel}`}
              subtitle={
                relationship.discriminatorSummary ||
                relationship.commonConfusionReason ||
                relationship.learnerPitfall ||
                'No teaching summary yet.'
              }
              tone={relationship.status === 'ACTIVE' ? 'success' : 'warning'}
              state={
                <WorkflowStateInline
                  label={formatLabel(relationship.status)}
                  tone={relationship.status === 'ACTIVE' ? 'success' : 'warning'}
                />
              }
              action={
                <RelationshipActionButton
                  label="Activate"
                  disabled={!canReview || busyAction !== null}
                  onClick={() => reviewRelationship(relationship.id, 'activate')}
                />
              }
            >
              <ReasoningThread
                items={[
                  {
                    label: 'Relationship',
                    detail: `${formatLabel(
                      relationship.relationshipType,
                    )}, strength ${relationship.strength}`,
                    tone: 'info',
                  },
                  {
                    label: 'Clinical meaning',
                    detail: formatLabel(relationship.teachingPurpose),
                    tone: 'success',
                  },
                  {
                    label: 'Evidence support',
                    detail: relationshipEvidenceSummary(
                      diagnosisRegistryId,
                      relationship,
                    ),
                    tone: relationship.supportingGraphFact ||
                      relationship.supportingTeachingRule ||
                      relationship.supportingDifferentialLinkId
                      ? 'success'
                      : 'warning',
                  },
                  {
                    label: 'Learner impact',
                    detail:
                      relationship.commonConfusionReason ||
                      relationship.learnerPitfall ||
                      'No learner impact note attached.',
                    tone:
                      relationship.commonConfusionReason ||
                      relationship.learnerPitfall
                        ? 'warning'
                        : 'neutral',
                  },
                ]}
              />
              <EmbeddedActionBar note="Review actions update the same teaching relationship record.">
                <SecondaryActionDisclosure>
                  <RelationshipActionButton
                    label="Reject"
                    disabled={!canReview || busyAction !== null}
                    onClick={() => reviewRelationship(relationship.id, 'reject')}
                  />
                  <RelationshipActionButton
                    label="Deprecate"
                    disabled={!canReview || busyAction !== null}
                    onClick={() =>
                      reviewRelationship(relationship.id, 'deprecate')
                    }
                  />
                </SecondaryActionDisclosure>
              </EmbeddedActionBar>
            </EditorialEntity>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-slate-500">
          No teaching relationships have been created for this diagnosis yet.
        </div>
      )}
    </section>
  );
}

function relationshipEvidenceSummary(
  diagnosisRegistryId: string,
  relationship: DiagnosisTeachingRelationship,
) {
  if (relationship.supportingGraphFact) {
    return `Graph fact: ${formatLabel(relationship.supportingGraphFact.type)}`;
  }
  if (relationship.supportingTeachingRule) {
    return `Teaching rule: ${relationship.supportingTeachingRule.title}`;
  }
  if (relationship.supportingDifferentialLinkId) {
    return `Differential link: ${relationship.supportingDifferentialLinkId}`;
  }
  return `No linked evidence yet for ${diagnosisRegistryId}.`;
}

function ReasoningPathsPanel({
  diagnosisRegistryId,
  paths,
  access,
  client,
  onRefresh,
  onGenerateTargetedCase,
  showError,
  showPending,
  showSuccess,
}: {
  diagnosisRegistryId: string;
  paths: ReasoningPath[];
  access: ConsoleAccessState;
  client: ApiClient;
  onRefresh: () => Promise<void>;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
  showError: (message: string) => void;
  showPending: (message: string) => void;
  showSuccess: (message: string) => void;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const canReview = access.canPublishEditorial;
  const activePathGroups = groupReasoningPaths(
    paths.filter(
      (path) => path.status !== 'DEPRECATED' && path.status !== 'REJECTED',
    ),
  );
  const inactivePaths = paths.filter(
    (path) => path.status === 'DEPRECATED' || path.status === 'REJECTED',
  );

  async function generateCandidates() {
    try {
      setBusyAction('generate');
      showPending('Generating reasoning path candidates...');
      const result = await generateReasoningPathCandidates(
        client,
        diagnosisRegistryId,
      );
      await onRefresh();
      showSuccess(`Generated ${result.createdCount} reasoning path candidates.`);
    } catch (error) {
      showError(errorMessage(error, 'Failed to generate reasoning paths.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function reviewPath(id: string, action: ReasoningPathReviewAction) {
    try {
      setBusyAction(`${action}:${id}`);
      showPending('Updating reasoning path...');
      await reviewReasoningPath(client, id, action);
      await onRefresh();
      showSuccess('Reasoning path updated.');
    } catch (error) {
      showError(errorMessage(error, 'Failed to update reasoning path.'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-navy-border)] bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-navy-border)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Reasoning paths</p>
          <p className="text-xs text-slate-500">
            Constrained draft contexts grounded in reviewed relationships and evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={generateCandidates}
          disabled={busyAction !== null}
          className="editorial-action px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate paths
        </button>
      </div>
      {paths.length ? (
        <div className="space-y-4 p-4">
          {activePathGroups.map(([purpose, groupedPaths]) => (
            <div key={purpose}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {formatLabel(purpose)}
                </p>
                <span className="text-xs text-slate-500">
                  {groupedPaths.length} paths
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {groupedPaths.slice(0, 12).map((path) => (
                  <ReasoningPathCard
                    key={path.id}
                    path={path}
                    busyAction={busyAction}
                    canReview={canReview}
                    onReview={reviewPath}
                    onGenerateTargetedCase={onGenerateTargetedCase}
                  />
                ))}
              </div>
            </div>
          ))}
          {inactivePaths.length ? (
            <details className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-100">
                Deprecated and rejected paths ({inactivePaths.length})
              </summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {inactivePaths.slice(0, 12).map((path) => (
                  <ReasoningPathCard
                    key={path.id}
                    path={path}
                    busyAction={busyAction}
                    canReview={canReview}
                    onReview={reviewPath}
                    onGenerateTargetedCase={onGenerateTargetedCase}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-slate-500">
          No reasoning paths have been generated for this diagnosis yet.
        </div>
      )}
    </section>
  );
}

function ReasoningPathCard({
  path,
  busyAction,
  canReview,
  onReview,
  onGenerateTargetedCase,
}: {
  path: ReasoningPath;
  busyAction: string | null;
  canReview: boolean;
  onReview: (id: string, action: ReasoningPathReviewAction) => void;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
}) {
  return (
    <div
      className={[
        'rounded-lg border p-3',
        path.status === 'ACTIVE'
          ? 'border-[var(--color-green)]/30 bg-[var(--color-green)]/10'
          : path.status === 'CANDIDATE'
            ? 'border-[var(--color-navy-border)] bg-white/5'
            : 'border-[var(--color-navy-border)] bg-white/5 opacity-75',
      ].join(' ')}
    >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{path.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatLabel(path.reasoningGoal)} ·{' '}
                    {formatLabel(path.generationPurpose)}
                  </p>
                </div>
                <StatusBadge
                  status={`${path.readinessScore}% ${path.readinessTier}`}
                  tone={path.readinessTier === 'weak' ? 'warning' : 'info'}
                />
              </div>
              <CompactMetricGrid
                items={[
                  {
                    label: 'Differentials',
                    value: path.primaryDifferentialIds.length,
                  },
                  {
                    label: 'Teaching links',
                    value: path.supportingTeachingRelationshipIds.length,
                  },
                  {
                    label: 'Evidence links',
                    value: path.supportingEvidenceRelationshipIds.length,
                  },
                  {
                    label: 'Discriminators',
                    value: path.discriminatorEvidenceNodeIds.length,
                  },
                ]}
              />
              {path.readinessReasons?.length ? (
                <p className="mt-2 text-xs text-slate-400">
                  {path.readinessReasons.slice(0, 3).join(' · ')}
                </p>
              ) : null}
              <EvidenceList
                title="Required teaching points"
                items={path.requiredTeachingPoints}
                empty="No required teaching points attached."
              />
              <EvidenceList
                title="Forbidden shortcuts"
                items={[
                  ...path.forbiddenEvidencePatterns,
                  ...(path.reasoningQualityWarnings ?? []),
                ]}
                empty="No forbidden reasoning patterns attached."
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <StatusBadge
                  status={formatLabel(path.status)}
                  tone={path.status === 'ACTIVE' ? 'success' : 'neutral'}
                />
                <div className="flex flex-wrap gap-2">
                  <RelationshipActionButton
                    label="Activate"
                    disabled={!canReview || busyAction !== null}
                    onClick={() => onReview(path.id, 'activate')}
                  />
                  <SecondaryActionDisclosure>
                    <RelationshipActionButton
                      label="Reject"
                      disabled={!canReview || busyAction !== null}
                      onClick={() => onReview(path.id, 'reject')}
                    />
                    <RelationshipActionButton
                      label="Deprecate"
                      disabled={!canReview || busyAction !== null}
                      onClick={() => onReview(path.id, 'deprecate')}
                    />
                    <RelationshipActionButton
                      label="Draft case"
                      disabled={
                        busyAction !== null ||
                        path.generationPurpose !== 'CASE_GENERATION' ||
                        path.status !== 'ACTIVE'
                      }
                      onClick={() =>
                        onGenerateTargetedCase({
                          difficulty: 'MEDIUM',
                          teachingUnitIds: [],
                          reasoningPathId: path.id,
                          clueRevealStrategy: 'late_discriminator',
                        })
                      }
                    />
                  </SecondaryActionDisclosure>
                </div>
              </div>
    </div>
  );
}

function LinkedDifferentialsList({
  links,
}: {
  links: StructuredDifferentialLink[];
}) {
  if (!links.length) {
    return (
      <CompactPanel title="Linked differentials">
        <p className="text-sm text-slate-500">
          No resolved differential links are attached to this diagnosis yet.
        </p>
      </CompactPanel>
    );
  }

  return (
    <CompactPanel title="Linked differentials">
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <div
            key={`${link.diagnosisRegistryId}-${link.sourceText}`}
            className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-100">
                {link.displayLabel}
              </p>
              <span className="rounded-full border border-[var(--color-navy-border)] bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {formatLabel(link.role)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Source: {link.sourceText}</p>
          </div>
        ))}
      </div>
    </CompactPanel>
  );
}

function GraphCandidateList({
  candidates,
}: {
  candidates: DiagnosisGraphCandidate[];
}) {
  if (!candidates.length) {
    return (
      <CompactPanel title="Candidates">
        <p className="text-sm text-slate-500">
          No graph candidates are currently attached to this diagnosis.
        </p>
      </CompactPanel>
    );
  }

  return (
    <CompactPanel
      title="Unreviewed graph candidates"
      subtitle="Generated graph objects waiting for editorial interpretation."
    >
      <div className="grid gap-2">
        {candidates.slice(0, 20).map((candidate) => (
          <EditorialRow
            key={candidate.id}
            title={formatLabel(candidate.type)}
            subtitle={candidate.rawText}
            tone={candidate.status === 'CANDIDATE' ? 'warning' : 'neutral'}
            meta={
              <>
                <StatusBadge status={formatLabel(candidate.status)} tone="warning" />
                <StatusBadge
                  status={formatLabel(candidate.sourceType)}
                  tone="neutral"
                />
              </>
            }
          />
        ))}
      </div>
      {candidates.length > 20 ? (
        <p className="mt-3 text-sm text-slate-500">
          Showing 20 of {candidates.length} candidates.
        </p>
      ) : null}
    </CompactPanel>
  );
}
