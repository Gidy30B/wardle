import { Link } from 'react-router-dom';

import type {
  CaseEscalationAnnotationPayload,
  CaseEscalationCoverageRow,
  CaseLearningGoalCoveragePayload,
  CaseLearningGoalCoverageRow,
  DiagnosisEditorialWorkspace,
  DiagnosisGraphCandidate,
  GenerateTargetedCasePayload,
  GenerateTargetedCaseResult,
  TeachingUnitCoverageMap,
  WorkspaceCoverageGap,
} from '../../../../api/admin';
import StatusBadge from '../../../../components/ui/StatusBadge';
import TargetedCaseGenerationCard from '../../../cases/education/TargetedCaseGenerationCard';
import { CoverageGapsCard } from '../CoveragePanels';
import {
  CollapsibleDetail,
  CompactMetricGrid,
  CompactPanel,
  DraftAIActionsPanel,
  EditorialRow,
  EmptyGuidance,
  ExplainabilityMetric,
  ReasoningCard,
  TabNextStepCard,
} from '../EditorialPrimitives';
import {
  aggregateCaseDimensions,
  caseTone,
  formatLabel,
  groupCaseLearningGoalCoverage,
  scoreTone,
} from '../workspaceTransforms';
export function CasesTab({
  workspace,
  coverage,
  mimicCandidates,
  pendingAction,
  generatedTargetedCase,
  onGapSelect,
  onGenerateTargetedCase,
  onCreateLearningGoalCoverage,
  onCreateEscalationAnnotation,
  onUpdateLearningGoalCoverage,
  onDeleteLearningGoalCoverage,
  onUpdateEscalationAnnotation,
  onDeleteEscalationAnnotation,
}: {
  workspace: DiagnosisEditorialWorkspace;
  coverage: TeachingUnitCoverageMap | null;
  mimicCandidates: DiagnosisGraphCandidate[];
  pendingAction: string | null;
  generatedTargetedCase: GenerateTargetedCaseResult['generatedCase'] | null;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
  onCreateLearningGoalCoverage: (
    payload: CaseLearningGoalCoveragePayload,
  ) => void;
  onCreateEscalationAnnotation: (
    payload: CaseEscalationAnnotationPayload,
  ) => void;
  onUpdateLearningGoalCoverage: (
    coverageId: string,
    payload: CaseLearningGoalCoveragePayload,
  ) => void;
  onDeleteLearningGoalCoverage: (coverageId: string) => void;
  onUpdateEscalationAnnotation: (
    annotationId: string,
    payload: CaseEscalationAnnotationPayload,
  ) => void;
  onDeleteEscalationAnnotation: (annotationId: string) => void;
}) {
  const caseGaps = workspace.coverageGaps.filter((gap) => gap.missingCases);

  return (
    <div className="space-y-4">
      {workspace.cases.summary.total === 0 ? (
        <TabNextStepCard
          title="No cases cover this diagnosis"
          description="Use the case coverage gaps below to generate a targeted case tied to weak teaching rules or required mimics."
        />
      ) : null}
      <ReasoningCard
        eyebrow="Case inventory"
        title="Assessment coverage"
        subtitle="Usable cases should exercise the learning goal, mimic, clue pattern, and escalation coverage expected by the brief."
        tone={workspace.cases.summary.blockerCount ? 'danger' : workspace.cases.summary.warningCount ? 'warning' : 'success'}
      >
        <CompactMetricGrid
          items={[
            { label: 'Total', value: workspace.cases.summary.total },
            {
              label: 'Usable',
              value: workspace.cases.summary.usable,
              tone: workspace.cases.summary.usable ? 'success' : 'warning',
            },
            {
              label: 'Warnings',
              value: workspace.cases.summary.warningCount,
              tone: workspace.cases.summary.warningCount ? 'warning' : 'success',
            },
            {
              label: 'Blockers',
              value: workspace.cases.summary.blockerCount,
              tone: workspace.cases.summary.blockerCount ? 'danger' : 'success',
            },
          ]}
        />
        {workspace.cases.summary.latest ? (
          <Link
            to={`/cases/${workspace.cases.summary.latest.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-[var(--color-teal)] underline"
          >
            Open latest case
          </Link>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No cases are attached to this diagnosis yet.
          </p>
        )}
      </ReasoningCard>
      <CaseCoverageExplainabilityCard
        workspace={workspace}
        caseGaps={caseGaps}
        pendingAction={pendingAction}
        onGenerateTargetedCase={onGenerateTargetedCase}
        onCreateLearningGoalCoverage={onCreateLearningGoalCoverage}
        onCreateEscalationAnnotation={onCreateEscalationAnnotation}
        onUpdateLearningGoalCoverage={onUpdateLearningGoalCoverage}
        onDeleteLearningGoalCoverage={onDeleteLearningGoalCoverage}
        onUpdateEscalationAnnotation={onUpdateEscalationAnnotation}
        onDeleteEscalationAnnotation={onDeleteEscalationAnnotation}
      />
      <CollapsibleDetail
        title="Cases by coverage contribution"
        summary={`${workspace.cases.items.length} case${workspace.cases.items.length === 1 ? '' : 's'} in inventory`}
      >
        <CaseContributionCard workspace={workspace} />
      </CollapsibleDetail>
      {caseGaps.length ? (
        <CollapsibleDetail
          title="Case coverage gaps"
          summary={`${caseGaps.length} gap${caseGaps.length === 1 ? '' : 's'} available for targeted generation`}
        >
          <CoverageGapsCard gaps={caseGaps} onGapSelect={onGapSelect} />
        </CollapsibleDetail>
      ) : null}
      <TargetedCaseGenerationCard
        coverage={coverage}
        mimicCandidates={mimicCandidates}
        disabled={pendingAction !== null}
        pending={pendingAction === 'targeted-case'}
        generatedCase={generatedTargetedCase}
        onGenerate={onGenerateTargetedCase}
      />
    </div>
  );
}

function CaseContributionCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const cases = workspace.cases.items;

  return (
    <CompactPanel title="Cases by coverage contribution">
      {cases.length ? (
        <div className="space-y-2">
          {cases.slice(0, 12).map((caseItem) => (
            <Link
              key={caseItem.id}
              to={`/cases/${caseItem.id}`}
              className="block"
            >
              <EditorialRow
                title={caseItem.title}
                subtitle={`${formatLabel(caseItem.difficulty)} difficulty`}
                tone={caseTone(caseItem)}
                meta={
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      status={caseItem.editorialStatus ?? 'unknown'}
                      tone={caseTone(caseItem)}
                    />
                    <StatusBadge
                      status={
                        caseItem.qualityProjection.sourceSummary.hasTeachingAlignment
                          ? 'Aligned'
                          : 'Unmapped'
                      }
                      tone={
                        caseItem.qualityProjection.sourceSummary.hasTeachingAlignment
                          ? 'success'
                          : 'neutral'
                      }
                    />
                  </div>
                }
                action={
                  <StatusBadge
                    status={`W ${caseItem.qualityProjection.warnings.length} / B ${caseItem.qualityProjection.blockers.length}`}
                    tone={
                      caseItem.qualityProjection.blockers.length
                        ? 'danger'
                        : caseItem.qualityProjection.warnings.length
                          ? 'warning'
                          : 'success'
                    }
                  />
                }
              />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyGuidance
          title="No cases in inventory"
          description="Generate a targeted case from a coverage gap or uncovered learning goal."
        />
      )}
    </CompactPanel>
  );
}

function CaseCoverageExplainabilityCard({
  workspace,
  caseGaps,
  pendingAction,
  onGenerateTargetedCase,
  onCreateLearningGoalCoverage,
  onCreateEscalationAnnotation,
  onUpdateLearningGoalCoverage,
  onDeleteLearningGoalCoverage,
  onUpdateEscalationAnnotation,
  onDeleteEscalationAnnotation,
}: {
  workspace: DiagnosisEditorialWorkspace;
  caseGaps: WorkspaceCoverageGap[];
  pendingAction: string | null;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
  onCreateLearningGoalCoverage: (
    payload: CaseLearningGoalCoveragePayload,
  ) => void;
  onCreateEscalationAnnotation: (
    payload: CaseEscalationAnnotationPayload,
  ) => void;
  onUpdateLearningGoalCoverage: (
    coverageId: string,
    payload: CaseLearningGoalCoveragePayload,
  ) => void;
  onDeleteLearningGoalCoverage: (coverageId: string) => void;
  onUpdateEscalationAnnotation: (
    annotationId: string,
    payload: CaseEscalationAnnotationPayload,
  ) => void;
  onDeleteEscalationAnnotation: (annotationId: string) => void;
}) {
  const dimensions = aggregateCaseDimensions(workspace);
  const learningGoalCoverage = workspace.learningGoalCoverage ?? [];
  const caseLearningGoalCoverage = workspace.caseLearningGoalCoverage ?? [];
  const escalationCoverage = workspace.escalationCoverage;
  const caseEscalationCoverage = workspace.caseEscalationCoverage ?? [];
  const escalationType = workspace.escalationCoverage?.escalationType ?? null;
  const coveredGoals = learningGoalCoverage.filter(
    (goal) => goal.coveredByCaseIds.length > 0,
  ).length;
  const mimicRelationships = workspace.graph.teachingRelationships.filter(
    (relationship) =>
      relationship.relationshipType === 'MIMIC_CONFUSION' &&
      relationship.status === 'ACTIVE',
  ).length;
  const generationTargets = [
    ...learningGoalCoverage.filter(
      (goal) =>
        goal.generationPriority === 'high' || goal.coveredByCaseIds.length === 0,
    ),
  ];
  const firstCase = workspace.cases.items[0] ?? null;

  return (
    <CompactPanel title="Case coverage explainability">
      <div className="grid gap-3 lg:grid-cols-2">
        <ExplainabilityMetric
          label="Learning-goal coverage"
          value={
            learningGoalCoverage.length
              ? `${coveredGoals}/${learningGoalCoverage.length}`
              : 'No goals'
          }
          detail={
            learningGoalCoverage[0]?.learningGoal ??
            'No explicit learning goals are available in the editorial brief.'
          }
          tone={
            learningGoalCoverage.length && coveredGoals === learningGoalCoverage.length
              ? 'success'
              : 'warning'
          }
        />
        <ExplainabilityMetric
          label="Mimic coverage"
          value={`${mimicRelationships} active`}
          detail={`Case mimic persistence has ${dimensions.mimicPersistence.blockers} blockers and ${dimensions.mimicPersistence.warnings} warnings.`}
          tone={dimensions.mimicPersistence.blockers ? 'danger' : 'warning'}
        />
        <ExplainabilityMetric
          label="Escalation coverage"
          value={escalationCoverage?.coversEscalation ? 'Covered' : 'Missing'}
          detail={
            escalationCoverage?.escalationType ??
            'No active escalation teaching/evidence path is fully covered by cases.'
          }
          tone={escalationCoverage?.coversEscalation ? 'success' : 'warning'}
        />
        <ExplainabilityMetric
          label="Teaching alignment"
          value={`${dimensions.teachingAlignment.good}/${workspace.cases.items.length}`}
          detail="Derived from case quality projection teachingAlignment dimensions."
          tone={dimensions.teachingAlignment.blockers ? 'danger' : 'success'}
        />
      </div>
      {caseLearningGoalCoverage.length ? (
        <CollapsibleDetail
          title="Learning-goal coverage annotations"
          summary={`${caseLearningGoalCoverage.length} persisted annotation${caseLearningGoalCoverage.length === 1 ? '' : 's'}`}
        >
          <div className="overflow-x-auto rounded-lg border border-[var(--color-navy-border)]">
            <table className="min-w-full divide-y divide-[var(--color-navy-border)] text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Goal</th>
                  <th className="px-3 py-2 text-left">Cases</th>
                  <th className="px-3 py-2 text-left">Missing</th>
                  <th className="px-3 py-2 text-left">Strength</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-navy-border)]">
                {groupCaseLearningGoalCoverage(caseLearningGoalCoverage)
                  .slice(0, 8)
                  .map((goal) => (
                    <tr key={goal.learningGoalId}>
                      <td className="px-3 py-2 text-slate-100">
                        {goal.learningGoal}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {goal.caseTitles.join(', ') || 'None'}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {[
                          ...goal.missingDiscriminators,
                          ...goal.missingMimics,
                        ].join(', ') || 'None'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          status={`${goal.coverageStrength}%`}
                          tone={scoreTone(goal.coverageStrength / 100)}
                        />
                        <CoverageAnnotationActions
                          row={goal.row}
                          pendingAction={pendingAction}
                          onUpdate={onUpdateLearningGoalCoverage}
                          onDelete={onDeleteLearningGoalCoverage}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CollapsibleDetail>
      ) : null}
      {!caseLearningGoalCoverage.length && firstCase && learningGoalCoverage[0] ? (
        <div className="mt-3 rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Add first persisted goal coverage
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Mark {firstCase.title} as covering{' '}
            {learningGoalCoverage[0].learningGoal}.
          </p>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() =>
              onCreateLearningGoalCoverage({
                caseId: firstCase.id,
                learningGoalId: learningGoalCoverage[0].learningGoalId,
                learningGoal: learningGoalCoverage[0].learningGoal,
                coverageStrength: 70,
                missingDiscriminators:
                  learningGoalCoverage[0].uncoveredDiscriminators,
                missingMimics: learningGoalCoverage[0].missingMimics,
              })
            }
            className="editorial-action editorial-action-primary mt-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Mark goal covered
          </button>
        </div>
      ) : null}
      {caseEscalationCoverage.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {caseEscalationCoverage.slice(0, 6).map((item) => (
            <EscalationAnnotationPill
              key={`${item.caseId}-${item.escalationType}`}
              item={item}
              pendingAction={pendingAction}
              onUpdate={onUpdateEscalationAnnotation}
              onDelete={onDeleteEscalationAnnotation}
            />
          ))}
        </div>
      ) : firstCase && escalationType ? (
        <div className="mt-3 rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Add explicit escalation coverage
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Mark {firstCase.title} as explicitly covering escalation risk.
          </p>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() =>
              onCreateEscalationAnnotation({
                caseId: firstCase.id,
                escalationType,
                covered: true,
                evidenceStrength: 70,
                reasoningPathId:
                  workspace.escalationCoverage?.escalationReasoningPathId ??
                  null,
                notes: 'Editor-marked explicit escalation coverage.',
              })
            }
            className="editorial-action editorial-action-primary mt-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Mark escalation covered
          </button>
        </div>
      ) : firstCase ? (
        <div className="mt-3 rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
          <p className="text-sm font-semibold text-slate-100">
            No escalation target available
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Add or approve an escalation teaching/evidence path before creating
            an explicit case escalation annotation.
          </p>
        </div>
      ) : null}
      <DraftAIActionsPanel
        actions={(generationTargets.length
          ? generationTargets.slice(0, 4).map((goal) => ({
              id: `goal-gap-${goal.learningGoalId}`,
              label: 'Generate case from uncovered goal',
              detail: goal.learningGoal,
              disabled: pendingAction !== null,
              onAction: () =>
                onGenerateTargetedCase({
                  difficulty: 'MEDIUM',
                  teachingUnitIds: [goal.learningGoalId],
                  mimicDiagnosisIds: goal.missingMimics.filter(
                    (item) => item !== 'escalation_coverage',
                  ),
                  clueRevealStrategy: 'late_discriminator',
                }),
            }))
          : caseGaps.slice(0, 4).map((gap, index) => ({
              id: `case-gap-${gap.teachingRuleId ?? gap.title}-${index}`,
              label: 'Generate case for coverage gap',
              detail: gap.recommendedAction,
              disabled: pendingAction !== null,
              onAction: () =>
                onGenerateTargetedCase({
                  difficulty: 'MEDIUM',
                  teachingUnitIds: [gap.teachingRuleId ?? gap.title],
                  clueRevealStrategy: 'late_discriminator',
                }),
            })))}
        empty="No case-specific coverage gaps are currently reported."
      />
    </CompactPanel>
  );
}

function CoverageAnnotationActions({
  row,
  pendingAction,
  onUpdate,
  onDelete,
}: {
  row: CaseLearningGoalCoverageRow | undefined;
  pendingAction: string | null;
  onUpdate: (
    coverageId: string,
    payload: CaseLearningGoalCoveragePayload,
  ) => void;
  onDelete: (coverageId: string) => void;
}) {
  if (!row?.id) {
    return null;
  }

  const nextStrength = Math.min(100, Math.max(row.coverageStrength + 10, 70));

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pendingAction !== null}
        onClick={() =>
          onUpdate(row.id!, {
            caseId: row.caseId,
            learningGoalId: row.learningGoalId,
            learningGoal: row.learningGoal,
            coverageStrength: nextStrength,
            coveredDiscriminators: row.coveredDiscriminators,
            missingDiscriminators: row.missingDiscriminators,
            coveredMimics: row.coveredMimics,
            missingMimics: row.missingMimics,
            evidenceSource: row.evidenceSource,
          })
        }
        className="editorial-action px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        Strengthen
      </button>
      <button
        type="button"
        disabled={pendingAction !== null}
        onClick={() => onDelete(row.id!)}
        className="editorial-action px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        Remove
      </button>
    </div>
  );
}

function EscalationAnnotationPill({
  item,
  pendingAction,
  onUpdate,
  onDelete,
}: {
  item: CaseEscalationCoverageRow;
  pendingAction: string | null;
  onUpdate: (
    annotationId: string,
    payload: CaseEscalationAnnotationPayload,
  ) => void;
  onDelete: (annotationId: string) => void;
}) {
  const explicit = item.coverageSource === 'explicit';
  const status =
    explicit ? (item.covered ? 'explicit' : 'needs review') : 'inferred';
  const tone =
    explicit && item.covered ? 'success' : item.coverageSource === 'inferred' ? 'info' : 'warning';

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--color-navy-border)] bg-white/5 px-2 py-1">
      <StatusBadge
        status={`${formatLabel(item.escalationType)}: ${status}`}
        tone={tone}
      />
      {item.id ? (
        <>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() =>
              onUpdate(item.id!, {
                caseId: item.caseId,
                escalationType: item.escalationType,
                covered: !item.covered,
                evidenceStrength: item.evidenceStrength,
                reasoningPathId: item.reasoningPathId,
                notes: item.notes,
              })
            }
            className="text-xs font-semibold text-[var(--color-teal)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Toggle
          </button>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => onDelete(item.id!)}
            className="text-xs font-semibold text-[var(--color-rose)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        </>
      ) : null}
    </div>
  );
}
