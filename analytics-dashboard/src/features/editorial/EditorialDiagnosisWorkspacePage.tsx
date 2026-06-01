import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  compareDiagnosisEducationRevisions,
  createDiagnosisEditorialBrief,
  createDiagnosisTeachingRule,
  generateDiagnosisEditorialBrief,
  generateDiagnosisTeachingRuleCandidates,
  generateTargetedDiagnosisCase,
  getDiagnosisEditorialBrief,
  getDiagnosisEditorialWorkspace,
  regenerateDiagnosisEducationSection,
  reviewDiagnosisEditorialBrief,
  reviewDiagnosisTeachingRule,
  seedLegacyDiagnosisTeachingRules,
  updateDiagnosisEditorialBrief,
  updateDiagnosisTeachingRule,
  type DiagnosisEditorialBriefResponse,
  type DiagnosisEditorialBriefReviewAction,
  type DiagnosisEditorialBriefWritePayload,
  type DiagnosisEditorialWorkspace,
  type DiagnosisEducationRevisionAnalysis,
  type DiagnosisEducationRevisionCompareResult,
  type DiagnosisGraphCandidate,
  type DiagnosisTeachingRuleReviewAction,
  type DiagnosisTeachingRulesResponse,
  type DiagnosisTeachingRuleWritePayload,
  type EducationRegenerableSection,
  type GenerateTargetedCasePayload,
  type GenerateTargetedCaseResult,
  type TeachingUnitCoverageMap,
  type WorkspaceAvailableAction,
  type WorkspaceCoverageGap,
  type WorkspaceCoverageMatrixRow,
  type WorkspaceLifecycle,
  type WorkspaceLifecycleState,
  type WorkspaceReadinessItem,
  type WorkspaceRecommendedAction,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ActionFeedback from '../../components/ui/ActionFeedback';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../components/ui/statusBadgeMeta';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import {
  useConsoleAccess,
  type ConsoleAccessState,
} from '../../hooks/useConsoleAccess';
import EditorialBriefCard from '../cases/education/EditorialBriefCard';
import RevisionCompareCard from '../cases/education/RevisionCompareCard';
import RevisionHistoryCard from '../cases/education/RevisionHistoryCard';
import TargetedCaseGenerationCard from '../cases/education/TargetedCaseGenerationCard';
import TeachingRulesCard from '../cases/education/TeachingRulesCard';

type WorkspaceTab =
  | 'overview'
  | 'teaching-rules'
  | 'editorial-brief'
  | 'education'
  | 'cases'
  | 'graph';

type RuleDrawerAction =
  | 'education'
  | 'generate-case'
  | 'review-graph'
  | 'edit-rule';

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'teaching-rules', label: 'Teaching Rules' },
  { id: 'editorial-brief', label: 'Editorial Brief' },
  { id: 'education', label: 'Education' },
  { id: 'cases', label: 'Cases' },
  { id: 'graph', label: 'Graph' },
];

export default function EditorialDiagnosisWorkspacePage() {
  const { diagnosisRegistryId } = useParams<{ diagnosisRegistryId: string }>();
  const access = useConsoleAccess();
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [selectedCoverageKey, setSelectedCoverageKey] = useState<string | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<DiagnosisEditorialWorkspace | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefDetail, setBriefDetail] =
    useState<DiagnosisEditorialBriefResponse | null>(null);
  const [briefDetailLoading, setBriefDetailLoading] = useState(false);
  const [briefDetailError, setBriefDetailError] = useState<string | null>(null);
  const [revisionCompare, setRevisionCompare] =
    useState<DiagnosisEducationRevisionCompareResult | null>(null);
  const [revisionCompareLoading, setRevisionCompareLoading] = useState(false);
  const [revisionCompareError, setRevisionCompareError] = useState<string | null>(
    null,
  );
  const [compareFromVersion, setCompareFromVersion] = useState<number | null>(
    null,
  );
  const [compareToVersion, setCompareToVersion] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [generatedTargetedCase, setGeneratedTargetedCase] =
    useState<GenerateTargetedCaseResult['generatedCase'] | null>(null);
  const { feedback, clear, showError, showPending, showSuccess } =
    useActionFeedback();

  const revisions = useMemo(
    () => sortRevisionsNewestFirst(workspace?.revisions.items ?? []),
    [workspace],
  );
  const diagnosisName =
    workspace?.diagnosis.displayLabel ??
    workspace?.diagnosis.canonicalName ??
    'Diagnosis workspace';
  const rulesResponse = useMemo(
    () => toTeachingRulesResponse(workspace),
    [workspace],
  );
  const coverageMap = useMemo(() => toTeachingUnitCoverageMap(workspace), [workspace]);
  const mimicCandidates =
    workspace?.graph.candidates.filter(
      (candidate) =>
        candidate.type === 'MIMIC' &&
        (candidate.status === 'CANDIDATE' || candidate.status === 'APPROVED'),
    ) ?? [];
  const selectedCoverageRow = useMemo(
    () =>
      workspace?.coverageMatrix?.find(
        (row) => getCoverageRowKey(row) === selectedCoverageKey,
      ) ?? null,
    [selectedCoverageKey, workspace?.coverageMatrix],
  );
  const closeRuleDrawer = useCallback(() => {
    setSelectedCoverageKey(null);
  }, []);
  const canRunSeniorActions = access.canPublishEditorial;
  const seniorDisabledReason = 'Requires senior editor';

  function openCoverageRow(row: WorkspaceCoverageMatrixRow) {
    setSelectedCoverageKey(getCoverageRowKey(row));
  }

  function openCoverageGap(gap: WorkspaceCoverageGap) {
    const row = findCoverageRowForGap(workspace, gap);
    if (row) {
      openCoverageRow(row);
      return;
    }
    setActiveTab(gap.targetTab);
  }

  function handleRuleDrawerAction(action: RuleDrawerAction) {
    if (action === 'education') {
      setActiveTab('education');
      return;
    }
    if (action === 'generate-case') {
      setActiveTab('cases');
      return;
    }
    if (action === 'review-graph') {
      setActiveTab('graph');
      return;
    }
    setActiveTab('teaching-rules');
  }

  const refreshWorkspace = useCallback(async () => {
    if (!diagnosisRegistryId) {
      setWorkspace(null);
      setLoading(false);
      setError('Missing diagnosis registry ID.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nextWorkspace = await getDiagnosisEditorialWorkspace(
        client,
        diagnosisRegistryId,
      );
      setWorkspace(nextWorkspace);
    } catch (loadError) {
      setWorkspace(null);
      setError(errorMessage(loadError, 'Failed to load editorial workspace.'));
    } finally {
      setLoading(false);
    }
  }, [client, diagnosisRegistryId]);

  const refreshBriefDetail = useCallback(async () => {
    if (!diagnosisRegistryId) {
      return;
    }

    try {
      setBriefDetailLoading(true);
      setBriefDetailError(null);
      const response = await getDiagnosisEditorialBrief(client, diagnosisRegistryId);
      setBriefDetail(response);
    } catch (loadError) {
      setBriefDetail(null);
      setBriefDetailError(
        errorMessage(loadError, 'Failed to load editorial brief details.'),
      );
    } finally {
      setBriefDetailLoading(false);
    }
  }, [client, diagnosisRegistryId]);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    closeRuleDrawer();
  }, [closeRuleDrawer, diagnosisRegistryId]);

  useEffect(() => {
    closeRuleDrawer();
  }, [activeTab, closeRuleDrawer]);

  useEffect(() => {
    if (!selectedCoverageKey) {
      return;
    }

    const exists = workspace?.coverageMatrix?.some(
      (row) => getCoverageRowKey(row) === selectedCoverageKey,
    );
    if (!exists) {
      closeRuleDrawer();
    }
  }, [closeRuleDrawer, selectedCoverageKey, workspace?.coverageMatrix]);

  useEffect(() => {
    if (!selectedCoverageRow) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRuleDrawer();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeRuleDrawer, selectedCoverageRow]);

  useEffect(() => {
    if (activeTab === 'editorial-brief' && !briefDetail && !briefDetailLoading) {
      void refreshBriefDetail();
    }
  }, [activeTab, briefDetail, briefDetailLoading, refreshBriefDetail]);

  useEffect(() => {
    if (revisions.length >= 2 && compareFromVersion === null && compareToVersion === null) {
      setCompareFromVersion(revisions[1].version);
      setCompareToVersion(revisions[0].version);
    }
  }, [compareFromVersion, compareToVersion, revisions]);

  useEffect(() => {
    if (
      !diagnosisRegistryId ||
      compareFromVersion === null ||
      compareToVersion === null ||
      compareFromVersion === compareToVersion
    ) {
      setRevisionCompare(null);
      setRevisionCompareError(
        compareFromVersion !== null && compareFromVersion === compareToVersion
          ? 'Choose two different revisions to compare.'
          : null,
      );
      setRevisionCompareLoading(false);
      return;
    }

    let active = true;
    const registryId = diagnosisRegistryId;
    const fromVersion = compareFromVersion;
    const toVersion = compareToVersion;

    async function loadRevisionCompare() {
      try {
        setRevisionCompareLoading(true);
        setRevisionCompareError(null);
        const comparison = await compareDiagnosisEducationRevisions(
          client,
          registryId,
          fromVersion,
          toVersion,
        );
        if (active) {
          setRevisionCompare(comparison);
        }
      } catch (compareError) {
        if (active) {
          setRevisionCompare(null);
          setRevisionCompareError(
            errorMessage(compareError, 'Failed to compare revisions.'),
          );
        }
      } finally {
        if (active) {
          setRevisionCompareLoading(false);
        }
      }
    }

    void loadRevisionCompare();

    return () => {
      active = false;
    };
  }, [client, compareFromVersion, compareToVersion, diagnosisRegistryId]);

  async function runWorkspaceAction(config: {
    id: string;
    pending: string;
    success: string;
    action: () => Promise<unknown>;
    refreshBrief?: boolean;
  }) {
    try {
      setPendingAction(config.id);
      showPending(config.pending);
      await config.action();
      await refreshWorkspace();
      if (config.refreshBrief) {
        await refreshBriefDetail();
      }
      showSuccess(config.success);
      return true;
    } catch (actionError) {
      showError(errorMessage(actionError, 'Action failed.'));
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  function handleGenerateTeachingRuleCandidates() {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: 'teaching-rule-generate',
      pending: 'Generating teaching rule candidates...',
      success: 'Teaching rule candidates generated.',
      action: () => generateDiagnosisTeachingRuleCandidates(client, diagnosisRegistryId),
    });
  }

  function handleSeedLegacyTeachingRules() {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: 'teaching-rule-seed',
      pending: 'Seeding legacy teaching rules...',
      success: 'Legacy teaching rules seeded.',
      action: () => seedLegacyDiagnosisTeachingRules(client, diagnosisRegistryId),
    });
  }

  function handleCreateTeachingRule(payload: DiagnosisTeachingRuleWritePayload) {
    if (!diagnosisRegistryId) {
      return Promise.resolve(false);
    }
    return runWorkspaceAction({
      id: 'teaching-rule-create',
      pending: 'Creating teaching rule...',
      success: 'Teaching rule created.',
      action: () => createDiagnosisTeachingRule(client, diagnosisRegistryId, payload),
    });
  }

  function handleUpdateTeachingRule(
    ruleId: string,
    payload: DiagnosisTeachingRuleWritePayload,
  ) {
    return runWorkspaceAction({
      id: 'teaching-rule-update',
      pending: 'Updating teaching rule...',
      success: 'Teaching rule updated.',
      action: () => updateDiagnosisTeachingRule(client, ruleId, payload),
    });
  }

  function handleReviewTeachingRule(
    ruleId: string,
    action: DiagnosisTeachingRuleReviewAction,
  ) {
    if (!canRunSeniorActions) {
      showError(seniorDisabledReason);
      return;
    }

    void runWorkspaceAction({
      id: `teaching-rule-${action}`,
      pending: 'Updating teaching rule status...',
      success: 'Teaching rule status updated.',
      action: () => reviewDiagnosisTeachingRule(client, ruleId, action),
    });
  }

  function handleGenerateEditorialBrief() {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: 'editorial-brief-generate',
      pending: 'Generating editorial brief...',
      success: 'Editorial brief generated.',
      refreshBrief: true,
      action: () => generateDiagnosisEditorialBrief(client, diagnosisRegistryId),
    });
  }

  function handleCreateEditorialBrief(payload: DiagnosisEditorialBriefWritePayload) {
    if (!diagnosisRegistryId) {
      return Promise.resolve(false);
    }
    return runWorkspaceAction({
      id: 'editorial-brief-create',
      pending: 'Creating editorial brief...',
      success: 'Editorial brief created.',
      refreshBrief: true,
      action: () => createDiagnosisEditorialBrief(client, diagnosisRegistryId, payload),
    });
  }

  function handleUpdateEditorialBrief(payload: DiagnosisEditorialBriefWritePayload) {
    if (!diagnosisRegistryId) {
      return Promise.resolve(false);
    }
    return runWorkspaceAction({
      id: 'editorial-brief-update',
      pending: 'Updating editorial brief...',
      success: 'Editorial brief updated.',
      refreshBrief: true,
      action: () => updateDiagnosisEditorialBrief(client, diagnosisRegistryId, payload),
    });
  }

  function handleReviewEditorialBrief(action: DiagnosisEditorialBriefReviewAction) {
    if (!diagnosisRegistryId) {
      return;
    }
    if (!canRunSeniorActions) {
      showError(seniorDisabledReason);
      return;
    }
    void runWorkspaceAction({
      id: `editorial-brief-${action}`,
      pending: 'Updating editorial brief status...',
      success: 'Editorial brief status updated.',
      refreshBrief: true,
      action: () => reviewDiagnosisEditorialBrief(client, diagnosisRegistryId, action),
    });
  }

  function handleGenerateTargetedCase(payload: GenerateTargetedCasePayload) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: 'targeted-case',
      pending: 'Generating targeted case...',
      success: 'Targeted case generated for review.',
      action: async () => {
        const result = await generateTargetedDiagnosisCase(
          client,
          diagnosisRegistryId,
          payload,
        );
        setGeneratedTargetedCase(result.generatedCase);
      },
    });
  }

  function handleRegenerateSection(section: EducationRegenerableSection) {
    if (!diagnosisRegistryId) {
      return;
    }

    const confirmed = window.confirm(
      `Regenerate ${formatLabel(section)} for ${diagnosisName}?`,
    );
    if (!confirmed) {
      return;
    }

    void runWorkspaceAction({
      id: `regenerate-${section}`,
      pending: `Regenerating ${formatLabel(section)}...`,
      success: `${formatLabel(section)} regenerated.`,
      action: () =>
        regenerateDiagnosisEducationSection(client, diagnosisRegistryId, {
          section,
        }),
    });
  }

  if (!access.canAccessEditorial) {
    return <AccessDenied access={access} />;
  }

  if (loading && !workspace) {
    return (
      <LoadingState
        title="Loading editorial workspace"
        description="Fetching the unified diagnosis workspace read model."
      />
    );
  }

  if (!diagnosisRegistryId) {
    return (
      <ErrorState
        title="Missing diagnosis"
        message="The editorial workspace needs a diagnosis registry ID."
      />
    );
  }

  if (error && !workspace) {
    return (
      <ErrorState
        title="Unable to load editorial workspace"
        message={error}
      />
    );
  }

  if (!workspace) {
    return (
      <ErrorState
        title="Workspace unavailable"
        message="The diagnosis workspace did not return any data."
      />
    );
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader workspace={workspace} />

      <ActionFeedback
        feedback={feedback}
        onDismiss={pendingAction ? undefined : clear}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          <TabBar activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === 'overview' ? (
            <OverviewTab
              workspace={workspace}
              selectedRow={selectedCoverageRow}
              onRowSelect={openCoverageRow}
              onGapSelect={openCoverageGap}
              onTabChange={setActiveTab}
            />
          ) : null}
          {activeTab === 'teaching-rules' ? (
            <div className="space-y-4">
              <TeachingRulesCard
                rules={rulesResponse}
                loading={loading}
                error={null}
                pendingAction={pendingAction}
                onGenerateCandidates={handleGenerateTeachingRuleCandidates}
                onSeedLegacy={handleSeedLegacyTeachingRules}
                onCreateRule={handleCreateTeachingRule}
                onUpdateRule={handleUpdateTeachingRule}
                onReviewRule={handleReviewTeachingRule}
                canReviewRules={canRunSeniorActions}
                reviewDisabledReason={seniorDisabledReason}
              />
              <CoverageMatrixCard
                rows={workspace.coverageMatrix}
                selectedRow={selectedCoverageRow}
                onRowSelect={openCoverageRow}
              />
            </div>
          ) : null}
          {activeTab === 'editorial-brief' ? (
            <div className="space-y-4">
              <EditorialBriefSummaryCard workspace={workspace} />
              <EditorialBriefCard
                briefResponse={briefDetail}
                teachingRules={rulesResponse}
                loading={briefDetailLoading}
                error={briefDetailError}
                pendingAction={pendingAction}
                onGenerate={handleGenerateEditorialBrief}
                onCreate={handleCreateEditorialBrief}
                onUpdate={handleUpdateEditorialBrief}
                onReview={handleReviewEditorialBrief}
                canReviewBrief={canRunSeniorActions}
                reviewDisabledReason={seniorDisabledReason}
              />
            </div>
          ) : null}
          {activeTab === 'education' ? (
            <EducationTab
              workspace={workspace}
              revisions={revisions}
              revisionCompare={revisionCompare}
              revisionCompareLoading={revisionCompareLoading}
              revisionCompareError={revisionCompareError}
              compareFromVersion={compareFromVersion}
              compareToVersion={compareToVersion}
              pendingAction={pendingAction}
              onRegenerateSection={handleRegenerateSection}
              onFromVersionChange={setCompareFromVersion}
              onToVersionChange={setCompareToVersion}
            />
          ) : null}
          {activeTab === 'cases' ? (
              <CasesTab
                workspace={workspace}
                coverage={coverageMap}
                mimicCandidates={mimicCandidates}
                pendingAction={pendingAction}
                generatedTargetedCase={generatedTargetedCase}
                onGapSelect={openCoverageGap}
                onGenerateTargetedCase={handleGenerateTargetedCase}
              />
          ) : null}
          {activeTab === 'graph' ? (
            <GraphTab
              workspace={workspace}
              selectedRow={selectedCoverageRow}
              onRowSelect={openCoverageRow}
            />
          ) : null}
        </main>

        <WorkspaceRail
          workspace={workspace}
          onGapSelect={openCoverageGap}
          onTabChange={setActiveTab}
        />
      </div>
      {selectedCoverageRow ? (
        <>
          <div
            role="presentation"
            aria-label="Close teaching rule details"
            className="fixed inset-0 z-40 bg-slate-950/30"
            onClick={closeRuleDrawer}
          />
          <TeachingRuleDrawer
            row={selectedCoverageRow}
            workspace={workspace}
            onClose={closeRuleDrawer}
            onAction={handleRuleDrawerAction}
          />
        </>
      ) : null}
    </div>
  );
}

function WorkspaceHeader({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const canonicalDifferent =
    workspace.diagnosis.canonicalName &&
    workspace.diagnosis.canonicalName.toLowerCase() !==
      workspace.diagnosis.displayLabel.toLowerCase();
  const taxonomy = [
    workspace.diagnosis.specialty,
    workspace.diagnosis.bodySystem,
    workspace.diagnosis.category,
    workspace.diagnosis.difficultyBand,
  ].filter(Boolean);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Editorial Diagnosis Workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {workspace.diagnosis.displayLabel}
            </h2>
            {canonicalDifferent ? (
              <p className="mt-1 text-sm text-slate-300">
                {workspace.diagnosis.canonicalName}
              </p>
            ) : null}
            {taxonomy.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {taxonomy.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-300"
                  >
                    {formatLabel(String(item))}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 break-all font-mono text-xs text-slate-400">
              {workspace.diagnosis.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderPill label={formatLabel(workspace.workspaceSummary.status)} />
            <HeaderPill label={formatLabel(workspace.lifecycle.ready)} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <HeaderMetric label="Education" value={workspace.education.status} />
          <HeaderMetric
            label="Usable cases"
            value={`${workspace.cases.summary.usable}/${workspace.cases.summary.total}`}
          />
          <HeaderMetric
            label="Coverage"
            value={formatScore(workspace.workspaceSummary.overallScore)}
          />
          <HeaderMetric label="Graph" value={workspace.graph.readiness} />
        </div>
      </div>
    </section>
  );
}

function HeaderPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
      {label}
    </span>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">
        {value === null || value === undefined ? 'Unknown' : formatLabel(String(value))}
      </p>
    </div>
  );
}

function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'rounded-lg px-3 py-2 text-sm font-semibold transition',
              activeTab === tab.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({
  workspace,
  selectedRow,
  onRowSelect,
  onGapSelect,
  onTabChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  selectedRow: WorkspaceCoverageMatrixRow | null;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div className="space-y-4">
      <LifecycleBar lifecycle={workspace.lifecycle} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <WorkspaceSummaryCard workspace={workspace} />
        <CoverageScoreCard workspace={workspace} />
      </div>
      <ReadinessBreakdownCard
        items={workspace.readinessBreakdown}
        onTabChange={onTabChange}
      />
      <CoverageMatrixCard
        rows={workspace.coverageMatrix}
        selectedRow={selectedRow}
        onRowSelect={onRowSelect}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <RecommendedActionsCard
          actions={workspace.recommendedActions}
          onTabChange={onTabChange}
        />
        <EditorialLearningCard workspace={workspace} />
      </div>
      <CoverageGapsCard gaps={workspace.coverageGaps} onGapSelect={onGapSelect} />
    </div>
  );
}

function LifecycleBar({ lifecycle }: { lifecycle: WorkspaceLifecycle }) {
  const steps: Array<{ key: keyof WorkspaceLifecycle; label: string }> = [
    { key: 'curriculum', label: 'Curriculum' },
    { key: 'brief', label: 'Brief' },
    { key: 'education', label: 'Education' },
    { key: 'cases', label: 'Cases' },
    { key: 'graph', label: 'Graph' },
    { key: 'ready', label: 'Ready' },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-2 md:grid-cols-6">
        {steps.map((step) => (
          <div
            key={step.key}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {step.label}
            </p>
            <div className="mt-2">
              <StatusBadge
                status={formatLabel(lifecycle[step.key])}
                tone={lifecycleTone(lifecycle[step.key])}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkspaceSummaryCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const summary = workspace.workspaceSummary;
  return (
    <CompactPanel title="Workspace summary">
      <MetricGrid
        items={[
          { label: 'Status', value: formatLabel(summary.status) },
          { label: 'Overall score', value: formatScore(summary.overallScore) },
          { label: 'Education score', value: formatScore(summary.educationScore) },
          { label: 'Graph readiness', value: formatSummaryValue(summary.graphReadiness) },
        ]}
      />
      {summary.blockers.length || summary.warnings.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MessageList title="Blockers" tone="blocker" messages={summary.blockers} />
          <MessageList title="Warnings" tone="warning" messages={summary.warnings} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No workspace blockers loaded.</p>
      )}
    </CompactPanel>
  );
}

function CoverageScoreCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const counts = workspace.coverageMatrix.reduce(
    (acc, row) => {
      acc[row.fullCoverageStatus] = (acc[row.fullCoverageStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const total = workspace.coverageMatrix.length;
  const covered = counts.covered ?? 0;

  return (
    <CompactPanel title="Coverage control">
      <div className="rounded-lg border border-slate-900 bg-slate-950 p-4 text-white">
        <p className="text-sm font-semibold text-slate-300">Full coverage</p>
        <p className="mt-2 text-3xl font-semibold">
          {total ? `${covered}/${total}` : '0/0'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {total
            ? `${Math.round((covered / total) * 100)}% of teaching rules fully covered`
            : 'No teaching rules are available yet.'}
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <CoverageCount label="Partial" value={counts.partial ?? 0} />
        <CoverageCount label="Missing" value={counts.missing ?? 0} />
        <CoverageCount label="Unknown" value={counts.unknown ?? 0} />
      </div>
    </CompactPanel>
  );
}

function CoverageCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ReadinessBreakdownCard({
  items,
  onTabChange,
}: {
  items: WorkspaceReadinessItem[];
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const sortedItems = [...items].sort(
    (left, right) => severityRank(left.severity) - severityRank(right.severity),
  );

  return (
    <CompactPanel title="Readiness breakdown">
      {sortedItems.length ? (
        <div className="space-y-2">
          {sortedItems.slice(0, 12).map((item, index) => (
            <button
              key={`${item.actionId}-${index}`}
              type="button"
              onClick={() => onTabChange(item.targetTab)}
              className={[
                'w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-slate-50',
                item.severity === 'blocker'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : item.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-700',
              ].join(' ')}
            >
              <span className="mr-2 inline-flex min-w-20 justify-center rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold uppercase">
                {formatLabel(item.severity)}
              </span>
              <span className="font-semibold">{formatLabel(item.source)}:</span>
              <span className="ml-1">{item.message}</span>
              <span className="ml-2 text-xs opacity-75">
                {formatLabel(item.targetTab)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No readiness issues reported.</p>
      )}
    </CompactPanel>
  );
}

function CoverageMatrixCard({
  rows,
  selectedRow,
  onRowSelect,
}: {
  rows: WorkspaceCoverageMatrixRow[];
  selectedRow: WorkspaceCoverageMatrixRow | null;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
}) {
  if (!rows.length) {
    return (
      <CompactPanel title="Coverage matrix">
        <p className="text-sm text-slate-500">
          No curriculum coverage rows are available yet.
        </p>
      </CompactPanel>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">
              Coverage matrix
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Curriculum coverage across education, cases, and graph support.
            </p>
          </div>
          <StatusBadge status={`${rows.length} rules`} tone="info" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Teaching rule</th>
              <th className="px-4 py-3">Education</th>
              <th className="px-4 py-3">Cases</th>
              <th className="px-4 py-3">Graph</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const selected =
                selectedRow?.stableKey === row.stableKey ||
                selectedRow?.teachingRuleId === row.teachingRuleId;
              const compositeStatus = coverageCompositeStatus(row);

              return (
              <tr
                key={`${row.stableKey}-${row.teachingRuleId ?? 'legacy'}`}
                className={[
                  'cursor-pointer transition hover:bg-slate-50',
                  selected ? 'bg-cyan-50/70 ring-1 ring-inset ring-cyan-200' : '',
                ].join(' ')}
                onClick={() => onRowSelect(row)}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRowSelect(row);
                    }}
                  >
                    <span className="block font-medium text-slate-900">
                      {row.title}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {formatLabel(row.category)} - {formatLabel(row.importance)}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <CoverageStatusPill status={row.educationCoverage} />
                </td>
                <td className="px-4 py-3">
                  <CoverageStatusPill status={row.caseCoverage} />
                </td>
                <td className="px-4 py-3">
                  <CoverageStatusPill status={row.graphCoverage} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={compositeStatus.label}
                    tone={compositeStatus.tone}
                  />
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-600">
                  {row.recommendedAction}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CoverageGapsCard({
  gaps,
  onGapSelect,
}: {
  gaps: WorkspaceCoverageGap[];
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
}) {
  return (
    <CompactPanel title="Coverage gaps">
      {gaps.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {gaps.slice(0, 10).map((gap, index) => (
            <button
              key={`${gap.teachingRuleId ?? gap.title}-${index}`}
              type="button"
              onClick={() => onGapSelect(gap)}
              className={[
                'rounded-lg border px-3 py-2 text-left transition hover:bg-slate-50',
                gap.severity === 'blocker'
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-amber-200 bg-amber-50',
              ].join(' ')}
            >
              <p className="text-sm font-semibold text-slate-900">{gap.title}</p>
              <p className="mt-1 text-xs text-slate-600">
                {gap.recommendedAction}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {[
                  gap.missingEducation ? 'education' : null,
                  gap.missingCases ? 'cases' : null,
                  gap.missingGraph ? 'graph' : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              <span className="mt-2 inline-flex text-xs font-semibold text-slate-700">
                Open {formatLabel(gap.targetTab)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No coverage gaps reported.</p>
      )}
    </CompactPanel>
  );
}

function RecommendedActionsCard({
  actions,
  onTabChange,
}: {
  actions: WorkspaceRecommendedAction[];
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <CompactPanel title="Recommended actions">
      {actions.length ? (
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={!action.enabled}
              onClick={() => onTabChange(action.targetTab)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-semibold text-slate-900">{action.label}</span>
              {action.disabledReason ? (
                <span className="mt-1 block text-xs text-slate-500">
                  {action.disabledReason}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No recommended actions yet.</p>
      )}
    </CompactPanel>
  );
}

function EditorialLearningCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const counts = workspace.editorialLearning.candidateCounts;
  return (
    <CompactPanel title="Editorial learning">
      <MetricGrid
        items={[
          {
            label: 'Teaching candidates',
            value: counts.teachingRuleCandidates,
          },
          { label: 'Graph candidates', value: counts.graphFactCandidates },
          {
            label: 'Pattern candidates',
            value: counts.patternImprovementCandidates,
          },
          {
            label: 'Pearl candidates',
            value: counts.diagnosisSpecificPearlCandidates,
          },
        ]}
      />
      {workspace.editorialLearning.recentThemes.length ? (
        <ul className="mt-3 space-y-2">
          {workspace.editorialLearning.recentThemes.map((theme) => (
            <li key={theme} className="text-sm text-slate-700">
              {theme}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Learning signals will appear after enough revision history exists.
        </p>
      )}
    </CompactPanel>
  );
}

function EditorialBriefSummaryCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  return (
    <CompactPanel title="Unified brief summary">
      <MetricGrid
        items={[
          { label: 'Status', value: workspace.editorialBrief.status ?? 'Missing' },
          { label: 'Version', value: workspace.editorialBrief.version ?? 'None' },
          {
            label: 'Generation',
            value: workspace.editorialBrief.activeForGeneration
              ? 'Active'
              : 'Inactive',
          },
          {
            label: 'Updated',
            value: workspace.editorialBrief.updatedAt
              ? formatDate(workspace.editorialBrief.updatedAt)
              : 'Unknown',
          },
        ]}
      />
      {workspace.editorialBrief.summary ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {workspace.editorialBrief.summary}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No editorial brief summary exists yet.
        </p>
      )}
    </CompactPanel>
  );
}

function EducationTab({
  workspace,
  revisions,
  revisionCompare,
  revisionCompareLoading,
  revisionCompareError,
  compareFromVersion,
  compareToVersion,
  pendingAction,
  onRegenerateSection,
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
  onRegenerateSection: (section: EducationRegenerableSection) => void;
  onFromVersionChange: (version: number | null) => void;
  onToVersionChange: (version: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      <EducationQualityCard
        workspace={workspace}
        pendingAction={pendingAction}
        onRegenerateSection={onRegenerateSection}
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

function CasesTab({
  workspace,
  coverage,
  mimicCandidates,
  pendingAction,
  generatedTargetedCase,
  onGapSelect,
  onGenerateTargetedCase,
}: {
  workspace: DiagnosisEditorialWorkspace;
  coverage: TeachingUnitCoverageMap | null;
  mimicCandidates: DiagnosisGraphCandidate[];
  pendingAction: string | null;
  generatedTargetedCase: GenerateTargetedCaseResult['generatedCase'] | null;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onGenerateTargetedCase: (payload: GenerateTargetedCasePayload) => void;
}) {
  const caseGaps = workspace.coverageGaps.filter((gap) => gap.missingCases);

  return (
    <div className="space-y-4">
      <CompactPanel title="Case inventory">
        <MetricGrid
          items={[
            { label: 'Total', value: workspace.cases.summary.total },
            { label: 'Usable', value: workspace.cases.summary.usable },
            { label: 'Warnings', value: workspace.cases.summary.warningCount },
            { label: 'Blockers', value: workspace.cases.summary.blockerCount },
          ]}
        />
        {workspace.cases.summary.latest ? (
          <Link
            to={`/cases/${workspace.cases.summary.latest.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-slate-900 underline"
          >
            Open latest case
          </Link>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No cases are attached to this diagnosis yet.
          </p>
        )}
      </CompactPanel>
      <CaseContributionCard workspace={workspace} />
      <CoverageGapsCard gaps={caseGaps} onGapSelect={onGapSelect} />
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
              className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {caseItem.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatLabel(caseItem.difficulty)} difficulty
                  </p>
                </div>
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
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="text-slate-600">
                  Warnings: {caseItem.qualityProjection.warnings.length}
                </span>
                <span className="text-slate-600">
                  Blockers: {caseItem.qualityProjection.blockers.length}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No cases are available in the unified workspace payload.
        </p>
      )}
    </CompactPanel>
  );
}

function GraphTab({
  workspace,
  selectedRow,
  onRowSelect,
}: {
  workspace: DiagnosisEditorialWorkspace;
  selectedRow: WorkspaceCoverageMatrixRow | null;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
}) {
  return (
    <div className="space-y-4">
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
      <CoverageMatrixCard
        rows={workspace.coverageMatrix.filter(
          (row) => row.graphCoverage !== 'covered',
        )}
        selectedRow={selectedRow}
        onRowSelect={onRowSelect}
      />
      <GraphCandidateList candidates={workspace.graph.candidates} />
    </div>
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

function WorkspaceRail({
  workspace,
  onGapSelect,
  onTabChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <aside className="space-y-4">
      <RecommendedActionsCard
        actions={workspace.recommendedActions}
        onTabChange={onTabChange}
      />
      <CoverageGapsCard gaps={workspace.coverageGaps} onGapSelect={onGapSelect} />
      <AvailableActionsCard actions={workspace.availableActions} />
    </aside>
  );
}

function AvailableActionsCard({ actions }: { actions: WorkspaceAvailableAction[] }) {
  return (
    <CompactPanel title="Available actions">
      {actions.length ? (
        <div className="space-y-2">
          {actions.map((action) => (
            <div
              key={action.id}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <p className="font-semibold text-slate-900">{action.label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {action.enabled ? formatLabel(action.targetTab) : action.disabledReason}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No actions advertised.</p>
      )}
    </CompactPanel>
  );
}

function TeachingRuleDrawer({
  row,
  workspace,
  onClose,
  onAction,
}: {
  row: WorkspaceCoverageMatrixRow;
  workspace: DiagnosisEditorialWorkspace;
  onClose: () => void;
  onAction: (action: RuleDrawerAction) => void;
}) {
  const relatedRule = workspace.teachingRules.items.find(
    (rule) => rule.id === row.teachingRuleId || rule.stableKey === row.stableKey,
  );
  const relatedGaps = workspace.coverageGaps.filter(
    (gap) => gap.teachingRuleId === row.teachingRuleId || gap.title === row.title,
  );
  const sectionHealth = workspace.education.sectionHealth.filter((section) =>
    row.title.toLowerCase().includes(section.section.toLowerCase()),
  );
  const caseCoverageCount = row.caseCoverage === 'covered' ? workspace.cases.summary.usable : 0;
  const graphSupportCount = row.graphCoverage === 'covered' ? workspace.graph.factCount : 0;

  return (
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Teaching Rule Detail
              </p>
              <h3 className="mt-2 text-xl font-semibold">{row.title}</h3>
              <p className="mt-1 break-all font-mono text-xs text-slate-400">
                {row.stableKey}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/15 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DrawerFact label="Category" value={formatLabel(row.category)} />
            <DrawerFact label="Importance" value={formatLabel(row.importance)} />
            <DrawerFact label="Rule status" value={formatLabel(row.ruleStatus)} />
            <DrawerFact label="Coverage" value={coverageCompositeStatus(row).label} />
          </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <CoverageStatusBlock label="Education" status={row.educationCoverage} />
          <CoverageStatusBlock label="Cases" status={row.caseCoverage} />
          <CoverageStatusBlock label="Graph" status={row.graphCoverage} />
        </div>

        <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Recommended action</p>
          <p className="mt-1 text-sm text-slate-700">{row.recommendedAction}</p>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Related signals</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DrawerFact
              label="Education sections"
              value={sectionHealth.length ? String(sectionHealth.length) : 'Not mapped'}
            />
            <DrawerFact
              label="Case support"
              value={
                row.caseCoverage === 'unknown'
                  ? 'Not assessed'
                  : `${caseCoverageCount} usable`
              }
            />
            <DrawerFact
              label="Graph support"
              value={
                row.graphCoverage === 'unknown'
                  ? 'Not assessed'
                  : `${graphSupportCount} facts`
              }
            />
          </div>
          {relatedRule?.rationale ? (
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {relatedRule.rationale}
            </p>
          ) : null}
          {relatedGaps.length ? (
            <div className="mt-3 space-y-2">
              {relatedGaps.map((gap) => (
                <div
                  key={`${gap.title}-${gap.targetTab}`}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  {gap.recommendedAction}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Actions</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DrawerActionButton
              label="Go to Education"
              onClick={() => onAction('education')}
            />
            <DrawerActionButton
              label="Generate Targeted Case"
              onClick={() => onAction('generate-case')}
            />
            <DrawerActionButton
              label="Review Graph"
              onClick={() => onAction('review-graph')}
            />
            <DrawerActionButton
              label="Edit / Review Rule"
              onClick={() => onAction('edit-rule')}
            />
          </div>
        </section>
        </div>
      </aside>
  );
}

function DrawerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function CoverageStatusBlock({
  label,
  status,
}: {
  label: string;
  status: WorkspaceCoverageMatrixRow['educationCoverage'];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <div className="mt-2">
        <CoverageStatusPill status={status} />
      </div>
    </div>
  );
}

function DrawerActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function CompactPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {item.value === null || item.value === undefined ? 'Unknown' : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function MessageList({
  title,
  tone,
  messages,
}: {
  title: string;
  tone: 'warning' | 'blocker';
  messages: string[];
}) {
  return (
    <div
      className={[
        'rounded-lg border px-3 py-2',
        tone === 'blocker'
          ? 'border-rose-200 bg-rose-50'
          : 'border-amber-200 bg-amber-50',
      ].join(' ')}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {messages.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {messages.slice(0, 5).map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None</p>
      )}
    </div>
  );
}

function CoverageStatusPill({
  status,
}: {
  status: WorkspaceCoverageMatrixRow['educationCoverage'];
}) {
  const tone =
    status === 'covered'
      ? 'success'
      : status === 'missing'
        ? 'danger'
        : status === 'partial'
          ? 'warning'
          : 'neutral';

  return <StatusBadge status={formatLabel(status)} tone={tone} />;
}

function AccessDenied({ access }: { access: ConsoleAccessState }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Access Restricted
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Editorial access required
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Current role: <span className="font-semibold">{access.role}</span>.
          Editorial workspaces are available to editor, senior_editor, and admin
          roles.
        </p>
      </section>
    </div>
  );
}

function toTeachingRulesResponse(
  workspace: DiagnosisEditorialWorkspace | null,
): DiagnosisTeachingRulesResponse | null {
  if (!workspace) {
    return null;
  }

  return {
    diagnosisRegistryId: workspace.diagnosis.id,
    diagnosisName: workspace.diagnosis.displayLabel,
    rules: workspace.teachingRules.items,
  };
}

function toTeachingUnitCoverageMap(
  workspace: DiagnosisEditorialWorkspace | null,
): TeachingUnitCoverageMap | null {
  if (!workspace) {
    return null;
  }

  return {
    diagnosisRegistryId: workspace.diagnosis.id,
    diagnosisName: workspace.diagnosis.displayLabel,
    teachingUnits: workspace.coverageMatrix.map((row) => ({
      id: row.stableKey,
      title: row.title,
      source: 'unified_workspace',
      status: row.fullCoverageStatus,
      educationCoverage: row.educationCoverage,
      caseCoverage: {
        count: row.caseCoverage === 'covered' ? 1 : 0,
        status: row.caseCoverage,
      },
      graphCoverage: row.graphCoverage,
      relatedSections: [],
      relatedCaseIds: [],
      relatedGraphFactIds: [],
      warnings: [],
      recommendedAction: row.recommendedAction,
    })),
  };
}

function sortRevisionsNewestFirst(revisionList: DiagnosisEducationRevisionAnalysis[]) {
  return [...revisionList].sort((left, right) => {
    if (right.version !== left.version) {
      return right.version - left.version;
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function lifecycleTone(state: WorkspaceLifecycleState) {
  if (state === 'complete') return 'success';
  if (state === 'blocked') return 'danger';
  if (state === 'warning') return 'warning';
  return 'neutral';
}

function severityRank(severity: WorkspaceReadinessItem['severity']) {
  if (severity === 'blocker') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function coverageCompositeStatus(row: WorkspaceCoverageMatrixRow): {
  label: string;
  tone: StatusBadgeTone;
} {
  if (row.fullCoverageStatus === 'covered') {
    return { label: 'Complete', tone: 'success' };
  }
  if (row.fullCoverageStatus === 'unknown') {
    return { label: 'Not started', tone: 'neutral' };
  }
  if (row.educationCoverage === 'missing') {
    return { label: 'Missing education', tone: 'danger' };
  }
  if (row.graphCoverage === 'missing') {
    return { label: 'Missing graph', tone: 'warning' };
  }
  if (row.caseCoverage === 'missing') {
    return { label: 'Missing assessment', tone: 'warning' };
  }
  return { label: 'Partial', tone: 'warning' };
}

function findCoverageRowForGap(
  workspace: DiagnosisEditorialWorkspace | null,
  gap: WorkspaceCoverageGap,
) {
  return (
    workspace?.coverageMatrix.find(
      (row) =>
        row.teachingRuleId === gap.teachingRuleId || row.title === gap.title,
    ) ?? null
  );
}

function getCoverageRowKey(row: WorkspaceCoverageMatrixRow) {
  return row.teachingRuleId ?? row.stableKey;
}

function caseTone(
  caseItem: DiagnosisEditorialWorkspace['cases']['items'][number],
): StatusBadgeTone {
  if (caseItem.qualityProjection.blockers.length) return 'danger';
  if (caseItem.qualityProjection.warnings.length) return 'warning';
  if (
    caseItem.editorialStatus === 'APPROVED' ||
    caseItem.editorialStatus === 'READY_TO_PUBLISH' ||
    caseItem.editorialStatus === 'PUBLISHED'
  ) {
    return 'success';
  }
  return 'neutral';
}

function formatSummaryValue(value: string | number | null | undefined) {
  return typeof value === 'number' ? formatScore(value) : value ?? 'Unknown';
}

function formatScore(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Unknown';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
