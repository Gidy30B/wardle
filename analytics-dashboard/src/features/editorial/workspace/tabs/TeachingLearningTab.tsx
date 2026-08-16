import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRuleReviewAction,
  DiagnosisTeachingRuleWritePayload,
  DiagnosisTeachingRulesResponse,
  WorkspaceCoverageMatrixRow,
} from '../../../../api/admin';
import StatusBadge from '../../../../components/ui/StatusBadge';
import TeachingRulesCard from '../../../cases/education/TeachingRulesCard';
import { CoverageMatrixCard } from '../CoveragePanels';
import {
  CoverageStateStrip,
  DistinctionStream,
  EditorialChipRow,
  EditorialFlowDivider,
  EditorialRow,
  EditorialStream,
  EmbeddedActionBar,
  EvidenceConfidenceStrip,
  OperatorDashboard,
  OperatorMetricGrid,
  ReasoningThread,
  SecondaryActionDisclosure,
  StreamDisclosure,
  TabNextStepCard,
  WorkflowStateInline,
} from '../EditorialPrimitives';
import { coverageCompositeStatus, formatLabel } from '../workspaceTransforms';
import {
  buildEditorialWorkspaceViewModel,
  type TeachingRuleCardViewModel,
} from '../viewModels/editorialWorkspaceViewModel';

export function TeachingLearningTab({
  workspace,
  rules,
  loading,
  pendingAction,
  selectedRow,
  canReviewRules,
  reviewDisabledReason,
  onGenerateCandidates,
  onSeedLegacy,
  onCreateRule,
  onUpdateRule,
  onReviewRule,
  onRowSelect,
}: {
  workspace: DiagnosisEditorialWorkspace;
  rules: DiagnosisTeachingRulesResponse | null;
  loading: boolean;
  pendingAction: string | null;
  selectedRow: WorkspaceCoverageMatrixRow | null;
  canReviewRules: boolean;
  reviewDisabledReason: string;
  onGenerateCandidates: () => void;
  onSeedLegacy: () => void;
  onCreateRule: (payload: DiagnosisTeachingRuleWritePayload) => Promise<boolean>;
  onUpdateRule: (
    ruleId: string,
    payload: DiagnosisTeachingRuleWritePayload,
  ) => Promise<boolean>;
  onReviewRule: (
    ruleId: string,
    action: DiagnosisTeachingRuleReviewAction,
  ) => void;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
}) {
  const focusRule = workspace.teachingRules.items.find(
    (rule) => rule.status !== 'ACTIVE',
  );
  const focusDetail =
    focusRule?.title ??
    (workspace.teachingRules.summary.needsReview
      ? 'Review candidates'
      : 'Maintain active rules');
  const coverageByRule = new Map(
    workspace.coverageMatrix
      .filter((row) => row.teachingRuleId)
      .map((row) => [row.teachingRuleId as string, row]),
  );
  const visibleRules = workspace.teachingRules.items.slice(0, 12);
  const viewModel = buildEditorialWorkspaceViewModel(workspace);

  return (
    <div className="space-y-4">
      {workspace.teachingRules.items.length === 0 ? (
        <TabNextStepCard
          title="No teaching rules yet"
          description="Start by generating constrained teaching rule candidates or seeding legacy rules, then approve the rules that should drive education, cases, and graph coverage."
          actionLabel="Generate candidates"
          onAction={onGenerateCandidates}
          disabled={pendingAction !== null}
        />
      ) : null}
      <div id="teaching-rules-stream" className="scroll-mt-24" tabIndex={-1}>
        <OperatorDashboard
          eyebrow="Teaching rules"
          title="Distinction command board"
          subtitle="Active rules, weak discriminators, evidence support, and generation coverage in the compact operator shape from the mockup."
          status={
            <WorkflowStateInline
              label={`${workspace.teachingRules.summary.needsReview} needs review`}
              tone={
                workspace.teachingRules.summary.needsReview
                  ? 'warning'
                  : 'success'
              }
            />
          }
        >
          <OperatorMetricGrid
            items={[
              {
                label: 'Active rules',
                value: viewModel.teachingRulesBoard.totals.active,
                tone: viewModel.teachingRulesBoard.totals.active
                  ? 'success'
                  : 'warning',
                detail: 'Rules driving current teaching output',
              },
              {
                label: 'Weak or draft',
                value: viewModel.teachingRulesBoard.totals.weak,
                tone: viewModel.teachingRulesBoard.totals.weak ? 'warning' : 'success',
                detail: 'Needs evidence, review, or discriminator tightening',
              },
              {
                label: 'Case-linked',
                value: viewModel.teachingRulesBoard.totals.caseLinked,
                tone: viewModel.teachingRulesBoard.totals.caseLinked ? 'success' : 'warning',
                detail: 'Can influence playable case generation',
              },
              {
                label: 'Graph-linked',
                value: viewModel.teachingRulesBoard.totals.graphLinked,
                tone: viewModel.teachingRulesBoard.totals.graphLinked ? 'success' : 'warning',
                detail: 'Can support relationship graph edges',
              },
            ]}
          />
        </OperatorDashboard>
        <EditorialStream
          eyebrow="Teaching & learning"
          title="Clinical distinction stream"
          subtitle={`Focus: ${focusDetail}. Curate distinctions that drive education, cases, and differential graph coverage.`}
          action={
            <button
              type="button"
              onClick={onGenerateCandidates}
              disabled={pendingAction !== null}
              className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Generate candidates
            </button>
          }
        >
        <CoverageStateStrip
          items={[
            {
              label: 'Active',
              value: workspace.teachingRules.summary.active,
              tone: workspace.teachingRules.summary.active ? 'success' : 'warning',
            },
            {
              label: 'Needs review',
              value: workspace.teachingRules.summary.needsReview,
              tone: workspace.teachingRules.summary.needsReview
                ? 'warning'
                : 'success',
            },
            {
              label: 'Total',
              value: workspace.teachingRules.items.length,
              tone: workspace.teachingRules.items.length ? 'info' : 'warning',
            },
          ]}
        />

        <WeakRuleQueue
          rules={[
            ...viewModel.teachingRulesBoard.candidateRules,
            ...viewModel.teachingRulesBoard.weakRules,
          ]}
          coverageByRule={coverageByRule}
          canReviewRules={canReviewRules}
          reviewDisabledReason={reviewDisabledReason}
          pendingAction={pendingAction}
          onReviewRule={onReviewRule}
          onRowSelect={onRowSelect}
        />

        {visibleRules.map((rule, index) => {
          const coverage = coverageByRule.get(rule.id);
          const composite = coverage ? coverageCompositeStatus(coverage) : null;
          const primaryAction =
            rule.status === 'ACTIVE'
              ? null
              : rule.status === 'CANDIDATE'
                ? 'approve'
                : 'activate';
          const primaryLabel =
            primaryAction === 'approve' ? 'Review distinction' : 'Activate';

          return (
            <DistinctionStream
              key={rule.id}
              title={rule.title}
              learnerConfusion={summarizeJson(rule.requiredDifferentials)}
              discriminator={rule.rationale}
              action={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <WorkflowStateInline
                    label={formatLabel(rule.status)}
                    tone={rule.status === 'ACTIVE' ? 'success' : 'warning'}
                  />
                  {primaryAction ? (
                    <button
                      type="button"
                      disabled={!canReviewRules || pendingAction !== null}
                      title={!canReviewRules ? reviewDisabledReason : undefined}
                      onClick={() => onReviewRule(rule.id, primaryAction)}
                      className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {primaryLabel}
                    </button>
                  ) : null}
                </div>
              }
            >
              <EditorialChipRow
                items={[
                  { label: formatLabel(rule.importance), tone: rule.importance === 'critical' ? 'danger' : 'info' },
                  {
                    label: rule.expectedEvidence ? 'Evidence linked' : 'Evidence missing',
                    tone: rule.expectedEvidence ? 'success' : 'warning',
                  },
                  {
                    label: rule.appliesToEducation ? 'Education' : 'No education target',
                    tone: rule.appliesToEducation ? 'success' : 'neutral',
                  },
                  {
                    label: rule.appliesToCaseGeneration ? 'Cases' : 'No case target',
                    tone: rule.appliesToCaseGeneration ? 'success' : 'neutral',
                  },
                  {
                    label: rule.appliesToGraph ? 'Graph' : 'No graph target',
                    tone: rule.appliesToGraph ? 'success' : 'neutral',
                  },
                ]}
              />
              <StreamDisclosure
                title="Support and coverage"
                summary={composite?.label ?? 'Coverage context'}
              >
                <ReasoningThread
                  items={[
                    {
                      label: 'Reasoning goal',
                      detail: formatLabel(rule.category),
                      tone: 'info',
                    },
                    {
                      label: 'Discriminator',
                      detail:
                        summarizeJson(rule.expectedEvidence) ??
                        rule.rationale ??
                        'No expected evidence has been attached.',
                      tone: rule.expectedEvidence ? 'success' : 'warning',
                    },
                    {
                      label: 'Generation impact',
                      detail: [
                        rule.appliesToEducation ? 'education' : null,
                        rule.appliesToCaseGeneration ? 'case generation' : null,
                        rule.appliesToGraph ? 'graph' : null,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'No generation targets enabled.',
                      tone:
                        rule.appliesToEducation ||
                        rule.appliesToCaseGeneration ||
                        rule.appliesToGraph
                          ? 'success'
                          : 'warning',
                    },
                  ]}
                />
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <EvidenceConfidenceStrip
                    items={[
                      {
                        label: 'Importance',
                        value: formatLabel(rule.importance),
                        tone:
                          rule.importance === 'critical'
                            ? 'danger'
                            : rule.importance === 'high'
                              ? 'warning'
                              : 'info',
                      },
                      {
                        label: 'Evidence',
                        value: rule.expectedEvidence ? 'Linked' : 'Missing',
                        tone: rule.expectedEvidence ? 'success' : 'warning',
                      },
                      {
                        label: 'Pitfalls',
                        value: rule.reasoningQualityWarnings?.length ?? 0,
                        tone: rule.reasoningQualityWarnings?.length
                          ? 'warning'
                          : 'success',
                      },
                    ]}
                  />
                  <CoverageStateStrip
                    items={[
                      {
                        label: 'Education',
                        value: coverage
                          ? formatLabel(coverage.educationCoverage)
                          : 'Unknown',
                        tone:
                          coverage?.educationCoverage === 'covered'
                            ? 'success'
                            : 'warning',
                      },
                      {
                        label: 'Cases',
                        value: coverage ? formatLabel(coverage.caseCoverage) : 'Unknown',
                        tone:
                          coverage?.caseCoverage === 'covered'
                            ? 'success'
                            : 'warning',
                      },
                      {
                        label: 'Graph',
                        value: coverage ? formatLabel(coverage.graphCoverage) : 'Unknown',
                        tone:
                          coverage?.graphCoverage === 'covered'
                            ? 'success'
                            : 'warning',
                      },
                    ]}
                  />
                </div>
              </StreamDisclosure>
              <EmbeddedActionBar
                note={
                  composite
                    ? `${composite.label}: ${coverage?.recommendedAction}`
                    : 'Coverage mapping will appear once this distinction is linked to the matrix.'
                }
              >
                {coverage ? (
                  <button
                    type="button"
                    onClick={() => onRowSelect(coverage)}
                    className="editorial-action"
                  >
                    Open coverage
                  </button>
                ) : null}
                <SecondaryActionDisclosure>
                  <button
                    type="button"
                    disabled={!canReviewRules || pendingAction !== null}
                    title={!canReviewRules ? reviewDisabledReason : undefined}
                    onClick={() => onReviewRule(rule.id, 'needs_review')}
                    className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Needs review
                  </button>
                  <button
                    type="button"
                    disabled={!canReviewRules || pendingAction !== null}
                    title={!canReviewRules ? reviewDisabledReason : undefined}
                    onClick={() => onReviewRule(rule.id, 'reject')}
                    className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={!canReviewRules || pendingAction !== null}
                    title={!canReviewRules ? reviewDisabledReason : undefined}
                    onClick={() => onReviewRule(rule.id, 'deprecate')}
                    className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Deprecate
                  </button>
                </SecondaryActionDisclosure>
              </EmbeddedActionBar>
              {index < visibleRules.length - 1 ? (
                <EditorialFlowDivider label="next distinction" />
              ) : null}
            </DistinctionStream>
          );
        })}

        <StreamDisclosure
          title="Rule editor and coverage matrix"
          summary={`${workspace.coverageMatrix.length} coverage rows, full create/edit tooling preserved`}
        >
          <div
            id="teaching-coverage-matrix"
            className="scroll-mt-24 space-y-3"
            tabIndex={-1}
          >
            <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="editorial-eyebrow">Advanced rule editor</p>
                <WorkflowStateInline
                  label={`${visibleRules.length} shown`}
                  tone="info"
                />
              </div>
              <TeachingRulesCard
                rules={rules}
                loading={loading}
                error={null}
                pendingAction={pendingAction}
                onGenerateCandidates={onGenerateCandidates}
                onSeedLegacy={onSeedLegacy}
                onCreateRule={onCreateRule}
                onUpdateRule={onUpdateRule}
                onReviewRule={onReviewRule}
                canReviewRules={canReviewRules}
                reviewDisabledReason={reviewDisabledReason}
              />
            </div>
            <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="editorial-eyebrow">Coverage matrix</p>
                <WorkflowStateInline
                  label={`${workspace.coverageMatrix.length} rows`}
                  tone={workspace.coverageMatrix.length ? 'success' : 'warning'}
                />
              </div>
              <CoverageMatrixCard
                rows={workspace.coverageMatrix}
                selectedRow={selectedRow}
                onRowSelect={onRowSelect}
              />
            </div>
          </div>
        </StreamDisclosure>
        </EditorialStream>
      </div>
    </div>
  );
}

function WeakRuleQueue({
  rules,
  coverageByRule,
  canReviewRules,
  reviewDisabledReason,
  pendingAction,
  onReviewRule,
  onRowSelect,
}: {
  rules: TeachingRuleCardViewModel[];
  coverageByRule: Map<string, WorkspaceCoverageMatrixRow>;
  canReviewRules: boolean;
  reviewDisabledReason: string;
  pendingAction: string | null;
  onReviewRule: (
    ruleId: string,
    action: DiagnosisTeachingRuleReviewAction,
  ) => void;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
}) {
  if (!rules.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--color-amber)]/25 bg-[var(--color-amber)]/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="editorial-eyebrow text-[var(--color-amber)]">
            Editorial queue
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            Weak or candidate distinctions
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Tighten these before relying on the rule set for education, cases,
            or graph support.
          </p>
        </div>
        <StatusBadge status={`${rules.length} queued`} tone="warning" />
      </div>
      <div className="mt-3 grid gap-2">
        {rules.slice(0, 5).map((rule) => {
          const coverage = coverageByRule.get(rule.id);
          return (
            <EditorialRow
              key={rule.id}
              title={rule.title}
              subtitle={
                rule.reason ||
                'Needs evidence or review before becoming an active teaching distinction.'
              }
              tone={rule.raw.status === 'ACTIVE' ? 'warning' : 'danger'}
              meta={
                <StatusBadge
                  status={rule.state}
                  tone={rule.raw.status === 'ACTIVE' ? 'warning' : 'danger'}
                />
              }
              action={
                <div className="flex flex-wrap gap-2">
                  {coverage ? (
                    <button
                      type="button"
                      onClick={() => onRowSelect(coverage)}
                      className="editorial-action px-2 py-1 text-xs"
                    >
                      Coverage
                    </button>
                  ) : null}
                  {rule.raw.status !== 'ACTIVE' ? (
                    <button
                      type="button"
                      disabled={!canReviewRules || pendingAction !== null}
                      title={!canReviewRules ? reviewDisabledReason : undefined}
                      onClick={() =>
                        onReviewRule(
                          rule.id,
                          rule.raw.status === 'CANDIDATE' ? 'approve' : 'activate',
                        )
                      }
                      className="editorial-action editorial-action-primary px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Promote
                    </button>
                  ) : null}
                </div>
              }
            >
              <EditorialChipRow
                items={[
                  {
                    label: rule.evidenceCount
                      ? 'Evidence linked'
                      : 'Evidence missing',
                    tone: rule.evidenceCount ? 'success' : 'warning',
                  },
                  {
                    label: `${rule.linkedCases} linked cases`,
                    tone: rule.linkedCases ? 'success' : 'neutral',
                  },
                  {
                    label: `${rule.graphEdges} graph edges`,
                    tone: rule.graphEdges ? 'success' : 'neutral',
                  },
                ]}
              />
            </EditorialRow>
          );
        })}
      </div>
    </div>
  );
}

function summarizeJson(value: unknown) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? item
          : item && typeof item === 'object' && 'label' in item
            ? String((item as { label: unknown }).label)
            : null,
      )
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
  }
  if (typeof value === 'object' && 'summary' in value) {
    return String((value as { summary: unknown }).summary);
  }
  return null;
}
