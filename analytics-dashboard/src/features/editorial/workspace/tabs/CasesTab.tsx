import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';

import type {
  CaseClueProgressionAnalysis,
  CaseClueDiscriminatorAnnotation,
  CaseEscalationAnnotationPayload,
  CaseEscalationCoverageRow,
  CaseDifferentialElimination,
  CaseLearningGoalCoveragePayload,
  CaseLearningGoalCoverageRow,
  CreateCaseClueDiscriminatorAnnotationPayload,
  DiagnosisEditorialWorkspace,
  DiagnosisGraphCandidate,
  AiDraftDecisionAction,
  DiscriminatorDraftReview,
  GenerateClueRevisionProposalPayload,
  GenerateTargetedDiscriminatorCasePayload,
  GenerateTargetedCasePayload,
  GenerateTargetedCaseResult,
  TargetedDiscriminatorGenerationRequest,
  TeachingUnitCoverageMap,
  UpdateCaseClueDiscriminatorAnnotationPayload,
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
  EditorialEntity,
  EditorialRow,
  EditorialStream,
  EmptyGuidance,
  ExplainabilityMetric,
  InlineReviewBar,
  SecondaryActionDisclosure,
  StreamDisclosure,
  TabNextStepCard,
} from '../EditorialPrimitives';
import {
  DiscriminatorReveal,
  EditorialNarrativeThread,
  LearnerFailureProjection,
  MimicStateIndicator,
  NarrativeCheckpoint,
  NarrativeStream,
  ReasoningTransition,
} from '../EditorialNarrativePrimitives';
import { mimicStateTone } from '../../../../components/ui/statusBadgeMeta';
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
  onGenerateDiscriminatorCase,
  onGenerateClueRevision,
  onAiDraftDecision,
  onCreateLearningGoalCoverage,
  onCreateEscalationAnnotation,
  onUpdateLearningGoalCoverage,
  onDeleteLearningGoalCoverage,
  onUpdateEscalationAnnotation,
  onDeleteEscalationAnnotation,
  onCreateDiscriminatorAnnotation,
  onUpdateDiscriminatorAnnotation,
  onDeleteDiscriminatorAnnotation,
}: {
  workspace: DiagnosisEditorialWorkspace;
  coverage: TeachingUnitCoverageMap | null;
  mimicCandidates: DiagnosisGraphCandidate[];
  pendingAction: string | null;
  generatedTargetedCase: GenerateTargetedCaseResult['generatedCase'] | null;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
  onGenerateDiscriminatorCase: (
    payload: GenerateTargetedDiscriminatorCasePayload,
  ) => void;
  onGenerateClueRevision: (payload: GenerateClueRevisionProposalPayload) => void;
  onAiDraftDecision: (
    auditId: string,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
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
  onCreateDiscriminatorAnnotation: (
    caseId: string,
    payload: CreateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onUpdateDiscriminatorAnnotation: (
    caseId: string,
    annotationId: string,
    payload: UpdateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onDeleteDiscriminatorAnnotation: (
    caseId: string,
    annotationId: string,
  ) => void;
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
      <EditorialStream
        eyebrow="Cases"
        title="Coverage orchestration"
        subtitle="Use each case to cover a learning goal, mimic/discriminator, escalation risk, and learner gap."
      >
        <CaseInventoryEntity workspace={workspace} />
        <CaseContributionCard workspace={workspace} />
        <ClueProgressionTimelineCard
          workspace={workspace}
          pendingAction={pendingAction}
          onCreateDiscriminatorAnnotation={onCreateDiscriminatorAnnotation}
          onUpdateDiscriminatorAnnotation={onUpdateDiscriminatorAnnotation}
          onDeleteDiscriminatorAnnotation={onDeleteDiscriminatorAnnotation}
          onGenerateDiscriminatorCase={onGenerateDiscriminatorCase}
          onGenerateClueRevision={onGenerateClueRevision}
          onAiDraftDecision={onAiDraftDecision}
        />
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
      </EditorialStream>
    </div>
  );
}

function CaseInventoryEntity({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  return (
    <EditorialEntity
      eyebrow="Inventory state"
      title="Assessment coverage"
      subtitle="Usable cases should exercise the learning goal, mimic, clue pattern, and escalation coverage expected by the brief."
      tone={
        workspace.cases.summary.blockerCount
          ? 'danger'
          : workspace.cases.summary.warningCount
            ? 'warning'
            : 'success'
      }
      action={
        workspace.cases.summary.latest ? (
          <Link
            to={`/cases/${workspace.cases.summary.latest.id}`}
            className="editorial-action"
          >
            Open latest case
          </Link>
        ) : null
      }
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
      {!workspace.cases.summary.latest ? (
        <p className="mt-3 text-sm text-slate-500">
          No cases are attached to this diagnosis yet.
        </p>
      ) : null}
    </EditorialEntity>
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

function ClueProgressionTimelineCard({
  workspace,
  pendingAction,
  onCreateDiscriminatorAnnotation,
  onUpdateDiscriminatorAnnotation,
  onDeleteDiscriminatorAnnotation,
  onGenerateDiscriminatorCase,
  onGenerateClueRevision,
  onAiDraftDecision,
}: {
  workspace: DiagnosisEditorialWorkspace;
  pendingAction: string | null;
  onCreateDiscriminatorAnnotation: (
    caseId: string,
    payload: CreateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onUpdateDiscriminatorAnnotation: (
    caseId: string,
    annotationId: string,
    payload: UpdateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onDeleteDiscriminatorAnnotation: (
    caseId: string,
    annotationId: string,
  ) => void;
  onGenerateDiscriminatorCase: (
    payload: GenerateTargetedDiscriminatorCasePayload,
  ) => void;
  onGenerateClueRevision: (payload: GenerateClueRevisionProposalPayload) => void;
  onAiDraftDecision: (
    auditId: string,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
}) {
  const casesWithProgression = workspace.cases.items.filter(
    (caseItem) => caseItem.clueProgression?.diagnosticStates.length,
  );
  const selectedCase = casesWithProgression[0] ?? null;
  const summary = workspace.cases.summary.progressionSignals;

  return (
    <EditorialNarrativeThread
      eyebrow="Clue progression"
      title="Solver-quality debugger"
      subtitle="Clue-by-clue diagnostic state, mimic collapse, discriminator emergence, and lock-in timing."
      tone={
        summary?.prematureLockInCases || summary?.abruptGiveawayCases
          ? 'danger'
          : summary?.unresolvedAmbiguityCases
            ? 'warning'
            : 'success'
      }
      action={
        selectedCase ? (
          <Link to={`/cases/${selectedCase.id}`} className="editorial-action">
            Open case
          </Link>
        ) : null
      }
    >
      <CompactMetricGrid
        items={[
          {
            label: 'Signals',
            value: summary?.total ?? 0,
            tone: summary?.total ? 'warning' : 'success',
          },
          {
            label: 'Early leaks',
            value: summary?.prematureLockInCases ?? 0,
            tone: summary?.prematureLockInCases ? 'danger' : 'success',
          },
          {
            label: 'Abrupt giveaways',
            value: summary?.abruptGiveawayCases ?? 0,
            tone: summary?.abruptGiveawayCases ? 'danger' : 'success',
          },
          {
            label: 'Unresolved mimics',
            value: summary?.unresolvedAmbiguityCases ?? 0,
            tone: summary?.unresolvedAmbiguityCases ? 'warning' : 'success',
          },
        ]}
      />
      {!selectedCase?.clueProgression ? (
        <EmptyGuidance
          title="No clue progression available"
          description="Cases need playable clues before the progression debugger can analyze solve timing."
        />
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">
                {selectedCase.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Likely lock-in:{' '}
                {selectedCase.clueProgression.likelyLockInClue
                  ? `clue ${selectedCase.clueProgression.likelyLockInClue}`
                  : 'not reached'}{' '}
                | Ambiguity{' '}
                {formatPercent(selectedCase.clueProgression.ambiguityScore)}
              </p>
            </div>
            <div className="flex max-w-full flex-wrap gap-1.5">
              {selectedCase.clueProgression.editorialSignals.length ? (
                selectedCase.clueProgression.editorialSignals
                  .slice(0, 4)
                  .map((signal) => (
                    <StatusBadge
                      key={signal}
                      status={formatLabel(signal)}
                      tone={progressionSignalTone(signal)}
                    />
                  ))
              ) : (
                <StatusBadge status="Progression stable" tone="success" />
              )}
            </div>
          </div>
          <ClueProgressionStateList
            caseId={selectedCase.id}
            analysis={selectedCase.clueProgression}
            annotations={selectedCase.clueDiscriminatorAnnotations ?? []}
            pendingAction={pendingAction}
            onCreateAnnotation={onCreateDiscriminatorAnnotation}
            onUpdateAnnotation={onUpdateDiscriminatorAnnotation}
            onDeleteAnnotation={onDeleteDiscriminatorAnnotation}
          />
          <DifferentialEliminationSection
            items={selectedCase.clueProgression.differentialElimination ?? []}
            opportunities={
              selectedCase.clueProgression.targetedGenerationOpportunities ?? []
            }
            pendingAction={pendingAction}
            onGenerateDiscriminatorCase={onGenerateDiscriminatorCase}
            onGenerateClueRevision={onGenerateClueRevision}
          />
          <GeneratedDiscriminatorRepairs
            reviews={workspace.discriminatorDraftReviews ?? []}
            pendingAction={pendingAction}
            onDecision={onAiDraftDecision}
          />
          {casesWithProgression.length > 1 ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-navy-border)] pt-3">
              {casesWithProgression.slice(1, 5).map((caseItem) => (
                <Link
                  key={caseItem.id}
                  to={`/cases/${caseItem.id}`}
                  className="editorial-action px-2.5 py-1.5 text-xs"
                >
                  {caseItem.title}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </EditorialNarrativeThread>
  );
}

function ClueProgressionStateList({
  caseId,
  analysis,
  annotations,
  pendingAction,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: {
  caseId: string;
  analysis: CaseClueProgressionAnalysis;
  annotations: CaseClueDiscriminatorAnnotation[];
  pendingAction: string | null;
  onCreateAnnotation: (
    caseId: string,
    payload: CreateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onUpdateAnnotation: (
    caseId: string,
    annotationId: string,
    payload: UpdateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onDeleteAnnotation: (caseId: string, annotationId: string) => void;
}) {
  return (
    <NarrativeStream>
      {analysis.diagnosticStates.map((state, index) => {
        const clueAnnotations = annotations.filter(
          (annotation) =>
            annotation.clueIndex === state.clueIndex ||
            annotation.clueOrder === state.clueIndex ||
            annotation.clueOrder === state.clueIndex - 1,
        );
        const next = analysis.diagnosticStates[index + 1];
        const emergences = analysis.discriminatorEmergences.filter(
          (emergence) => emergence.clueIndex === state.clueIndex,
        );
        const emergenceSignals = new Set(
          emergences.map((emergence) => emergence.signal),
        );
        const plainSignals = state.discriminatorSignals.filter(
          (signal) => !emergenceSignals.has(signal),
        );
        const checkpointTone = state.prematureLeakFlag
          ? 'danger'
          : progressionQualityTone(state.progressionQuality);
        const showFailureProjection =
          Boolean(state.editorialConcern) ||
          state.learnerConfusionRisk !== 'low' ||
          state.unresolvedAmbiguityFlag;
        const failureTone =
          state.learnerConfusionRisk === 'high' ? 'danger' : 'warning';

        const transitionParts: string[] = [];
        if (next) {
          if (Math.abs(next.confidenceShift) >= 0.05) {
            transitionParts.push(
              `Confidence ${next.confidenceShift > 0 ? 'rose' : 'fell'} ${Math.abs(
                Math.round(next.confidenceShift * 100),
              )} pts`,
            );
          }
          analysis.mimicCollapses
            .filter((collapse) => collapse.clueIndex === next.clueIndex)
            .forEach((collapse) => {
              transitionParts.push(
                `${collapse.mimic} collapsed — ${collapse.evidence}`,
              );
            });
        }

        return (
          <Fragment key={`${caseId}-${state.clueIndex}`}>
            <NarrativeCheckpoint
              tone={checkpointTone}
              marker={
                <>
                  <span className="rounded-full border border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-teal)]">
                    Clue {state.clueIndex}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatLabel(state.clueType)}
                  </span>
                  {state.clueIndex === analysis.likelyLockInClue ? (
                    <StatusBadge status="Lock-in" tone="info" />
                  ) : null}
                </>
              }
              title={state.clue}
              state={
                <StatusBadge
                  status={formatLabel(state.progressionQuality)}
                  tone={progressionQualityTone(state.progressionQuality)}
                />
              }
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                <div className="space-y-2">
                  <ProgressionBar
                    label="Confidence"
                    value={state.confidenceEstimate}
                    tone={state.prematureLeakFlag ? 'danger' : 'success'}
                  />
                  <ProgressionBar
                    label="Ambiguity"
                    value={state.ambiguityScore}
                    tone={state.ambiguityScore > 0.55 ? 'warning' : 'neutral'}
                  />
                </div>
                <div className="min-w-0 space-y-2 text-xs leading-5 text-slate-400">
                  <p>
                    Leading:{' '}
                    {state.leadingDifferentials.slice(0, 3).join(', ') ||
                      'none'}
                  </p>
                  <p>
                    Remaining mimics:{' '}
                    {state.remainingMimics.slice(0, 3).join(', ') || 'none'}
                  </p>
                  {state.collapsedMimics.length ? (
                    <p>
                      Collapsed: {state.collapsedMimics.slice(0, 3).join(', ')}
                    </p>
                  ) : null}
                </div>
              </div>
              {emergences.length || plainSignals.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {emergences.map((emergence) => (
                    <DiscriminatorReveal
                      key={`${state.clueIndex}-${emergence.signal}`}
                      label={emergence.signal}
                      strength={emergence.strength}
                      evidence={emergence.evidence}
                    />
                  ))}
                  {plainSignals.map((signal) => (
                    <DiscriminatorReveal
                      key={`${state.clueIndex}-${signal}`}
                      label={signal}
                    />
                  ))}
                </div>
              ) : null}
              {showFailureProjection ? (
                <LearnerFailureProjection tone={failureTone}>
                  {state.editorialConcern ??
                    (state.unresolvedAmbiguityFlag
                      ? 'Ambiguity is unresolved here — some learners may lock onto the wrong differential.'
                      : `${formatLabel(state.learnerConfusionRisk)} risk of confusion at this point.`)}
                </LearnerFailureProjection>
              ) : null}
              <ClueDiscriminatorAnnotationEditor
                caseId={caseId}
                clueIndex={state.clueIndex}
                clueOrder={state.clueIndex}
                annotations={clueAnnotations}
                pendingAction={pendingAction}
                onCreate={onCreateAnnotation}
                onUpdate={onUpdateAnnotation}
                onDelete={onDeleteAnnotation}
              />
            </NarrativeCheckpoint>
            {transitionParts.length ? (
              <ReasoningTransition tone={next?.prematureLeakFlag ? 'danger' : 'info'}>
                {transitionParts.join(' · ')}
              </ReasoningTransition>
            ) : null}
          </Fragment>
        );
      })}
    </NarrativeStream>
  );
}

function ClueDiscriminatorAnnotationEditor({
  caseId,
  clueIndex,
  clueOrder,
  annotations,
  pendingAction,
  onCreate,
  onUpdate,
  onDelete,
}: {
  caseId: string;
  clueIndex: number;
  clueOrder: number;
  annotations: CaseClueDiscriminatorAnnotation[];
  pendingAction: string | null;
  onCreate: (
    caseId: string,
    payload: CreateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onUpdate: (
    caseId: string,
    annotationId: string,
    payload: UpdateCaseClueDiscriminatorAnnotationPayload,
  ) => void;
  onDelete: (caseId: string, annotationId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const editing = annotations.find((annotation) => annotation.id === editingId);
  const [draft, setDraft] = useState({
    eliminatedDiagnosisName: '',
    discriminator: '',
    reasoning: '',
    eliminationStrength: 'moderate' as 'weak' | 'moderate' | 'strong',
    educationalValue: 'medium' as 'low' | 'medium' | 'high',
  });

  function startNew() {
    setDraft({
      eliminatedDiagnosisName: '',
      discriminator: '',
      reasoning: '',
      eliminationStrength: 'moderate',
      educationalValue: 'medium',
    });
    setEditingId('new');
  }

  function startEdit(annotation: CaseClueDiscriminatorAnnotation) {
    setDraft({
      eliminatedDiagnosisName: annotation.eliminatedDiagnosisName,
      discriminator: annotation.discriminator,
      reasoning: annotation.reasoning ?? '',
      eliminationStrength:
        annotation.eliminationStrength === 'weak' ||
        annotation.eliminationStrength === 'strong'
          ? annotation.eliminationStrength
          : 'moderate',
      educationalValue:
        annotation.educationalValue === 'low' ||
        annotation.educationalValue === 'high'
          ? annotation.educationalValue
          : 'medium',
    });
    setEditingId(annotation.id);
  }

  function saveDraft() {
    if (!draft.eliminatedDiagnosisName.trim() || !draft.discriminator.trim()) {
      return;
    }
    const payload = {
      clueOrder,
      clueIndex,
      eliminatedDiagnosisName: draft.eliminatedDiagnosisName.trim(),
      discriminator: draft.discriminator.trim(),
      reasoning: draft.reasoning.trim() || null,
      eliminationStrength: draft.eliminationStrength,
      educationalValue: draft.educationalValue,
    };
    if (editing) {
      onUpdate(caseId, editing.id, payload);
    } else {
      onCreate(caseId, payload);
    }
    setEditingId(null);
  }

  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Editorial discriminator
        </p>
        {!editingId ? (
          <button
            type="button"
            className="editorial-action px-2 py-1 text-xs"
            onClick={startNew}
          >
            Add annotation
          </button>
        ) : null}
      </div>
      {annotations.length ? (
        <div className="mt-2 space-y-2">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className="rounded-md border border-[var(--color-teal)]/20 bg-[var(--color-teal)]/10 px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {annotation.eliminatedDiagnosisName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    {annotation.discriminator}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status="Editorial" tone="success" />
                  <StatusBadge
                    status={formatLabel(annotation.eliminationStrength)}
                    tone={
                      annotation.eliminationStrength === 'weak'
                        ? 'warning'
                        : 'success'
                    }
                  />
                </div>
              </div>
              {annotation.reasoning ? (
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {annotation.reasoning}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--color-teal)]"
                  onClick={() => startEdit(annotation)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--color-rose)]"
                  onClick={() => onDelete(caseId, annotation.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !editingId ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          No editor-governed mimic separation is attached to this clue.
        </p>
      ) : null}
      {editingId ? (
        <div className="mt-3 grid gap-2">
          <input
            value={draft.eliminatedDiagnosisName}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                eliminatedDiagnosisName: event.target.value,
              }))
            }
            placeholder="Eliminated mimic"
            className="rounded-md border border-[var(--color-navy-border)] bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={draft.discriminator}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                discriminator: event.target.value,
              }))
            }
            placeholder="Discriminator used by this clue"
            className="rounded-md border border-[var(--color-navy-border)] bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
          />
          <textarea
            value={draft.reasoning}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                reasoning: event.target.value,
              }))
            }
            placeholder="Clinical reasoning"
            rows={2}
            className="rounded-md border border-[var(--color-navy-border)] bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={draft.eliminationStrength}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  eliminationStrength: event.target.value as
                    | 'weak'
                    | 'moderate'
                    | 'strong',
                }))
              }
              className="rounded-md border border-[var(--color-navy-border)] bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
            >
              <option value="weak">Weak elimination</option>
              <option value="moderate">Moderate elimination</option>
              <option value="strong">Strong elimination</option>
            </select>
            <select
              value={draft.educationalValue}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  educationalValue: event.target.value as
                    | 'low'
                    | 'medium'
                    | 'high',
                }))
              }
              className="rounded-md border border-[var(--color-navy-border)] bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
            >
              <option value="low">Low teaching value</option>
              <option value="medium">Medium teaching value</option>
              <option value="high">High teaching value</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                pendingAction !== null ||
                !draft.eliminatedDiagnosisName.trim() ||
                !draft.discriminator.trim()
              }
              onClick={saveDraft}
              className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save annotation
            </button>
            <button
              type="button"
              className="editorial-action"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DifferentialEliminationSection({
  items,
  opportunities,
  pendingAction,
  onGenerateDiscriminatorCase,
  onGenerateClueRevision,
}: {
  items: CaseDifferentialElimination[];
  opportunities: TargetedDiscriminatorGenerationRequest[];
  pendingAction: string | null;
  onGenerateDiscriminatorCase: (
    payload: GenerateTargetedDiscriminatorCasePayload,
  ) => void;
  onGenerateClueRevision: (payload: GenerateClueRevisionProposalPayload) => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-[var(--color-navy-border)] bg-slate-950/20 p-3">
        <p className="text-sm font-semibold text-slate-200">
          Differential elimination
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          No tracked mimics were available for this case.
        </p>
      </div>
    );
  }

  const highlighted = items.filter(
    (item) =>
      item.finalStatus !== 'eliminated' ||
      item.eliminationStrength === 'weak' ||
      item.prematureCollapseRisk ||
      item.remainingConfusionRisk,
  );
  const visibleItems = items.length > 4 ? highlighted.slice(0, 4) : items;
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <CollapsibleDetail
      title="Differential elimination"
      summary={`${items.length} mimic${items.length === 1 ? '' : 's'} tracked`}
    >
      <div className="space-y-2">
        {visibleItems.map((item) => {
          const itemOpportunities = opportunities.filter((opportunity) =>
            sameMimicOpportunity(item, opportunity),
          );
          const primaryOpportunity = itemOpportunities[0];
          return (
            <EditorialRow
              key={`${item.mimicDiagnosisId ?? item.mimicName}-${item.finalStatus}`}
              title={item.mimicName}
              subtitle={[
                item.relationshipType ? formatLabel(item.relationshipType) : null,
                `initial ${formatLabel(item.initialPlausibility)}`,
                item.eliminatedAtClueIndex
                  ? `eliminated at clue ${item.eliminatedAtClueIndex}`
                  : null,
              ]
                .filter(Boolean)
                .join(' | ')}
              tone={mimicStateTone(item)}
              action={
                <MimicStateIndicator
                  finalStatus={item.finalStatus}
                  eliminationStrength={item.eliminationStrength}
                  prematureCollapseRisk={item.prematureCollapseRisk}
                  remainingConfusionRisk={item.remainingConfusionRisk}
                />
              }
            >
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge
                    status={
                      item.annotationSource === 'editorial'
                        ? 'Editorial annotation'
                        : 'Heuristic'
                    }
                    tone={
                      item.annotationSource === 'editorial' ? 'success' : 'info'
                    }
                  />
                  <StatusBadge
                    status={`${formatLabel(item.eliminationStrength)} elimination`}
                    tone={
                      item.eliminationStrength === 'weak'
                        ? 'warning'
                        : item.eliminationStrength === 'strong'
                          ? 'success'
                          : 'info'
                    }
                  />
                  <StatusBadge
                    status={`${formatLabel(item.educationalValue)} teaching value`}
                    tone={item.educationalValue === 'high' ? 'success' : 'neutral'}
                  />
                  {primaryOpportunity ? (
                    <StatusBadge
                      status={formatLabel(primaryOpportunity.generationIntent)}
                      tone="warning"
                    />
                  ) : null}
                </div>
                {item.discriminatorUsed ? (
                  <DiscriminatorReveal label={item.discriminatorUsed} />
                ) : null}
                {item.prematureCollapseRisk || item.remainingConfusionRisk ? (
                  <LearnerFailureProjection
                    tone={item.prematureCollapseRisk ? 'danger' : 'warning'}
                  >
                    {[
                      item.prematureCollapseRisk
                        ? 'this mimic collapsed before learners saw enough evidence to rule it out themselves.'
                        : null,
                      item.remainingConfusionRisk
                        ? 'some learners may still consider this plausible even after elimination.'
                        : null,
                      item.notes ?? null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </LearnerFailureProjection>
                ) : item.notes ? (
                  <p className="text-xs leading-5 text-slate-500">{item.notes}</p>
                ) : null}
                {primaryOpportunity ? (
                  <div className="flex flex-wrap gap-2 border-t border-[var(--color-navy-border)] pt-2">
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="editorial-action editorial-action-primary px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() =>
                        onGenerateDiscriminatorCase({
                          target: primaryOpportunity,
                          difficulty: 'MEDIUM',
                          clueRevealStrategy: 'late_discriminator',
                        })
                      }
                    >
                      Generate targeted case
                    </button>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="editorial-action px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() =>
                        onGenerateClueRevision({
                          target: primaryOpportunity,
                          existingClue: item.eliminatedBy,
                          desiredClueOrder:
                            primaryOpportunity.sourceClueOrder ??
                            primaryOpportunity.sourceClueIndex,
                        })
                      }
                    >
                      Generate revision
                    </button>
                  </div>
                ) : null}
              </div>
            </EditorialRow>
          );
        })}
        {hiddenCount ? (
          <p className="px-1 text-xs text-slate-500">
            {hiddenCount} lower-risk mimic{hiddenCount === 1 ? '' : 's'} hidden.
          </p>
        ) : null}
      </div>
    </CollapsibleDetail>
  );
}

function sameMimicOpportunity(
  item: CaseDifferentialElimination,
  opportunity: TargetedDiscriminatorGenerationRequest,
) {
  if (
    item.mimicDiagnosisId &&
    opportunity.mimicDiagnosisId &&
    item.mimicDiagnosisId === opportunity.mimicDiagnosisId
  ) {
    return true;
  }
  return item.mimicName.toLowerCase() === opportunity.mimicName.toLowerCase();
}

function GeneratedDiscriminatorRepairs({
  reviews,
  pendingAction,
  onDecision,
}: {
  reviews: DiscriminatorDraftReview[];
  pendingAction: string | null;
  onDecision: (
    auditId: string,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
}) {
  if (!reviews.length) {
    return null;
  }
  const pendingCount = reviews.filter((review) =>
    isPendingDraftStatus(review.reviewStatus),
  ).length;

  return (
    <StreamDisclosure
      title="Generated discriminator repairs"
      summary={`${pendingCount} pending / ${reviews.length} total draft${reviews.length === 1 ? '' : 's'}`}
    >
      <div className="space-y-3">
        {reviews.map((review) => {
          const payload = review.discriminatorDraftReview;
          const clueRevision = payload.proposedOutput.clueRevision;
          const outputTitle =
            payload.proposedOutput.title ??
            clueRevision?.revisedClue ??
            clueRevision?.addedClue ??
            'Generated repair draft';
          const pending = isPendingDraftStatus(review.reviewStatus);
          return (
            <NarrativeCheckpoint
              key={review.auditId}
              tone={pending ? 'warning' : draftReviewTone(review.reviewStatus)}
              marker={
                <>
                  <StatusBadge
                    status={formatLabel(payload.draftKind)}
                    tone={payload.draftKind === 'targeted_discriminator_case' ? 'info' : 'warning'}
                  />
                  <StatusBadge
                    status={formatLabel(review.reviewStatus)}
                    tone={draftReviewTone(review.reviewStatus)}
                  />
                </>
              }
              title={outputTitle}
              state={
                <StatusBadge
                  status={formatLabel(payload.generationIntent)}
                  tone="warning"
                />
              }
            >
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={payload.mimicName} tone="info" />
                  {payload.sourceClueOrder ?? payload.sourceClueIndex ? (
                    <StatusBadge
                      status={`Clue ${payload.sourceClueOrder ?? payload.sourceClueIndex}`}
                      tone="neutral"
                    />
                  ) : null}
                </div>
                <DiscriminatorReveal label={payload.discriminator} />
                {payload.learnerRisk || payload.editorialReason ? (
                  <LearnerFailureProjection tone="warning">
                    {payload.learnerRisk ?? payload.editorialReason}
                  </LearnerFailureProjection>
                ) : null}
                {clueRevision ? (
                  <div className="rounded-md border border-[var(--color-navy-border)] bg-white/5 p-3 text-xs leading-5 text-slate-400">
                    {clueRevision.originalClue ? (
                      <p>Original: {clueRevision.originalClue}</p>
                    ) : null}
                    <p>
                      Draft:{' '}
                      {clueRevision.revisedClue ??
                        clueRevision.addedClue ??
                        outputTitle}
                    </p>
                    {clueRevision.expectedEffect ? (
                      <p>Expected: {clueRevision.expectedEffect}</p>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-xs leading-5 text-slate-400">
                  {payload.proposedOutput.clueProgressionRationale ??
                    payload.reviewGuidance.primaryQuestion}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {payload.reviewGuidance.safetyNotes.map((note) => (
                    <StatusBadge key={note} status={note} tone="neutral" />
                  ))}
                </div>
                {pending ? (
                  <InlineReviewBar note={payload.reviewGuidance.primaryQuestion}>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onDecision(review.auditId, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() =>
                        onDecision(
                          review.auditId,
                          'request-changes',
                          payload.reviewGuidance.requestChangesHint,
                        )
                      }
                    >
                      Request changes
                    </button>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onDecision(review.auditId, 'reject')}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() =>
                        onDecision(
                          review.auditId,
                          'supersede',
                          'Superseded by newer discriminator repair draft.',
                        )
                      }
                    >
                      Supersede
                    </button>
                  </InlineReviewBar>
                ) : (
                  <p className="text-xs text-slate-500">
                    Decision: {formatLabel(review.reviewStatus)}
                  </p>
                )}
              </div>
            </NarrativeCheckpoint>
          );
        })}
      </div>
    </StreamDisclosure>
  );
}

function isPendingDraftStatus(status: string) {
  return status === 'PENDING_REVIEW' || status === 'REVIEW_REQUIRED';
}

function draftReviewTone(status: string) {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'NEEDS_CHANGES' || status === 'PENDING_REVIEW') return 'warning';
  return 'neutral';
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
          <div className="space-y-2">
            {groupCaseLearningGoalCoverage(caseLearningGoalCoverage)
              .slice(0, 8)
              .map((goal) => {
                const missing = [
                  ...goal.missingDiscriminators,
                  ...goal.missingMimics,
                ];

                return (
                  <EditorialRow
                    key={goal.learningGoalId}
                    title={goal.learningGoal}
                    subtitle={goal.caseTitles.join(', ') || 'No cases mapped'}
                    tone={scoreTone(goal.coverageStrength / 100)}
                    action={
                      <StatusBadge
                        status={`${goal.coverageStrength}%`}
                        tone={scoreTone(goal.coverageStrength / 100)}
                      />
                    }
                  >
                    {missing.length ? (
                      <p className="text-xs leading-5 text-slate-400">
                        Missing: {missing.slice(0, 3).join(', ')}
                        {missing.length > 3 ? ` +${missing.length - 3}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs leading-5 text-slate-500">
                        No missing discriminator or mimic notes.
                      </p>
                    )}
                    <CoverageAnnotationActions
                      row={goal.row}
                      pendingAction={pendingAction}
                      onUpdate={onUpdateLearningGoalCoverage}
                      onDelete={onDeleteLearningGoalCoverage}
                    />
                  </EditorialRow>
                );
              })}
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

function ProgressionBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  const classes = {
    success: 'bg-[var(--color-green)]',
    warning: 'bg-[var(--color-amber)]',
    danger: 'bg-[var(--color-rose)]',
    neutral: 'bg-slate-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-900">
        <div
          className={`h-full rounded-full ${classes[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'unknown';
  }
  return `${Math.round(value * 100)}%`;
}

function progressionSignalTone(signal: string) {
  if (signal === 'premature_lock_in' || signal === 'abrupt_giveaway') {
    return 'danger';
  }
  if (
    signal === 'unresolved_mimic' ||
    signal === 'weak_transition' ||
    signal === 'weak_elimination' ||
    signal === 'missing_discriminator_case'
  ) {
    return 'warning';
  }
  if (signal === 'persistent_confusion' || signal === 'premature_mimic_collapse') {
    return 'danger';
  }
  return 'info';
}

function progressionQualityTone(quality: string) {
  if (quality === 'strong') return 'success';
  if (quality === 'weak') return 'danger';
  return 'warning';
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
      <SecondaryActionDisclosure>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => onDelete(row.id!)}
          className="editorial-action px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          Remove
        </button>
      </SecondaryActionDisclosure>
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
