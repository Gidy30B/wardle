import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  compareDiagnosisEducationRevisions,
  createDiagnosisEducationForAdmin,
  createDiagnosisEditorialBrief,
  createDiagnosisTeachingRule,
  generateDiagnosisEditorialBrief,
  generateDiagnosisEducationDraft,
  generateDiagnosisTeachingRuleCandidates,
  generateTargetedDiagnosisCase,
  getDiagnosisEditorialBrief,
  getDiagnosisEducationForAdmin,
  getDiagnosisEducationRevisions,
  getDiagnosisGraphCandidates,
  getDiagnosisTeachingRules,
  getDiagnosisTeachingUnitCoverage,
  getDiagnosisWorkspaceProjection,
  getDiagnosisWorkspaceQualitySummary,
  regenerateDiagnosisEducationSection,
  reviewDiagnosisEditorialBrief,
  reviewDiagnosisTeachingRule,
  seedLegacyDiagnosisTeachingRules,
  reviewDiagnosisEducationForAdmin,
  updateDiagnosisEditorialBrief,
  updateDiagnosisTeachingRule,
  updateDiagnosisEducationForAdmin,
  type DiagnosisEditorialBriefResponse,
  type DiagnosisEditorialBriefReviewAction,
  type DiagnosisEditorialBriefWritePayload,
  type DiagnosisTeachingRuleReviewAction,
  type DiagnosisTeachingRulesResponse,
  type DiagnosisTeachingRuleWritePayload,
  type DiagnosisEducationRevisionCompareResult,
  type DiagnosisEducationRevisionAnalysis,
  type EducationRegenerableSection,
  type DiagnosisEducationDifferential,
  type DiagnosisEducationPearl,
  type DiagnosisEducationRecord,
  type DiagnosisEducationStatus,
  type DiagnosisGraphCandidate,
  type StructuredDifferentialLink,
  type DiagnosisWorkspaceProjection,
  type DiagnosisWorkspaceQualitySummary,
  type GenerateTargetedCaseResult,
  type GenerateTargetedCasePayload,
  type TeachingUnitCoverageMap,
  type JsonValue,
  type UpsertDiagnosisEducationPayload,
} from '../../api/admin';
import { ApiError, type ApiClient } from '../../api/client';
import ActionFeedback from '../../components/ui/ActionFeedback';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import CaseDetailSection from './CaseDetailSection';
import { formatDateLabel } from './cases.helpers';
import DiagnosisWorkspaceSummaryCard from './education/DiagnosisWorkspaceSummaryCard';
import EditorialBriefCard from './education/EditorialBriefCard';
import RevisionCompareCard from './education/RevisionCompareCard';
import RevisionHistoryCard from './education/RevisionHistoryCard';
import TargetedCaseGenerationCard from './education/TargetedCaseGenerationCard';
import TeachingRulesCard from './education/TeachingRulesCard';
import TeachingUnitCoverageCard from './education/TeachingUnitCoverageCard';
import WorkspaceQualityCard from './education/WorkspaceQualityCard';

type DiagnosisEducationPanelProps = {
  client: ApiClient;
  diagnosisRegistryId: string | null;
  diagnosisLabel: string;
};

type EducationFormState = {
  title: string;
  definition: string;
  highYieldTakeaway: string;
  clinicalPatternText: string;
  examPearls: DiagnosisEducationPearl[];
  differentials: DiagnosisEducationDifferential[];
  pitfallsText: string;
  referencesText: string;
  scoringSystemsJson: string;
  investigationsJson: string;
  managementJson: string;
  complicationsJson: string;
  recallPromptsJson: string;
};

const emptyForm: EducationFormState = {
  title: '',
  definition: '',
  highYieldTakeaway: '',
  clinicalPatternText: '',
  examPearls: [{ label: '', explanation: '' }],
  differentials: [{ diagnosis: '', distinguishingPoint: '' }],
  pitfallsText: '',
  referencesText: '',
  scoringSystemsJson: '',
  investigationsJson: '',
  managementJson: '',
  complicationsJson: '',
  recallPromptsJson: '',
};

const reviewableStatuses = new Set<DiagnosisEducationStatus>([
  'DRAFT',
  'GENERATED',
  'NEEDS_REVIEW',
  'NEEDS_EDIT',
  'APPROVED',
]);

export default function DiagnosisEducationPanel({
  client,
  diagnosisRegistryId,
  diagnosisLabel,
}: DiagnosisEducationPanelProps) {
  const [education, setEducation] = useState<DiagnosisEducationRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [form, setForm] = useState<EducationFormState>(emptyForm);
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([]);
  const [publishBlockers, setPublishBlockers] = useState<string[]>([]);
  const [workspaceProjection, setWorkspaceProjection] =
    useState<DiagnosisWorkspaceProjection | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceSummary, setWorkspaceSummary] =
    useState<DiagnosisWorkspaceQualitySummary | null>(null);
  const [workspaceSummaryLoading, setWorkspaceSummaryLoading] = useState(false);
  const [workspaceSummaryError, setWorkspaceSummaryError] = useState<string | null>(
    null,
  );
  const [teachingUnitCoverage, setTeachingUnitCoverage] =
    useState<TeachingUnitCoverageMap | null>(null);
  const [teachingUnitCoverageLoading, setTeachingUnitCoverageLoading] =
    useState(false);
  const [teachingUnitCoverageError, setTeachingUnitCoverageError] = useState<
    string | null
  >(null);
  const [teachingRules, setTeachingRules] =
    useState<DiagnosisTeachingRulesResponse | null>(null);
  const [teachingRulesLoading, setTeachingRulesLoading] = useState(false);
  const [teachingRulesError, setTeachingRulesError] = useState<string | null>(
    null,
  );
  const [editorialBrief, setEditorialBrief] =
    useState<DiagnosisEditorialBriefResponse | null>(null);
  const [editorialBriefLoading, setEditorialBriefLoading] = useState(false);
  const [editorialBriefError, setEditorialBriefError] = useState<string | null>(
    null,
  );
  const [mimicCandidates, setMimicCandidates] = useState<
    DiagnosisGraphCandidate[]
  >([]);
  const [generatedTargetedCase, setGeneratedTargetedCase] =
    useState<GenerateTargetedCaseResult['generatedCase'] | null>(null);
  const [revisionHistory, setRevisionHistory] = useState<
    DiagnosisEducationRevisionAnalysis[]
  >([]);
  const [revisionHistoryLoading, setRevisionHistoryLoading] = useState(false);
  const [revisionHistoryError, setRevisionHistoryError] = useState<string | null>(
    null,
  );
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
  const generateInFlightRef = useRef(false);
  const { feedback, clear, showError, showPending, showSuccess } =
    useActionFeedback();

  const isPublished = education?.editorialStatus === 'PUBLISHED';
  const canEdit = !isPublished;
  const canGenerate = Boolean(diagnosisRegistryId);
  const generateLabel = getGenerateActionLabel(education);

  const resetRevisionCompare = useCallback(() => {
    setRevisionCompare(null);
    setRevisionCompareLoading(false);
    setRevisionCompareError(null);
    setCompareFromVersion(null);
    setCompareToVersion(null);
  }, []);

  const applyRevisionHistory = useCallback(
    (revisions: DiagnosisEducationRevisionAnalysis[]) => {
      const sorted = sortRevisionsNewestFirst(revisions);
      setRevisionHistory(sorted);

      if (sorted.length >= 2) {
        setCompareFromVersion(sorted[1].version);
        setCompareToVersion(sorted[0].version);
      } else {
        resetRevisionCompare();
      }
    },
    [resetRevisionCompare],
  );

  useEffect(() => {
    if (!diagnosisRegistryId) {
      setEducation(null);
      setLoadError(null);
      setLoading(false);
      setForm({ ...emptyForm, title: diagnosisLabel });
      setQualityWarnings([]);
      setPublishBlockers([]);
      setWorkspaceProjection(null);
      setWorkspaceLoading(false);
      setWorkspaceError(null);
      setWorkspaceSummary(null);
      setWorkspaceSummaryLoading(false);
      setWorkspaceSummaryError(null);
      setTeachingUnitCoverage(null);
      setTeachingUnitCoverageLoading(false);
      setTeachingUnitCoverageError(null);
      setTeachingRules(null);
      setTeachingRulesLoading(false);
      setTeachingRulesError(null);
      setEditorialBrief(null);
      setEditorialBriefLoading(false);
      setEditorialBriefError(null);
      setMimicCandidates([]);
      setGeneratedTargetedCase(null);
      setRevisionHistory([]);
      setRevisionHistoryLoading(false);
      setRevisionHistoryError(null);
      resetRevisionCompare();
      setEditorOpen(false);
      return;
    }

    let active = true;
    const registryId = diagnosisRegistryId;

    async function loadEducation() {
      try {
        setLoading(true);
        setWorkspaceLoading(true);
        setWorkspaceSummaryLoading(true);
        setTeachingUnitCoverageLoading(true);
        setTeachingRulesLoading(true);
        setEditorialBriefLoading(true);
        setRevisionHistoryLoading(true);
        setLoadError(null);
        setWorkspaceError(null);
        setWorkspaceSummaryError(null);
        setTeachingUnitCoverageError(null);
        setTeachingRulesError(null);
        setEditorialBriefError(null);
        setRevisionHistoryError(null);
        const response = await getDiagnosisEducationForAdmin(client, registryId);
        if (!active) {
          return;
        }

        setEducation(response.education);
        setQualityWarnings(response.qualityWarnings ?? []);
        setPublishBlockers(response.publishBlockers ?? []);
        setForm(toFormState(response.education, response.diagnosisRegistry.canonicalName));
        setEditorOpen(!response.education);

        try {
          const projection = await getDiagnosisWorkspaceProjection(client, registryId);
          if (!active) {
            return;
          }

          setWorkspaceProjection(projection);
        } catch (error) {
          if (!active) {
            return;
          }

          setWorkspaceProjection(null);
          setWorkspaceError(
            error instanceof Error
              ? error.message
            : 'Failed to load editorial quality projection.',
          );
        }

        try {
          const summary = await getDiagnosisWorkspaceQualitySummary(
            client,
            registryId,
          );
          if (!active) {
            return;
          }

          setWorkspaceSummary(summary);
        } catch (error) {
          if (!active) {
            return;
          }

          setWorkspaceSummary(null);
          setWorkspaceSummaryError(
            error instanceof Error
              ? error.message
              : 'Failed to load workspace quality summary.',
          );
        }

        try {
          const coverage = await getDiagnosisTeachingUnitCoverage(
            client,
            registryId,
          );
          if (!active) {
            return;
          }
          setTeachingUnitCoverage(coverage);
        } catch (error) {
          if (!active) {
            return;
          }
          setTeachingUnitCoverage(null);
          setTeachingUnitCoverageError(
            error instanceof Error
              ? error.message
              : 'Failed to load teaching unit coverage.',
          );
        }

        try {
          const rules = await getDiagnosisTeachingRules(client, registryId);
          if (!active) {
            return;
          }
          setTeachingRules(rules);
        } catch (error) {
          if (!active) {
            return;
          }
          setTeachingRules(null);
          setTeachingRulesError(
            error instanceof Error
              ? error.message
              : 'Failed to load teaching rules.',
          );
        }

        try {
          const brief = await getDiagnosisEditorialBrief(client, registryId);
          if (!active) {
            return;
          }
          setEditorialBrief(brief);
        } catch (error) {
          if (!active) {
            return;
          }
          setEditorialBrief(null);
          setEditorialBriefError(
            error instanceof Error
              ? error.message
              : 'Failed to load editorial brief.',
          );
        }

        try {
          const mimics = await getDiagnosisGraphCandidates(client, {
            diagnosisRegistryId: registryId,
            type: 'MIMIC',
          });
          if (!active) {
            return;
          }
          setMimicCandidates(
            mimics.filter(
              (candidate) =>
                candidate.status === 'CANDIDATE' ||
                candidate.status === 'APPROVED',
            ),
          );
        } catch {
          if (!active) {
            return;
          }
          setMimicCandidates([]);
        }

        try {
          const revisions = await getDiagnosisEducationRevisions(client, registryId);
          if (!active) {
            return;
          }

          applyRevisionHistory(revisions.revisions);
        } catch (error) {
          if (!active) {
            return;
          }

          setRevisionHistory([]);
          setRevisionHistoryError(
            error instanceof Error
              ? error.message
              : 'Failed to load revision history.',
          );
          resetRevisionCompare();
        }
      } catch (error) {
        if (!active) {
          return;
        }

        if (
          error instanceof ApiError &&
          error.status === 404 &&
          !error.message.toLowerCase().includes('not available')
        ) {
          setEducation(null);
          setForm({ ...emptyForm, title: diagnosisLabel });
          setQualityWarnings([]);
          setPublishBlockers([]);
          setWorkspaceProjection(null);
          setWorkspaceError(null);
          setWorkspaceSummary(null);
          setWorkspaceSummaryError(null);
          setTeachingUnitCoverage(null);
          setTeachingUnitCoverageError(null);
          setTeachingRules(null);
          setTeachingRulesError(null);
          setEditorialBrief(null);
          setEditorialBriefError(null);
          setMimicCandidates([]);
          setRevisionHistory([]);
          setRevisionHistoryError(null);
          resetRevisionCompare();
          setEditorOpen(true);
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load diagnosis education.',
        );
      } finally {
        if (active) {
          setLoading(false);
          setWorkspaceLoading(false);
          setWorkspaceSummaryLoading(false);
          setTeachingUnitCoverageLoading(false);
          setTeachingRulesLoading(false);
          setEditorialBriefLoading(false);
          setRevisionHistoryLoading(false);
        }
      }
    }

    void loadEducation();

    return () => {
      active = false;
    };
  }, [
    applyRevisionHistory,
    client,
    diagnosisLabel,
    diagnosisRegistryId,
    resetRevisionCompare,
  ]);

  const preview = useMemo(() => toPreview(form, education), [education, form]);

  useEffect(() => {
    if (
      !diagnosisRegistryId ||
      compareFromVersion === null ||
      compareToVersion === null ||
      revisionHistory.length < 2
    ) {
      setRevisionCompare(null);
      setRevisionCompareLoading(false);
      setRevisionCompareError(null);
      return;
    }

    if (compareFromVersion === compareToVersion) {
      setRevisionCompare(null);
      setRevisionCompareLoading(false);
      setRevisionCompareError('Choose two different revisions to compare.');
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
        const result = await compareDiagnosisEducationRevisions(
          client,
          registryId,
          fromVersion,
          toVersion,
        );

        if (!active) {
          return;
        }

        setRevisionCompare(result);
      } catch (error) {
        if (!active) {
          return;
        }

        setRevisionCompare(null);
        setRevisionCompareError(
          error instanceof Error
            ? error.message
            : 'Failed to compare education revisions.',
        );
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
  }, [
    client,
    compareFromVersion,
    compareToVersion,
    diagnosisRegistryId,
    revisionHistory.length,
  ]);

  async function refreshEducation() {
    if (!diagnosisRegistryId) {
      return;
    }

    setWorkspaceLoading(true);
    setWorkspaceSummaryLoading(true);
    setTeachingUnitCoverageLoading(true);
    setTeachingRulesLoading(true);
    setEditorialBriefLoading(true);
    setRevisionHistoryLoading(true);
    setWorkspaceError(null);
    setWorkspaceSummaryError(null);
    setTeachingUnitCoverageError(null);
    setTeachingRulesError(null);
    setEditorialBriefError(null);
    setRevisionHistoryError(null);
    try {
      const response = await getDiagnosisEducationForAdmin(
        client,
        diagnosisRegistryId,
      );
      setEducation(response.education);
      setQualityWarnings(response.qualityWarnings ?? []);
      setPublishBlockers(response.publishBlockers ?? []);
      setForm(toFormState(response.education, response.diagnosisRegistry.canonicalName));
      setEditorOpen(!response.education);

      try {
        const projection = await getDiagnosisWorkspaceProjection(
          client,
          diagnosisRegistryId,
        );
        setWorkspaceProjection(projection);
      } catch (error) {
        setWorkspaceProjection(null);
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : 'Failed to load editorial quality projection.',
        );
      }

      try {
        const summary = await getDiagnosisWorkspaceQualitySummary(
          client,
          diagnosisRegistryId,
        );
        setWorkspaceSummary(summary);
      } catch (error) {
        setWorkspaceSummary(null);
        setWorkspaceSummaryError(
          error instanceof Error
            ? error.message
            : 'Failed to load workspace quality summary.',
        );
      }

      try {
        const coverage = await getDiagnosisTeachingUnitCoverage(
          client,
          diagnosisRegistryId,
        );
        setTeachingUnitCoverage(coverage);
      } catch (error) {
        setTeachingUnitCoverage(null);
        setTeachingUnitCoverageError(
          error instanceof Error
            ? error.message
          : 'Failed to load teaching unit coverage.',
        );
      }

      try {
        const rules = await getDiagnosisTeachingRules(client, diagnosisRegistryId);
        setTeachingRules(rules);
      } catch (error) {
        setTeachingRules(null);
        setTeachingRulesError(
          error instanceof Error ? error.message : 'Failed to load teaching rules.',
        );
      }

      try {
        const brief = await getDiagnosisEditorialBrief(client, diagnosisRegistryId);
        setEditorialBrief(brief);
      } catch (error) {
        setEditorialBrief(null);
        setEditorialBriefError(
          error instanceof Error ? error.message : 'Failed to load editorial brief.',
        );
      }

      try {
        const mimics = await getDiagnosisGraphCandidates(client, {
          diagnosisRegistryId,
          type: 'MIMIC',
        });
        setMimicCandidates(
          mimics.filter(
            (candidate) =>
              candidate.status === 'CANDIDATE' ||
              candidate.status === 'APPROVED',
          ),
        );
      } catch {
        setMimicCandidates([]);
      }

      try {
        const revisions = await getDiagnosisEducationRevisions(
          client,
          diagnosisRegistryId,
        );
        applyRevisionHistory(revisions.revisions);
      } catch (error) {
        setRevisionHistory([]);
        setRevisionHistoryError(
          error instanceof Error ? error.message : 'Failed to load revision history.',
        );
        resetRevisionCompare();
      }
    } finally {
      setWorkspaceLoading(false);
      setWorkspaceSummaryLoading(false);
      setTeachingUnitCoverageLoading(false);
      setTeachingRulesLoading(false);
      setEditorialBriefLoading(false);
      setRevisionHistoryLoading(false);
    }
  }

  async function runAction(config: {
    id: string;
    pending: string;
    success: string;
    action: () => Promise<unknown>;
  }) {
    try {
      setPendingAction(config.id);
      showPending(config.pending);
      await config.action();
      await refreshEducation();
      showSuccess(config.success);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Action failed.');
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerate() {
    if (
      generateInFlightRef.current ||
      pendingAction !== null ||
      !diagnosisRegistryId ||
      !canGenerate
    ) {
      return;
    }

    generateInFlightRef.current = true;
    setPendingAction('generate');
    const confirmed = window.confirm(
      getGenerateConfirmationMessage(education, diagnosisLabel),
    );
    if (!confirmed) {
      generateInFlightRef.current = false;
      setPendingAction(null);
      return;
    }

    try {
      await runAction({
        id: 'generate',
        pending: education
          ? 'Regenerating education draft...'
          : 'Generating education draft...',
        success: 'New education draft version generated for review.',
        action: () => generateDiagnosisEducationDraft(client, diagnosisRegistryId),
      });
    } finally {
      generateInFlightRef.current = false;
    }
  }

  async function handleGenerateTargetedCase(payload: GenerateTargetedCasePayload) {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return;
    }

    try {
      setPendingAction('targeted-case');
      showPending('Generating targeted case...');
      const result = await generateTargetedDiagnosisCase(
        client,
        diagnosisRegistryId,
        payload,
      );
      setGeneratedTargetedCase(result.generatedCase);
      await refreshEducation();
      showSuccess('Targeted case generated for review.');
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Failed to generate targeted case.',
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateTeachingRuleCandidates() {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return false;
    }

    return runAction({
      id: 'teaching-rule-generate',
      pending: 'Generating teaching rule candidates...',
      success: 'Teaching rule candidates generated for review.',
      action: () =>
        generateDiagnosisTeachingRuleCandidates(client, diagnosisRegistryId),
    });
  }

  async function handleSeedLegacyTeachingRules() {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return false;
    }

    return runAction({
      id: 'teaching-rule-seed',
      pending: 'Seeding legacy teaching rules...',
      success: 'Legacy teaching rules seeded for this diagnosis.',
      action: () => seedLegacyDiagnosisTeachingRules(client, diagnosisRegistryId),
    });
  }

  async function handleCreateTeachingRule(
    payload: DiagnosisTeachingRuleWritePayload,
  ) {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return false;
    }

    return runAction({
      id: 'teaching-rule-create',
      pending: 'Creating teaching rule...',
      success: 'Teaching rule created.',
      action: () =>
        createDiagnosisTeachingRule(client, diagnosisRegistryId, payload),
    });
  }

  async function handleUpdateTeachingRule(
    ruleId: string,
    payload: DiagnosisTeachingRuleWritePayload,
  ) {
    if (pendingAction !== null) {
      return false;
    }

    return runAction({
      id: 'teaching-rule-update',
      pending: 'Updating teaching rule...',
      success: 'Teaching rule updated.',
      action: () => updateDiagnosisTeachingRule(client, ruleId, payload),
    });
  }

  async function handleReviewTeachingRule(
    ruleId: string,
    action: DiagnosisTeachingRuleReviewAction,
  ) {
    if (pendingAction !== null) {
      return false;
    }

    return runAction({
      id: `teaching-rule-${action}`,
      pending: 'Updating teaching rule status...',
      success: 'Teaching rule status updated.',
      action: () => reviewDiagnosisTeachingRule(client, ruleId, action),
    });
  }

  async function handleGenerateEditorialBrief() {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return false;
    }

    return runAction({
      id: 'editorial-brief-generate',
      pending: 'Generating editorial brief...',
      success: 'Editorial brief draft generated for review.',
      action: () => generateDiagnosisEditorialBrief(client, diagnosisRegistryId),
    });
  }

  async function handleCreateEditorialBrief(
    payload: DiagnosisEditorialBriefWritePayload,
  ) {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return false;
    }

    return runAction({
      id: 'editorial-brief-create',
      pending: 'Creating editorial brief...',
      success: 'Editorial brief created.',
      action: () => createDiagnosisEditorialBrief(client, diagnosisRegistryId, payload),
    });
  }

  async function handleUpdateEditorialBrief(
    payload: DiagnosisEditorialBriefWritePayload,
  ) {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return false;
    }

    return runAction({
      id: 'editorial-brief-update',
      pending: 'Updating editorial brief...',
      success: 'Editorial brief updated.',
      action: () => updateDiagnosisEditorialBrief(client, diagnosisRegistryId, payload),
    });
  }

  async function handleReviewEditorialBrief(
    action: DiagnosisEditorialBriefReviewAction,
  ) {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return false;
    }

    return runAction({
      id: `editorial-brief-${action}`,
      pending: 'Updating editorial brief status...',
      success: 'Editorial brief status updated.',
      action: () => reviewDiagnosisEditorialBrief(client, diagnosisRegistryId, action),
    });
  }

  async function handleSave() {
    if (!diagnosisRegistryId) {
      return;
    }

    const payload = buildPayload(form);
    if (!payload) {
      return;
    }

    await runAction({
      id: 'save',
      pending: 'Saving education content...',
      success: 'Education content saved.',
      action: () =>
        education
          ? updateDiagnosisEducationForAdmin(client, education.id, payload)
          : createDiagnosisEducationForAdmin(client, diagnosisRegistryId, payload),
    });
  }

  async function handleReview(status: DiagnosisEducationStatus) {
    if (!education) {
      return;
    }

    await runAction({
      id: `review-${status}`,
      pending: 'Updating education review status...',
      success:
        status === 'PUBLISHED'
          ? 'Education published for eligible learners.'
          : 'Education review status updated.',
      action: () =>
        reviewDiagnosisEducationForAdmin(client, education.id, { status }),
    });
  }

  async function handleRegenerateSection(section: EducationRegenerableSection) {
    if (!diagnosisRegistryId || pendingAction !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Regenerate only ${formatSectionActionLabel(section)} for ${diagnosisLabel}? All other education sections will be preserved and a new draft version will be created.`,
    );
    if (!confirmed) {
      return;
    }

    await runAction({
      id: `regenerate-${section}`,
      pending: `Regenerating ${formatSectionActionLabel(section)}...`,
      success: `${formatSectionActionLabel(section)} regenerated for review.`,
      action: () =>
        regenerateDiagnosisEducationSection(client, diagnosisRegistryId, {
          section,
        }),
    });
  }

  function buildPayload(state: EducationFormState): UpsertDiagnosisEducationPayload | null {
    try {
      return {
        title: state.title.trim() || diagnosisLabel,
        summary: {
          definition: state.definition.trim(),
          highYieldTakeaway: state.highYieldTakeaway.trim() || undefined,
        },
        clinicalPattern: preserveStructuredArray(
          education?.clinicalPattern,
          parseLines(state.clinicalPatternText),
        ),
        examPearls: state.examPearls
          .map((pearl) => ({
            ...(pearl.id?.trim() ? { id: pearl.id.trim() } : {}),
            ...(pearl.type ? { type: pearl.type } : {}),
            ...(pearl.title?.trim() ? { title: pearl.title.trim() } : {}),
            ...(pearl.content?.trim() ? { content: pearl.content.trim() } : {}),
            label: pearl.label.trim(),
            explanation: pearl.explanation.trim(),
            ...(pearl.whyItMatters?.trim()
              ? { whyItMatters: pearl.whyItMatters.trim() }
              : {}),
            ...(pearl.discriminator?.trim()
              ? { discriminator: pearl.discriminator.trim() }
              : {}),
            ...(pearl.managementImplication?.trim()
              ? { managementImplication: pearl.managementImplication.trim() }
              : {}),
            ...(pearl.escalationImplication?.trim()
              ? { escalationImplication: pearl.escalationImplication.trim() }
              : {}),
            ...(pearl.trapAvoided?.trim()
              ? { trapAvoided: pearl.trapAvoided.trim() }
              : {}),
            ...(pearl.critique ? { critique: pearl.critique } : {}),
          }))
          .filter((pearl) => (pearl.label && pearl.explanation) || pearl.content),
        differentials: state.differentials
          .map((item) => ({
            diagnosis: item.diagnosis.trim(),
            ...(item.whyConfused?.trim()
              ? { whyConfused: item.whyConfused.trim() }
              : {}),
            distinguishingPoint: item.distinguishingPoint.trim(),
            ...(item.keySeparator?.trim()
              ? { keySeparator: item.keySeparator.trim() }
              : {}),
            ...(item.classicTrap?.trim()
              ? { classicTrap: item.classicTrap.trim() }
              : {}),
          }))
          .filter((item) => item.diagnosis && item.distinguishingPoint),
        pitfalls: preserveStructuredArray(
          education?.pitfalls,
          parseLines(state.pitfallsText),
        ),
        references: parseLines(state.referencesText),
        scoringSystems: parseJsonField(state.scoringSystemsJson, 'Scoring systems'),
        investigations: parseJsonField(state.investigationsJson, 'Investigations'),
        management: parseJsonField(state.managementJson, 'Management'),
        complications: parseJsonField(state.complicationsJson, 'Complications'),
        recallPrompts: parseJsonField(state.recallPromptsJson, 'Recall prompts'),
      };
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Invalid education payload.');
      return null;
    }
  }

  if (!diagnosisRegistryId) {
    return (
      <CaseDetailSection
        title="Learn Pearls"
        description="Link the case to a diagnosis registry entry before creating reusable diagnosis education."
      >
        <p className="text-sm text-slate-500">
          Diagnosis-level education needs a registry ID so it can be reused across cases.
        </p>
      </CaseDetailSection>
    );
  }

  return (
    <CaseDetailSection
      title="Learn Pearls"
      description="Diagnosis-level education that powers reusable learner notes. TODO: move this to a diagnosis registry detail page when that workspace exists."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {education ? (
            <>
              <StatusBadge status={education.editorialStatus} />
              <StatusBadge status={education.source} tone="info" />
            </>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <ActionFeedback
          feedback={feedback}
          onDismiss={pendingAction ? undefined : clear}
        />

        {loading ? (
          <LoadingState
            title="Loading Learn Pearls"
            description="Fetching diagnosis education content."
          />
        ) : loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {loadError}
          </div>
        ) : (
          <>
            <HeaderState
              education={education}
              diagnosisLabel={diagnosisLabel}
              onCreateManually={() => setEditorOpen(true)}
              onGenerate={() => void handleGenerate()}
              generateDisabled={!canGenerate || pendingAction !== null}
              generateLabel={generateLabel}
              pendingAction={pendingAction}
            />

            {isPublished ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Published education stays visible to learners while a regenerated
                draft version is reviewed.
              </div>
            ) : null}

            <DiagnosisWorkspaceSummaryCard
              summary={workspaceSummary}
              loading={workspaceSummaryLoading}
              error={workspaceSummaryError}
            />

            <ResolvedDifferentialLinksCard
              links={education?.linkedDifferentials ?? []}
            />

            <EditorialBriefCard
              briefResponse={editorialBrief}
              teachingRules={teachingRules}
              loading={editorialBriefLoading}
              error={editorialBriefError}
              pendingAction={pendingAction}
              onGenerate={() => void handleGenerateEditorialBrief()}
              onCreate={(payload) => handleCreateEditorialBrief(payload)}
              onUpdate={(payload) => handleUpdateEditorialBrief(payload)}
              onReview={(action) => void handleReviewEditorialBrief(action)}
            />

            <TeachingRulesCard
              rules={teachingRules}
              loading={teachingRulesLoading}
              error={teachingRulesError}
              pendingAction={pendingAction}
              onGenerateCandidates={() =>
                void handleGenerateTeachingRuleCandidates()
              }
              onSeedLegacy={() => void handleSeedLegacyTeachingRules()}
              onCreateRule={(payload) => handleCreateTeachingRule(payload)}
              onUpdateRule={(ruleId, payload) =>
                handleUpdateTeachingRule(ruleId, payload)
              }
              onReviewRule={(ruleId, action) =>
                void handleReviewTeachingRule(ruleId, action)
              }
            />

            <TeachingUnitCoverageCard
              coverage={teachingUnitCoverage}
              loading={teachingUnitCoverageLoading}
              error={teachingUnitCoverageError}
            />

            <TargetedCaseGenerationCard
              coverage={teachingUnitCoverage}
              mimicCandidates={mimicCandidates}
              disabled={!diagnosisRegistryId || pendingAction !== null}
              pending={pendingAction === 'targeted-case'}
              generatedCase={generatedTargetedCase}
              onGenerate={(payload) => void handleGenerateTargetedCase(payload)}
            />

            <WorkspaceQualityCard
              projection={workspaceProjection}
              loading={workspaceLoading}
              error={workspaceError}
              legacyWarnings={qualityWarnings}
              legacyBlockers={publishBlockers}
              pendingAction={pendingAction}
              onRegenerateSection={(section) =>
                void handleRegenerateSection(section)
              }
            />

            {!workspaceProjection ? (
              <QualityWarningsBox
                warnings={qualityWarnings}
                blockers={publishBlockers}
              />
            ) : null}

            <RevisionHistoryCard
              revisions={revisionHistory}
              loading={revisionHistoryLoading}
              error={revisionHistoryError}
            />

            <RevisionCompareCard
              revisions={revisionHistory}
              selectedFromVersion={compareFromVersion}
              selectedToVersion={compareToVersion}
              comparison={revisionCompare}
              loading={revisionCompareLoading}
              error={revisionCompareError}
              onFromVersionChange={setCompareFromVersion}
              onToVersionChange={setCompareToVersion}
            />

            <EducationPreview preview={preview} />

            {canEdit && editorOpen ? (
              <EducationEditor
                form={form}
                advancedOpen={advancedOpen}
                disabled={pendingAction !== null}
                onAdvancedOpenChange={setAdvancedOpen}
                onFormChange={setForm}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditorOpen((value) => !value)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {editorOpen ? 'Hide editor' : 'Edit content'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={pendingAction !== null}
                    className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === 'save' ? 'Saving...' : 'Save changes'}
                  </button>
                </>
              ) : null}

              {education && reviewableStatuses.has(education.editorialStatus) ? (
                <>
                  {education.editorialStatus !== 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={() => void handleReview('APPROVED')}
                      disabled={pendingAction !== null}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleReview('PUBLISHED')}
                    disabled={pendingAction !== null}
                    className="rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Publish
                  </button>
                </>
              ) : null}

              {education ? (
                <button
                  type="button"
                  onClick={() => void handleReview('ARCHIVED')}
                  disabled={pendingAction !== null}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Archive
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </CaseDetailSection>
  );
}

function ResolvedDifferentialLinksCard({
  links,
}: {
  links: StructuredDifferentialLink[];
}) {
  const grouped = links.reduce<Record<string, StructuredDifferentialLink[]>>(
    (acc, link) => {
      const key = formatDifferentialRole(link.role);
      acc[key] = [...(acc[key] ?? []), link];
      return acc;
    },
    {},
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Resolved differential links
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Registry-linked identities used by editorial tools and graph coverage.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {links.length} linked
        </span>
      </div>

      {links.length ? (
        <div className="mt-3 space-y-3">
          {Object.entries(grouped).map(([role, roleLinks]) => (
            <div key={role}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {role}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {roleLinks.map((link) => (
                  <div
                    key={`${link.diagnosisRegistryId}-${link.sourceText}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {link.displayLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Source: {link.sourceText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No resolved differential links yet. Resolve mappings from the
          differential review queue to populate this section.
        </p>
      )}
    </div>
  );
}

function HeaderState({
  education,
  diagnosisLabel,
  generateDisabled,
  generateLabel,
  pendingAction,
  onCreateManually,
  onGenerate,
}: {
  education: DiagnosisEducationRecord | null;
  diagnosisLabel: string;
  generateDisabled: boolean;
  generateLabel: string;
  pendingAction: string | null;
  onCreateManually: () => void;
  onGenerate: () => void;
}) {
  if (!education) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">
          No education content yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Create reviewed Learn Pearls for {diagnosisLabel}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generateDisabled}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === 'generate' ? 'Generating...' : generateLabel}
          </button>
          <button
            type="button"
            onClick={onCreateManually}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Create Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetaTile label="Version" value={`v${education.version}`} />
        <MetaTile label="Generated" value={formatDateLabel(education.generatedAt)} />
        <MetaTile label="Reviewed" value={formatDateLabel(education.reviewedAt)} />
        <MetaTile label="Published" value={formatDateLabel(education.publishedAt)} />
        <MetaTile label="Updated" value={formatDateLabel(education.updatedAt)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generateDisabled}
          className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === 'generate' ? 'Generating...' : generateLabel}
        </button>
      </div>
    </div>
  );
}

function getGenerateActionLabel(
  education: DiagnosisEducationRecord | null,
): string {
  if (!education) {
    return 'Generate draft';
  }

  if (education.editorialStatus === 'PUBLISHED') {
    return 'Regenerate new draft version';
  }

  return 'Regenerate draft';
}

function getGenerateConfirmationMessage(
  education: DiagnosisEducationRecord | null,
  diagnosisLabel: string,
): string {
  if (!education) {
    return `Generate an AI-assisted education draft for ${diagnosisLabel}? The draft will require review before learners can see it.`;
  }

  if (education.editorialStatus === 'PUBLISHED') {
    return `Generate a new AI-assisted draft version for ${diagnosisLabel}? The currently published version will stay visible to learners until the new draft is reviewed and published.`;
  }

  if (education.editorialStatus === 'APPROVED') {
    return `Regenerate the approved education draft for ${diagnosisLabel}? This creates a new version for review and will replace the current editable draft.`;
  }

  return `Regenerate the AI-assisted education draft for ${diagnosisLabel}? This creates a new version and preserves the current content in revision history.`;
}

function formatSectionActionLabel(section: EducationRegenerableSection) {
  const labels: Record<EducationRegenerableSection, string> = {
    differentials: 'Differentials',
    investigations: 'Investigations',
    examPearls: 'Exam Pearls',
    management: 'Management',
  };

  return labels[section];
}

function formatDifferentialRole(role: string) {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function QualityWarningsBox({
  warnings,
  blockers,
}: {
  warnings: string[];
  blockers: string[];
}) {
  if (warnings.length === 0 && blockers.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Review attention needed before launch</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {warnings.map((warning) => (
          <li key={warning}>{qualityWarningCopy(warning)}</li>
        ))}
        {blockers.map((blocker) => (
          <li key={blocker}>{publishBlockerCopy(blocker)}</li>
        ))}
      </ul>
      <p className="mt-2 text-amber-800">
        AI-assisted content can pass structure checks while still needing
        clinical tightening. Treat these as reviewer prompts, not automatic
        rejection.
      </p>
    </div>
  );
}

function EducationEditor({
  form,
  advancedOpen,
  disabled,
  onAdvancedOpenChange,
  onFormChange,
}: {
  form: EducationFormState;
  advancedOpen: boolean;
  disabled: boolean;
  onAdvancedOpenChange: (value: boolean) => void;
  onFormChange: (form: EducationFormState) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <TextInput
        label="Title"
        value={form.title}
        disabled={disabled}
        onChange={(title) => onFormChange({ ...form, title })}
      />
      <TextArea
        label="Summary definition"
        value={form.definition}
        disabled={disabled}
        onChange={(definition) => onFormChange({ ...form, definition })}
      />
      <TextArea
        label="High-yield takeaway"
        value={form.highYieldTakeaway}
        disabled={disabled}
        onChange={(highYieldTakeaway) =>
          onFormChange({ ...form, highYieldTakeaway })
        }
      />
      <TextArea
        label="Recognition pattern"
        hint="One bullet per line"
        value={form.clinicalPatternText}
        disabled={disabled}
        onChange={(clinicalPatternText) =>
          onFormChange({ ...form, clinicalPatternText })
        }
      />
      <PearlRows
        rows={form.examPearls}
        disabled={disabled}
        onChange={(examPearls) => onFormChange({ ...form, examPearls })}
      />
      <DifferentialRows
        rows={form.differentials}
        disabled={disabled}
        onChange={(differentials) => onFormChange({ ...form, differentials })}
      />
      <TextArea
        label="Pitfalls"
        hint="One bullet per line"
        value={form.pitfallsText}
        disabled={disabled}
        onChange={(pitfallsText) => onFormChange({ ...form, pitfallsText })}
      />
      <TextArea
        label="References"
        hint="One reference per line"
        value={form.referencesText}
        disabled={disabled}
        onChange={(referencesText) =>
          onFormChange({ ...form, referencesText })
        }
      />

      <details
        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        open={advancedOpen}
        onToggle={(event) =>
          onAdvancedOpenChange(event.currentTarget.open)
        }
      >
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Advanced JSON sections
        </summary>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <TextArea
            label="Scoring systems JSON"
            value={form.scoringSystemsJson}
            disabled={disabled}
            onChange={(scoringSystemsJson) =>
              onFormChange({ ...form, scoringSystemsJson })
            }
          />
          <TextArea
            label="Investigations JSON"
            value={form.investigationsJson}
            disabled={disabled}
            onChange={(investigationsJson) =>
              onFormChange({ ...form, investigationsJson })
            }
          />
          <TextArea
            label="Management JSON"
            value={form.managementJson}
            disabled={disabled}
            onChange={(managementJson) =>
              onFormChange({ ...form, managementJson })
            }
          />
          <TextArea
            label="Complications JSON"
            value={form.complicationsJson}
            disabled={disabled}
            onChange={(complicationsJson) =>
              onFormChange({ ...form, complicationsJson })
            }
          />
          <TextArea
            label="Recall prompts JSON"
            value={form.recallPromptsJson}
            disabled={disabled}
            onChange={(recallPromptsJson) =>
              onFormChange({ ...form, recallPromptsJson })
            }
          />
        </div>
      </details>
    </div>
  );
}

function TextInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <textarea
        className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="block text-sm text-slate-500">{hint}</span> : null}
    </label>
  );
}

function PearlRows({
  rows,
  disabled,
  onChange,
}: {
  rows: DiagnosisEducationPearl[];
  disabled: boolean;
  onChange: (rows: DiagnosisEducationPearl[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Exam pearls
      </p>
      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
            <input
              type="text"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Label"
              value={row.title ?? row.label}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  replaceAt(rows, index, {
                    ...row,
                    title: row.type ? event.target.value : row.title,
                    label: event.target.value,
                  }),
                )
              }
            />
            <input
              type="text"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Explanation"
              value={row.content ?? row.explanation}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  replaceAt(rows, index, {
                    ...row,
                    content: row.type ? event.target.value : row.content,
                    explanation: event.target.value,
                  }),
                )
              }
            />
            <button
              type="button"
              disabled={disabled || rows.length === 1}
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          </div>
          {row.type || row.critique?.warnings?.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {row.type ? (
                <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                  {pearlTypeLabel(row.type)}
                </span>
              ) : null}
              <PearlWarningBadges warnings={row.critique?.warnings ?? []} />
            </div>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, { label: '', explanation: '' }])}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
      >
        Add pearl
      </button>
    </div>
  );
}

function DifferentialRows({
  rows,
  disabled,
  onChange,
}: {
  rows: DiagnosisEducationDifferential[];
  disabled: boolean;
  onChange: (rows: DiagnosisEducationDifferential[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Differential distinguishers
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input
            type="text"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Diagnosis"
            value={row.diagnosis}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                replaceAt(rows, index, {
                  ...row,
                  diagnosis: event.target.value,
                }),
              )
            }
          />
          <input
            type="text"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Distinguishing point"
            value={row.distinguishingPoint}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                replaceAt(rows, index, {
                  ...row,
                  distinguishingPoint: event.target.value,
                }),
              )
            }
          />
          <button
            type="button"
            disabled={disabled || rows.length === 1}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([...rows, { diagnosis: '', distinguishingPoint: '' }])
        }
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
      >
        Add distinguisher
      </button>
    </div>
  );
}

function PearlWarningBadges({ warnings }: { warnings: string[] }) {
  if (!warnings.length) {
    return null;
  }

  return (
    <>
      {warnings.slice(0, 4).map((warning) => (
        <span
          key={warning}
          className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700"
        >
          {warning.replace(/_/g, ' ')}
        </span>
      ))}
      {warnings.length > 4 ? (
        <span className="text-xs font-medium text-slate-500">
          +{warnings.length - 4} more
        </span>
      ) : null}
    </>
  );
}

function pearlTypeLabel(type: string) {
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function EducationPreview({
  preview,
}: {
  preview: {
    takeaway: string;
    recognition: string[];
    pearls: DiagnosisEducationPearl[];
    differentials: DiagnosisEducationDifferential[];
    pitfalls: string[];
  };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Learner preview</p>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <PreviewBlock title="High-yield takeaway" items={[preview.takeaway]} />
        <PreviewBlock title="Recognition pattern" items={preview.recognition} />
        <PreviewBlock
          title="Exam pearls"
          items={preview.pearls.map(
            (pearl) => `${pearl.label}: ${pearl.explanation}`,
          )}
        />
        <PreviewBlock
          title="Differential distinguishers"
          items={preview.differentials.map(
            (item) => `${item.diagnosis}: ${item.distinguishingPoint}`,
          )}
        />
        <PreviewBlock title="Pitfalls" items={preview.pitfalls} />
      </div>
    </div>
  );
}

function PreviewBlock({ title, items }: { title: string; items: string[] }) {
  const visibleItems = items.filter((item) => item.trim().length > 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      {visibleItems.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {visibleItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No reviewed notes yet.</p>
      )}
    </div>
  );
}

function toFormState(
  education: DiagnosisEducationRecord | null,
  fallbackTitle: string,
): EducationFormState {
  if (!education) {
    return { ...emptyForm, title: fallbackTitle };
  }

  const summary = asRecord(education.summary);
  return {
    title: education.title,
    definition: typeof summary.definition === 'string' ? summary.definition : '',
    highYieldTakeaway:
      typeof summary.highYieldTakeaway === 'string'
        ? summary.highYieldTakeaway
        : '',
    clinicalPatternText: stringifyLines(education.clinicalPattern),
    examPearls: parsePearls(education.examPearls),
    differentials: parseDifferentials(education.differentials),
    pitfallsText: stringifyLines(education.pitfalls),
    referencesText: stringifyLines(education.references),
    scoringSystemsJson: stringifyJson(education.scoringSystems),
    investigationsJson: stringifyJson(education.investigations),
    managementJson: stringifyJson(education.management),
    complicationsJson: stringifyJson(education.complications),
    recallPromptsJson: stringifyJson(education.recallPrompts),
  };
}

function toPreview(
  form: EducationFormState,
  education: DiagnosisEducationRecord | null,
) {
  const hydrated = education ? toFormState(education, form.title) : form;
  return {
    takeaway: hydrated.highYieldTakeaway || hydrated.definition,
    recognition: education
      ? previewLinesFromJson(education.clinicalPattern, parseLines(hydrated.clinicalPatternText))
      : parseLines(hydrated.clinicalPatternText),
    pearls: hydrated.examPearls.filter((pearl) => pearl.label && pearl.explanation),
    differentials: hydrated.differentials.filter(
      (item) => item.diagnosis && item.distinguishingPoint,
    ),
    pitfalls: education
      ? previewLinesFromJson(education.pitfalls, parseLines(hydrated.pitfallsText))
      : parseLines(hydrated.pitfallsText),
  };
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function preserveStructuredArray(
  current: JsonValue | null | undefined,
  replacement: string[],
): JsonValue {
  if (hasStructuredArrayItems(current) && replacement.length === 0) {
    return current as JsonValue;
  }

  return replacement;
}

function hasStructuredArrayItems(value: JsonValue | null | undefined): boolean {
  return Array.isArray(value)
    ? value.some(
        (item) =>
          typeof item === 'object' && item !== null && !Array.isArray(item),
      )
    : false;
}

function stringifyLines(value: JsonValue | null): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .join('\n');
}

function previewLinesFromJson(value: JsonValue | null, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      const record = asRecord(item);
      return (
        stringField(record, 'pattern') ??
        stringField(record, 'finding') ??
        stringField(record, 'pitfall') ??
        stringField(record, 'test') ??
        stringField(record, 'step') ??
        null
      );
    })
    .filter((item): item is string => Boolean(item));

  return items.length > 0 ? items : fallback;
}

function stringifyJson(value: JsonValue | null): string {
  return value === null ? '' : JSON.stringify(value, null, 2);
}

function parseJsonField(value: string, label: string): JsonValue | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function parsePearls(value: JsonValue | null): DiagnosisEducationPearl[] {
  if (!Array.isArray(value)) {
    return [{ label: '', explanation: '' }];
  }

  const rows = value
    .map((item) => asRecord(item))
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      type: typeof item.type === 'string' ? item.type as DiagnosisEducationPearl['type'] : undefined,
      title: typeof item.title === 'string' ? item.title : undefined,
      content: typeof item.content === 'string' ? item.content : undefined,
      label:
        typeof item.label === 'string'
          ? item.label
          : typeof item.title === 'string'
            ? item.title
            : '',
      explanation:
        typeof item.explanation === 'string'
          ? item.explanation
          : typeof item.content === 'string'
            ? item.content
            : '',
      whyItMatters:
        typeof item.whyItMatters === 'string' ? item.whyItMatters : undefined,
      discriminator:
        typeof item.discriminator === 'string' ? item.discriminator : undefined,
      managementImplication:
        typeof item.managementImplication === 'string'
          ? item.managementImplication
          : undefined,
      escalationImplication:
        typeof item.escalationImplication === 'string'
          ? item.escalationImplication
          : undefined,
      trapAvoided:
        typeof item.trapAvoided === 'string' ? item.trapAvoided : undefined,
      critique: parsePearlCritique(item.critique),
    }))
    .filter((item) => item.label || item.explanation);

  return rows.length > 0 ? rows : [{ label: '', explanation: '' }];
}

function parsePearlCritique(value: unknown): DiagnosisEducationPearl['critique'] {
  const record = asRecord(value);
  if (!Array.isArray(record.warnings)) {
    return undefined;
  }

  return {
    genericityScore:
      typeof record.genericityScore === 'number'
        ? record.genericityScore
        : undefined,
    discriminatorStrength:
      typeof record.discriminatorStrength === 'number'
        ? record.discriminatorStrength
        : undefined,
    operationalReasoningScore:
      typeof record.operationalReasoningScore === 'number'
        ? record.operationalReasoningScore
        : undefined,
    memorabilityScore:
      typeof record.memorabilityScore === 'number'
        ? record.memorabilityScore
        : undefined,
    managementImpactScore:
      typeof record.managementImpactScore === 'number'
        ? record.managementImpactScore
        : undefined,
    warnings: record.warnings.filter(
      (warning): warning is string => typeof warning === 'string',
    ),
  };
}

function parseDifferentials(
  value: JsonValue | null,
): DiagnosisEducationDifferential[] {
  if (!Array.isArray(value)) {
    return [{ diagnosis: '', distinguishingPoint: '' }];
  }

  const rows = value
    .map((item) => asRecord(item))
    .map((item) => ({
      diagnosis: typeof item.diagnosis === 'string' ? item.diagnosis : '',
      whyConfused:
        typeof item.whyConfused === 'string' ? item.whyConfused : undefined,
      distinguishingPoint:
        typeof item.distinguishingPoint === 'string'
          ? item.distinguishingPoint
          : '',
      keySeparator:
        typeof item.keySeparator === 'string' ? item.keySeparator : undefined,
      classicTrap:
        typeof item.classicTrap === 'string' ? item.classicTrap : undefined,
    }))
    .filter((item) => item.diagnosis || item.distinguishingPoint);

  return rows.length > 0 ? rows : [{ diagnosis: '', distinguishingPoint: '' }];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : null;
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function sortRevisionsNewestFirst(
  revisions: DiagnosisEducationRevisionAnalysis[],
) {
  return [...revisions].sort((left, right) => {
    if (right.version !== left.version) {
      return right.version - left.version;
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

function qualityWarningCopy(warning: string): string {
  const copy: Record<string, string> = {
    generic_filler_phrases_detected:
      'Generic teaching phrases detected; tighten into diagnostic discriminators.',
    low_diagnostic_reasoning_density:
      'Low diagnostic reasoning density; add why this finding shifts suspicion.',
    missing_structured_why_layer:
      'Missing structured why-layer fields; add why findings matter diagnostically.',
    missing_comparative_differential_reasoning:
      'Differentials need stronger contrast, not just mimic summaries.',
    missing_why_it_matters_recall_prompt:
      'Recall prompts should include at least one why-it-matters question.',
    typed_pearl_generic_phrase:
      'Typed pearl warning: generic phrase detected; rewrite as operational reasoning.',
    typed_pearl_missing_operational_reasoning:
      'Typed pearl warning: add discriminator, management impact, escalation logic, or trap avoided.',
    typed_pearl_weak_discriminator:
      'Typed pearl warning: discriminator pearl needs a stronger contrast against mimics.',
    typed_pearl_duplicate_teaching_point:
      'Typed pearl warning: duplicate teaching point detected.',
    generic_exam_pearl_why_layer:
      'Exam pearl why-layer is too generic; explain what changes clinically.',
  };

  return copy[warning] ?? warning;
}

function publishBlockerCopy(blocker: string): string {
  const copy: Record<string, string> = {
    missing_summary: 'Publish blocker: summary definition is missing.',
    contains_drug_dosing:
      'Publish blocker: content contains drug dosing and must be reviewed.',
    contains_patient_specific_advice:
      'Publish blocker: content sounds patient-specific rather than educational.',
    high_risk_sections_need_references:
      'Publish blocker: management, investigations, or scoring content needs references.',
    typed_pearl_missing_required_content:
      'Publish blocker: typed pearl is missing id, type, or content.',
  };

  return copy[blocker] ?? `Publish blocker: ${blocker}`;
}
