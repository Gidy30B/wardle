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
  type GenerateTargetedCasePayload,
  type ReasoningPath,
  type ReasoningPathReviewAction,
  type StructuredDifferentialLink,
  type WorkspaceCoverageMatrixRow,
} from '../../../../api/admin';
import type { ApiClient } from '../../../../api/client';
import StatusBadge from '../../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import type { ConsoleAccessState } from '../../../../hooks/useConsoleAccess';
import { CoverageMatrixCard } from '../CoveragePanels';
import {
  CompactPanel,
  DraftAIActionsPanel,
  ExplainabilityMetric,
  MetricGrid,
  RelationshipActionButton,
  TabNextStepCard,
} from '../EditorialPrimitives';
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
  showError: (message: string) => void;
  showPending: (message: string) => void;
  showSuccess: (message: string) => void;
}) {
  const [graphDraftAction, setGraphDraftAction] = useState<string | null>(null);

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
      <CompactPanel title="Graph readiness">
        <MetricGrid
          items={[
            { label: 'Status', value: formatLabel(workspace.graph.readiness) },
            { label: 'Facts', value: workspace.graph.factCount },
            { label: 'Candidates', value: workspace.graph.candidateCount },
            { label: 'Reviewable', value: workspace.graph.reviewableCandidateCount },
          ]}
        />
        <Link
          to="/diagnosis-graph/candidates"
          className="mt-3 inline-flex text-sm font-semibold text-slate-900 underline"
        >
          Open graph candidate queue
        </Link>
      </CompactPanel>
      <DifferentialMapExplainabilityCard
        workspace={workspace}
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
            () => strengthenDifferentialDraft(client, workspace.diagnosis.id),
          )
        }
        onGenerateTargetedCase={onGenerateTargetedCase}
      />
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
      <EvidenceCoveragePanel coverage={workspace.evidenceCoverage} />
      <CoverageMatrixCard
        rows={workspace.coverageMatrix.filter(
          (row) => row.graphCoverage !== 'covered',
        )}
        selectedRow={selectedRow}
        onRowSelect={onRowSelect}
      />
      <LinkedDifferentialsList links={workspace.linkedDifferentials ?? []} />
      <GraphCandidateList candidates={workspace.graph.candidates} />
    </div>
  );
}

function DifferentialMapExplainabilityCard({
  workspace,
  pendingAction,
  onSuggestTeachingDistinction,
  onStrengthenDifferential,
  onGenerateTargetedCase,
}: {
  workspace: DiagnosisEditorialWorkspace;
  pendingAction: string | null;
  onSuggestTeachingDistinction: () => void;
  onStrengthenDifferential: () => void;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
}) {
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

  return (
    <CompactPanel
      title="Differential map"
      subtitle="Lightweight relationship view for mimic, discriminator, escalation, and case support."
    >
      <RelationshipStrip nodes={relationshipNodes} />
      <SignalLegend />
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
    </CompactPanel>
  );
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
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Generation prerequisites
          </p>
          <p className="mt-2 text-sm text-amber-900">
            {coverage.generationHooks.suggestedGenerationPrerequisites.join(', ')}
          </p>
        </div>
      ) : null}
      {coverage.generationHooks.suggestedDraftValidationReview ? (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
            Draft trust review
          </p>
          <p className="mt-2 text-sm text-orange-900">
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <StatusBadge
          status={`${readiness.score}% ${readiness.tier}`}
          tone={readiness.tier === 'weak' ? 'warning' : 'info'}
        />
      </div>
      <p className="mt-2 text-xs text-slate-600">
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.slice(0, 8).map((item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Evidence graph</p>
          <p className="text-xs text-slate-500">
            Findings, clues, labs, imaging, and reasoning evidence linked to this diagnosis.
          </p>
        </div>
        <button
          type="button"
          onClick={generateCandidates}
          disabled={busyAction !== null}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="space-y-4 border-t border-slate-200 px-4 py-4">
          {grouped.map(([type, items]) => (
            <div key={type}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {formatLabel(type)}
              </p>
              <div className="mt-2 grid gap-2">
                {items.slice(0, 12).map((relationship) => (
                  <div
                    key={relationship.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {relationship.evidenceNode.displayLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {formatLabel(relationship.relationshipType)} · strength{' '}
                          {relationship.strength} · discriminator{' '}
                          {relationship.discriminatorWeight}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {formatLabel(relationship.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {relationship.reasoningSummary || 'No reasoning summary yet.'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {relationship.supportingCase ? (
                        <Link
                          to={`/cases/${relationship.supportingCase.id}`}
                          className="font-semibold text-slate-800 underline"
                        >
                          Open case
                        </Link>
                      ) : null}
                      {relationship.supportingTeachingRule ? (
                        <Link
                          to={`/editorial/diagnoses/${diagnosisRegistryId}?tab=teaching-rules`}
                          className="font-semibold text-slate-800 underline"
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
        <div className="border-t border-slate-200 px-4 py-6 text-sm text-slate-500">
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Teaching graph</p>
          <p className="text-xs text-slate-500">
            Reviewed teaching relationships layered over graph and differential evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={generateCandidates}
          disabled={busyAction !== null}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate candidates
        </button>
      </div>
      {relationships.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Relationship</th>
                <th className="px-4 py-3">Teaching intent</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relationships.slice(0, 30).map((relationship) => (
                <tr key={relationship.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {relationship.sourceDiagnosisRegistry.displayLabel}{' '}
                      {'->'}{' '}
                      <Link
                        to={`/editorial/diagnoses/${relationship.targetDiagnosisRegistryId}`}
                        className="underline"
                      >
                        {relationship.targetDiagnosisRegistry.displayLabel}
                      </Link>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatLabel(relationship.relationshipType)} · strength{' '}
                      {relationship.strength}
                    </p>
                  </td>
                  <td className="max-w-md px-4 py-3 text-slate-700">
                    <p className="font-medium">
                      {formatLabel(relationship.teachingPurpose)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {relationship.discriminatorSummary ||
                        relationship.commonConfusionReason ||
                        relationship.learnerPitfall ||
                        'No teaching summary yet.'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {relationship.supportingGraphFact ? (
                      <span>
                        Graph: {formatLabel(relationship.supportingGraphFact.type)}
                      </span>
                    ) : relationship.supportingTeachingRule ? (
                      <span>
                        Rule:{' '}
                        <Link
                          to={`/editorial/diagnoses/${diagnosisRegistryId}?tab=teaching-rules`}
                          className="underline"
                        >
                          {relationship.supportingTeachingRule.title}
                        </Link>
                      </span>
                    ) : relationship.supportingDifferentialLinkId ? (
                      <span>{relationship.supportingDifferentialLinkId}</span>
                    ) : (
                      <span>No linked evidence</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatLabel(relationship.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <RelationshipActionButton
                        label="Activate"
                        disabled={!canReview || busyAction !== null}
                        onClick={() =>
                          reviewRelationship(relationship.id, 'activate')
                        }
                      />
                      <RelationshipActionButton
                        label="Reject"
                        disabled={!canReview || busyAction !== null}
                        onClick={() =>
                          reviewRelationship(relationship.id, 'reject')
                        }
                      />
                      <RelationshipActionButton
                        label="Deprecate"
                        disabled={!canReview || busyAction !== null}
                        onClick={() =>
                          reviewRelationship(relationship.id, 'deprecate')
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-slate-500">
          No teaching relationships have been created for this diagnosis yet.
        </div>
      )}
    </section>
  );
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Reasoning paths</p>
          <p className="text-xs text-slate-500">
            Constrained draft contexts grounded in reviewed relationships and evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={generateCandidates}
          disabled={busyAction !== null}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
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
          ? 'border-emerald-200 bg-emerald-50'
          : path.status === 'CANDIDATE'
            ? 'border-slate-200 bg-slate-50'
            : 'border-slate-200 bg-white opacity-75',
      ].join(' ')}
    >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{path.title}</p>
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
              <MetricGrid
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
                <p className="mt-2 text-xs text-slate-600">
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
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {link.displayLabel}
              </p>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {formatLabel(link.role)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">Source: {link.sourceText}</p>
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Candidates</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Text</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.slice(0, 20).map((candidate) => (
              <tr key={candidate.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {formatLabel(candidate.type)}
                </td>
                <td className="max-w-lg px-4 py-3 text-slate-700">
                  {candidate.rawText}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatLabel(candidate.status)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatLabel(candidate.sourceType)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {candidates.length > 20 ? (
        <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          Showing 20 of {candidates.length} candidates.
        </p>
      ) : null}
    </section>
  );
}
