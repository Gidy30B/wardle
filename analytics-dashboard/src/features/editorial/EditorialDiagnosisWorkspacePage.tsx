import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  compareDiagnosisEducationRevisions,
  createCaseEscalationAnnotation,
  createCaseDiscriminatorAnnotation,
  createCaseLearningGoalCoverage,
  createDiagnosisEditorialBrief,
  createDiagnosisTeachingRule,
  decideAiDraftRevision,
  deleteCaseEscalationAnnotation,
  deleteCaseDiscriminatorAnnotation,
  deleteCaseLearningGoalCoverage,
  generateCaseFromUncoveredGoal,
  generateClueRevisionProposalDraft,
  generateDiagnosisEditorialBrief,
  generateDiagnosisTeachingRuleCandidates,
  generateTargetedDiscriminatorCaseDraft,
  getDiagnosisEditorialBrief,
  getDiagnosisEditorialWorkspace,
  normalizeDiagnosisRegistryLifecycleRow,
  regenerateDiagnosisEducationSection,
  repairUnsupportedClaimDraft,
  applyCaseClueRevisionDraft,
  approveCaseClueRevisionDraft,
  rejectCaseClueRevisionDraft,
  requestChangesForCaseClueRevisionDraft,
  reviewDiagnosisEditorialBrief,
  reviewDiagnosisTeachingRule,
  seedLegacyDiagnosisTeachingRules,
  supersedeCaseClueRevisionDraft,
  updateDiagnosisRegistryLifecycle,
  updateDiagnosisEditorialBrief,
  updateCaseClueRevisionDraft,
  updateDiagnosisTeachingRule,
  updateCaseEscalationAnnotation,
  updateCaseDiscriminatorAnnotation,
  updateCaseLearningGoalCoverage,
  type DiagnosisEditorialBriefResponse,
  type DiagnosisEditorialBriefReviewAction,
  type DiagnosisEditorialBriefWritePayload,
  type DiagnosisEditorialWorkspace,
  type ClaimRepairResult,
  type AiDraftDecisionAction,
  type CaseEscalationAnnotationPayload,
  type CaseClueRevisionDraftPayload,
  type CreateCaseClueDiscriminatorAnnotationPayload,
  type UpdateCaseClueDiscriminatorAnnotationPayload,
  type CaseLearningGoalCoveragePayload,
  type DiagnosisRegistryLifecycleAction,
  type DiagnosisEducationRevisionCompareResult,
  type DiagnosisTeachingRuleReviewAction,
  type DiagnosisTeachingRuleWritePayload,
  type EducationRegenerableSection,
  type GenerateTargetedCasePayload,
  type GenerateClueRevisionProposalPayload,
  type GenerateTargetedDiscriminatorCasePayload,
  type GenerateTargetedCaseResult,
  type WorkspaceCoverageGap,
  type WorkspaceCoverageMatrixRow,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ActionFeedback from '../../components/ui/ActionFeedback';
import ErrorState from '../../components/ui/ErrorState';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import {
  useConsoleAccess,
  type ConsoleAccessState,
} from '../../hooks/useConsoleAccess';
import {
  CoverageStatusBlock,
  DrawerActionButton,
  WorkspaceLoadingSkeleton,
} from './workspace/EditorialPrimitives';
import { EditorialRightRail } from './workspace/EditorialRightRail';
import { TabBar, WorkspaceHeader } from './workspace/WorkspaceHeader';
import { CasesTab } from './workspace/tabs/CasesTab';
import { ClinicalPictureTab } from './workspace/tabs/ClinicalPictureTab';
import { DifferentialMapTab } from './workspace/tabs/DifferentialMapTab';
import { IntegrityTab } from './workspace/tabs/IntegrityTab';
import { ObjectivesTab } from './workspace/tabs/ObjectivesTab';
import { OverviewTab } from './workspace/tabs/OverviewTab';
import { TeachingLearningTab } from './workspace/tabs/TeachingLearningTab';
import {
  coverageCompositeStatus,
  errorMessage,
  findCoverageRowForGap,
  formatLabel,
  getCoverageRowKey,
  sortRevisionsNewestFirst,
  toTeachingRulesResponse,
  toTeachingUnitCoverageMap,
} from './workspace/workspaceTransforms';
import type {
  RuleDrawerAction,
  WorkspaceTab,
} from './workspace/workspaceTypes';
import {
  getClaimTarget,
  hasClaimTarget,
  normalizeWorkspaceTab,
} from './workspace/workspaceDeepLinks';

export default function EditorialDiagnosisWorkspacePage() {
  const { diagnosisRegistryId } = useParams<{ diagnosisRegistryId: string }>();
  const access = useConsoleAccess();
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [searchParams, setSearchParams] = useSearchParams();
  const claimTarget = useMemo(() => getClaimTarget(searchParams), [searchParams]);
  const hasExplicitClaimTarget = hasClaimTarget(claimTarget);
  const activeTab: WorkspaceTab = normalizeWorkspaceTab(searchParams.get('tab'));
  const setActiveTab = (tab: WorkspaceTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };
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
  const [claimRepairs, setClaimRepairs] = useState<Record<string, ClaimRepairResult>>(
    {},
  );
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
  const targetedUnsupportedClaim = useMemo(() => {
    if (!workspace || !hasExplicitClaimTarget) {
      return null;
    }
    return (
      workspace.unsupportedClaimsBySection?.find((claim) => {
        const claimMatches =
          !claimTarget.claimId || claim.claimId === claimTarget.claimId;
        const sectionMatches =
          !claimTarget.sectionId || claim.sectionId === claimTarget.sectionId;
        return claimMatches && sectionMatches;
      }) ?? null
    );
  }, [claimTarget.claimId, claimTarget.sectionId, hasExplicitClaimTarget, workspace]);
  const showClaimTargetUnavailable =
    Boolean(workspace) &&
    hasExplicitClaimTarget &&
    activeTab === 'integrity' &&
    !targetedUnsupportedClaim;

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
    if (!diagnosisRegistryId) {
      return;
    }
    const key = `editorial-workspace-scroll:${diagnosisRegistryId}:${activeTab}`;
    if (hasExplicitClaimTarget) {
      return;
    }
    const saved = Number(sessionStorage.getItem(key) ?? 0);
    if (saved > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: saved }));
    }

    return () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [activeTab, diagnosisRegistryId, hasExplicitClaimTarget]);

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

  function handleLifecycleAction(action: DiagnosisRegistryLifecycleAction) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: `lifecycle-${action}`,
      pending: 'Updating registry lifecycle...',
      success: 'Registry lifecycle updated.',
      action: () =>
        updateDiagnosisRegistryLifecycle(client, diagnosisRegistryId, action),
    });
  }

  function handleNormalizeLifecycleFlags() {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: 'lifecycle-normalize',
      pending: 'Normalizing lifecycle flags...',
      success: 'Lifecycle flags normalized safely.',
      action: () =>
        normalizeDiagnosisRegistryLifecycleRow(client, diagnosisRegistryId),
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
        const result = await generateCaseFromUncoveredGoal(
          client,
          diagnosisRegistryId,
          payload,
        );
        setGeneratedTargetedCase(result.result.generatedCase);
      },
    });
  }

  function handleGenerateDiscriminatorCase(
    payload: GenerateTargetedDiscriminatorCasePayload,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: `discriminator-case-${payload.target.mimicDiagnosisId ?? payload.target.mimicName}`,
      pending: 'Generating discriminator case draft...',
      success: 'Discriminator case draft created for review.',
      action: async () => {
        const result = await generateTargetedDiscriminatorCaseDraft(
          client,
          diagnosisRegistryId,
          payload,
        );
        setGeneratedTargetedCase(result.result.generatedCase);
        return result;
      },
    });
  }

  function handleGenerateClueRevision(
    payload: GenerateClueRevisionProposalPayload,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: `clue-revision-${payload.target.mimicDiagnosisId ?? payload.target.mimicName}`,
      pending: 'Generating clue revision draft...',
      success: 'Clue revision draft created for review.',
      action: () =>
        generateClueRevisionProposalDraft(client, diagnosisRegistryId, payload),
    });
  }

  function handleRepairUnsupportedClaim(claim: {
    artifactId: string;
    sourceType: string;
    claimId: string;
    sectionId: string;
  }) {
    if (!diagnosisRegistryId) {
      return;
    }

    void runWorkspaceAction({
      id: `repair-claim-${claim.claimId}`,
      pending: 'Refreshing unsupported claim validation...',
      success: 'Draft claim repair created for editor review.',
      action: async () => {
        const repair = await repairUnsupportedClaimDraft(
          client,
          diagnosisRegistryId,
          { claimId: claim.claimId },
        );
        setClaimRepairs((current) => ({
          ...current,
          [claimRepairKey(claim.sectionId, claim.claimId)]: repair,
        }));
        return repair;
      },
    });
  }

  function handleInlineClaimRepairDecision(
    claim: { sectionId: string; claimId: string },
    repair: ClaimRepairResult,
    action: AiDraftDecisionAction,
    note?: string,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }
    const auditId = repair.auditId ?? repair.repairId ?? repair.revisionId;
    void runWorkspaceAction({
      id: `claim-repair-${auditId}-${action}`,
      pending: `${formatLabel(action)} repair...`,
      success: `Repair ${formatLabel(action)}.`,
      action: async () => {
        const result = await decideAiDraftRevision(
          client,
          diagnosisRegistryId,
          auditId,
          action,
          { note },
        );
        setClaimRepairs((current) => ({
          ...current,
          [claimRepairKey(claim.sectionId, claim.claimId)]: {
            ...repair,
            reviewStatus: result.reviewStatus,
          },
        }));
        await refreshWorkspace();
        return result;
      },
    });
  }

  function handleAiDraftDecision(
    auditId: string,
    action: AiDraftDecisionAction,
    note?: string,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }

    void runWorkspaceAction({
      id: `ai-draft-${action}-${auditId}`,
      pending: 'Saving draft review decision...',
      success: 'Draft review decision saved.',
      action: () =>
        decideAiDraftRevision(client, diagnosisRegistryId, auditId, action, {
          note,
        }),
    });
  }

  function handleUpdateClueRevisionDraft(
    draftId: string,
    payload: CaseClueRevisionDraftPayload,
  ) {
    void runWorkspaceAction({
      id: `clue-revision-update-${draftId}`,
      pending: 'Updating clue revision draft...',
      success: 'Clue revision draft updated.',
      action: () => updateCaseClueRevisionDraft(client, draftId, payload),
    });
  }

  function handleApproveClueRevisionDraft(draftId: string, note?: string) {
    void runWorkspaceAction({
      id: `clue-revision-approve-${draftId}`,
      pending: 'Approving clue revision draft...',
      success: 'Clue revision draft approved.',
      action: () => approveCaseClueRevisionDraft(client, draftId, { note }),
    });
  }

  function handleRejectClueRevisionDraft(draftId: string, note?: string) {
    void runWorkspaceAction({
      id: `clue-revision-reject-${draftId}`,
      pending: 'Rejecting clue revision draft...',
      success: 'Clue revision draft rejected.',
      action: () => rejectCaseClueRevisionDraft(client, draftId, { note }),
    });
  }

  function handleRequestChangesForClueRevisionDraft(
    draftId: string,
    note?: string,
  ) {
    void runWorkspaceAction({
      id: `clue-revision-changes-${draftId}`,
      pending: 'Requesting clue revision changes...',
      success: 'Clue revision draft marked for changes.',
      action: () =>
        requestChangesForCaseClueRevisionDraft(client, draftId, { note }),
    });
  }

  function handleSupersedeClueRevisionDraft(draftId: string, note?: string) {
    void runWorkspaceAction({
      id: `clue-revision-supersede-${draftId}`,
      pending: 'Superseding clue revision draft...',
      success: 'Clue revision draft superseded.',
      action: () => supersedeCaseClueRevisionDraft(client, draftId, { note }),
    });
  }

  function handleApplyClueRevisionDraft(draftId: string) {
    void runWorkspaceAction({
      id: `clue-revision-apply-${draftId}`,
      pending: 'Applying clue revision draft...',
      success: 'Clue revision draft applied to editable case.',
      action: () => applyCaseClueRevisionDraft(client, draftId),
    });
  }

  function handleCreateLearningGoalCoverage(
    payload: CaseLearningGoalCoveragePayload,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: `goal-coverage-${payload.caseId}-${payload.learningGoalId}`,
      pending: 'Saving learning-goal coverage...',
      success: 'Learning-goal coverage saved.',
      action: () =>
        createCaseLearningGoalCoverage(client, diagnosisRegistryId, payload),
    });
  }

  function handleUpdateLearningGoalCoverage(
    coverageId: string,
    payload: CaseLearningGoalCoveragePayload,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: `goal-coverage-update-${coverageId}`,
      pending: 'Updating learning-goal coverage...',
      success: 'Learning-goal coverage updated.',
      action: () =>
        updateCaseLearningGoalCoverage(
          client,
          diagnosisRegistryId,
          coverageId,
          payload,
        ),
    });
  }

  function handleDeleteLearningGoalCoverage(coverageId: string) {
    if (!diagnosisRegistryId) {
      return;
    }
    const confirmed = window.confirm('Remove this learning-goal coverage annotation?');
    if (!confirmed) {
      return;
    }
    void runWorkspaceAction({
      id: `goal-coverage-delete-${coverageId}`,
      pending: 'Removing learning-goal coverage...',
      success: 'Learning-goal coverage removed.',
      action: () =>
        deleteCaseLearningGoalCoverage(client, diagnosisRegistryId, coverageId),
    });
  }

  function handleCreateEscalationAnnotation(
    payload: CaseEscalationAnnotationPayload,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: `escalation-coverage-${payload.caseId}-${payload.escalationType}`,
      pending: 'Saving escalation annotation...',
      success: 'Escalation annotation saved.',
      action: () =>
        createCaseEscalationAnnotation(client, diagnosisRegistryId, payload),
    });
  }

  function handleUpdateEscalationAnnotation(
    annotationId: string,
    payload: CaseEscalationAnnotationPayload,
  ) {
    if (!diagnosisRegistryId) {
      return;
    }
    void runWorkspaceAction({
      id: `escalation-coverage-update-${annotationId}`,
      pending: 'Updating escalation annotation...',
      success: 'Escalation annotation updated.',
      action: () =>
        updateCaseEscalationAnnotation(
          client,
          diagnosisRegistryId,
          annotationId,
          payload,
        ),
    });
  }

  function handleDeleteEscalationAnnotation(annotationId: string) {
    if (!diagnosisRegistryId) {
      return;
    }
    const confirmed = window.confirm('Remove this escalation annotation?');
    if (!confirmed) {
      return;
    }
    void runWorkspaceAction({
      id: `escalation-coverage-delete-${annotationId}`,
      pending: 'Removing escalation annotation...',
      success: 'Escalation annotation removed.',
      action: () =>
        deleteCaseEscalationAnnotation(client, diagnosisRegistryId, annotationId),
    });
  }

  function handleCreateDiscriminatorAnnotation(
    caseId: string,
    payload: CreateCaseClueDiscriminatorAnnotationPayload,
  ) {
    void runWorkspaceAction({
      id: `discriminator-annotation-${caseId}-${payload.clueOrder}`,
      pending: 'Saving discriminator annotation...',
      success: 'Discriminator annotation saved.',
      action: () => createCaseDiscriminatorAnnotation(client, caseId, payload),
    });
  }

  function handleUpdateDiscriminatorAnnotation(
    caseId: string,
    annotationId: string,
    payload: UpdateCaseClueDiscriminatorAnnotationPayload,
  ) {
    void runWorkspaceAction({
      id: `discriminator-annotation-update-${annotationId}`,
      pending: 'Updating discriminator annotation...',
      success: 'Discriminator annotation updated.',
      action: () =>
        updateCaseDiscriminatorAnnotation(client, caseId, annotationId, payload),
    });
  }

  function handleDeleteDiscriminatorAnnotation(
    caseId: string,
    annotationId: string,
  ) {
    const confirmed = window.confirm('Remove this discriminator annotation?');
    if (!confirmed) {
      return;
    }
    void runWorkspaceAction({
      id: `discriminator-annotation-delete-${annotationId}`,
      pending: 'Removing discriminator annotation...',
      success: 'Discriminator annotation removed.',
      action: () => deleteCaseDiscriminatorAnnotation(client, caseId, annotationId),
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
    return <WorkspaceLoadingSkeleton />;
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
    <div className="space-y-0">
      <WorkspaceHeader workspace={workspace} />
      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      <div className="space-y-5 pt-5">
        <ActionFeedback
          feedback={feedback}
          onDismiss={pendingAction ? undefined : clear}
        />
        {showClaimTargetUnavailable ? (
          <div className="rounded-lg border border-amber-300/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Claim target unavailable</p>
            <p className="mt-1 leading-6 text-amber-100/80">
              The linked unsupported claim is not present in the current
              workspace payload. It may have been repaired, deduped, or replaced
              by a newer validation run.
            </p>
          </div>
        ) : null}

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0 space-y-4">
          {activeTab === 'overview' ? (
            <OverviewTab
              workspace={workspace}
              onGapSelect={openCoverageGap}
              onTabChange={setActiveTab}
              canRunSeniorActions={canRunSeniorActions}
              seniorDisabledReason={seniorDisabledReason}
              pendingAction={pendingAction}
              onLifecycleAction={handleLifecycleAction}
              onNormalizeLifecycleFlags={handleNormalizeLifecycleFlags}
            />
          ) : null}
          {activeTab === 'teaching-rules' ? (
            <TeachingLearningTab
                workspace={workspace}
                rules={rulesResponse}
                loading={loading}
                pendingAction={pendingAction}
                selectedRow={selectedCoverageRow}
                onGenerateCandidates={handleGenerateTeachingRuleCandidates}
                onSeedLegacy={handleSeedLegacyTeachingRules}
                onCreateRule={handleCreateTeachingRule}
                onUpdateRule={handleUpdateTeachingRule}
                onReviewRule={handleReviewTeachingRule}
                canReviewRules={canRunSeniorActions}
                reviewDisabledReason={seniorDisabledReason}
                onRowSelect={openCoverageRow}
              />
          ) : null}
          {activeTab === 'editorial-brief' ? (
            <ObjectivesTab
                workspace={workspace}
                briefDetail={briefDetail}
                teachingRules={rulesResponse}
                loading={briefDetailLoading}
                error={briefDetailError}
                pendingAction={pendingAction}
                canReviewBrief={canRunSeniorActions}
                reviewDisabledReason={seniorDisabledReason}
                onGenerate={handleGenerateEditorialBrief}
                onCreate={handleCreateEditorialBrief}
                onUpdate={handleUpdateEditorialBrief}
                onReview={handleReviewEditorialBrief}
              />
          ) : null}
          {activeTab === 'education' ? (
            <ClinicalPictureTab
              workspace={workspace}
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
                onGenerateDiscriminatorCase={handleGenerateDiscriminatorCase}
                onGenerateClueRevision={handleGenerateClueRevision}
                onAiDraftDecision={handleAiDraftDecision}
                onUpdateClueRevisionDraft={handleUpdateClueRevisionDraft}
                onApproveClueRevisionDraft={handleApproveClueRevisionDraft}
                onRejectClueRevisionDraft={handleRejectClueRevisionDraft}
                onRequestChangesForClueRevisionDraft={
                  handleRequestChangesForClueRevisionDraft
                }
                onSupersedeClueRevisionDraft={handleSupersedeClueRevisionDraft}
                onApplyClueRevisionDraft={handleApplyClueRevisionDraft}
                onCreateLearningGoalCoverage={handleCreateLearningGoalCoverage}
                onCreateEscalationAnnotation={handleCreateEscalationAnnotation}
                onUpdateLearningGoalCoverage={handleUpdateLearningGoalCoverage}
                onDeleteLearningGoalCoverage={handleDeleteLearningGoalCoverage}
                onUpdateEscalationAnnotation={handleUpdateEscalationAnnotation}
                onDeleteEscalationAnnotation={handleDeleteEscalationAnnotation}
                onCreateDiscriminatorAnnotation={handleCreateDiscriminatorAnnotation}
                onUpdateDiscriminatorAnnotation={handleUpdateDiscriminatorAnnotation}
                onDeleteDiscriminatorAnnotation={handleDeleteDiscriminatorAnnotation}
              />
          ) : null}
          {activeTab === 'integrity' ? (
            <IntegrityTab
              workspace={workspace}
              revisions={revisions}
              revisionCompare={revisionCompare}
              revisionCompareLoading={revisionCompareLoading}
              revisionCompareError={revisionCompareError}
              compareFromVersion={compareFromVersion}
              compareToVersion={compareToVersion}
              pendingAction={pendingAction}
              claimRepairs={claimRepairs}
              targetClaimId={claimTarget.claimId}
              targetSectionId={claimTarget.sectionId}
              onRegenerateSection={handleRegenerateSection}
              onRepairUnsupportedClaim={handleRepairUnsupportedClaim}
              onClaimRepairDecision={handleInlineClaimRepairDecision}
              onFromVersionChange={setCompareFromVersion}
              onToVersionChange={setCompareToVersion}
            />
          ) : null}
          {activeTab === 'graph' ? (
            <DifferentialMapTab
              workspace={workspace}
              selectedRow={selectedCoverageRow}
              onRowSelect={openCoverageRow}
              access={access}
              client={client}
              onRefresh={refreshWorkspace}
              onGenerateTargetedCase={handleGenerateTargetedCase}
              onGenerateDiscriminatorCase={handleGenerateDiscriminatorCase}
              onGenerateClueRevision={handleGenerateClueRevision}
              showError={showError}
              showPending={showPending}
              showSuccess={showSuccess}
            />
          ) : null}
          </main>

          <EditorialRightRail
            workspace={workspace}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
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
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[var(--color-navy-border)] bg-[var(--color-navy)] text-slate-100 shadow-2xl">
        <div className="border-b border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] px-5 py-4 text-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-teal)]">
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
              className="rounded-md border border-[var(--color-navy-border)] bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
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

        <section className="mt-5 rounded-lg border border-[var(--color-amber)]/25 bg-[var(--color-amber)]/10 p-4">
          <p className="text-sm font-semibold text-amber-100">Recommended action</p>
          <p className="mt-1 text-sm text-amber-100/80">{row.recommendedAction}</p>
        </section>

        <section className="mt-5 rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-4">
          <p className="text-sm font-semibold text-slate-100">Related signals</p>
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
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {relatedRule.rationale}
            </p>
          ) : null}
          {relatedGaps.length ? (
            <div className="mt-3 space-y-2">
              {relatedGaps.map((gap) => (
                <div
                  key={`${gap.title}-${gap.targetTab}`}
                  className="rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-3 py-2 text-sm text-amber-100"
                >
                  {gap.recommendedAction}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-4">
          <p className="text-sm font-semibold text-slate-100">Actions</p>
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
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2">
      <p className="text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

function claimRepairKey(sectionId: string, claimId: string) {
  return `${sectionId}:${claimId}`;
}

function AccessDenied({ access }: { access: ConsoleAccessState }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <section className="editorial-panel w-full max-w-lg rounded-xl p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-teal)]">
          Access Restricted
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">
          Editorial access required
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Current role: <span className="font-semibold">{access.role}</span>.
          Editorial workspaces are available to editor, senior_editor, and admin
          roles.
        </p>
      </section>
    </div>
  );
}
