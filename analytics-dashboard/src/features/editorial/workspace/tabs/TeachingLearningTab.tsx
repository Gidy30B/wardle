import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRuleReviewAction,
  DiagnosisTeachingRuleWritePayload,
  DiagnosisTeachingRulesResponse,
  WorkspaceCoverageMatrixRow,
} from '../../../../api/admin';
import TeachingRulesCard from '../../../cases/education/TeachingRulesCard';
import { CoverageMatrixCard } from '../CoveragePanels';
import {
  CoverageStateStrip,
  DistinctionStream,
  EditorialFlowDivider,
  EditorialStream,
  EmbeddedActionBar,
  EvidenceConfidenceStrip,
  ReasoningThread,
  SecondaryActionDisclosure,
  StreamDisclosure,
  TabNextStepCard,
  WorkflowStateInline,
} from '../EditorialPrimitives';
import { coverageCompositeStatus, formatLabel } from '../workspaceTransforms';

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
      .map((row) => [row.teachingRuleId, row]),
  );
  const visibleRules = workspace.teachingRules.items.slice(0, 12);

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
                primaryAction ? (
                  <button
                    type="button"
                    disabled={!canReviewRules || pendingAction !== null}
                    title={!canReviewRules ? reviewDisabledReason : undefined}
                    onClick={() => onReviewRule(rule.id, primaryAction)}
                    className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {primaryLabel}
                  </button>
                ) : (
                  <WorkflowStateInline label="Active" tone="success" />
                )
              }
            >
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
          <div className="space-y-3">
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
            <CoverageMatrixCard
              rows={workspace.coverageMatrix}
              selectedRow={selectedRow}
              onRowSelect={onRowSelect}
            />
          </div>
        </StreamDisclosure>
      </EditorialStream>
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
