import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDiagnosisAlias,
  completeDuplicateKeeper,
  createRegistryFromCandidate,
  generateDiagnosisRegistryAiMetadataSuggestion,
  getDiagnosisRegistryMetadataSuggestions,
  getDiagnosisRegistryCandidates,
  reviewDiagnosisRegistryCandidate,
  updateDiagnosisRegistryLifecycle,
  updateDiagnosisRegistryMetadata,
  type AiDiagnosisRegistryMetadataSuggestion,
  type CompleteDuplicateKeeperResult,
  type CreateRegistryFromCandidateResult,
  type DiagnosisRegistryMetadataSuggestion,
  type DiagnosisRegistryCandidate,
  type DiagnosisRegistryCandidateDuplicateSuggestions,
  type DiagnosisRegistryDuplicateSummary,
  type DiagnosisRegistryCandidateStatus,
  type JsonValue,
  type UpdateDiagnosisRegistryMetadataPayload,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { useConsoleAccess } from '../../hooks/useConsoleAccess';

const statusOptions: Array<DiagnosisRegistryCandidateStatus | ''> = [
  '',
  'CANDIDATE',
  'NEEDS_REVIEW',
  'REJECTED',
  'MERGED',
  'APPROVED_PENDING_CREATE',
  'CREATED',
];

export default function RegistryCandidatesPage() {
  const { getToken } = useAuth();
  const access = useConsoleAccess();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [candidates, setCandidates] = useState<DiagnosisRegistryCandidate[]>(
    [],
  );
  const [status, setStatus] = useState<DiagnosisRegistryCandidateStatus | ''>(
    '',
  );
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [candidateToCreate, setCandidateToCreate] =
    useState<DiagnosisRegistryCandidate | null>(null);
  const [creationResult, setCreationResult] =
    useState<CreateRegistryFromCandidateResult | null>(null);
  const [metadataSuggestion, setMetadataSuggestion] =
    useState<DiagnosisRegistryMetadataSuggestion | null>(null);
  const [aiMetadataSuggestion, setAiMetadataSuggestion] =
    useState<AiDiagnosisRegistryMetadataSuggestion | null>(null);
  const [metadataDraft, setMetadataDraft] =
    useState<UpdateDiagnosisRegistryMetadataPayload | null>(null);
  const [selectedAliases, setSelectedAliases] = useState<Set<string>>(
    () => new Set(),
  );
  const [aiMetadataLoading, setAiMetadataLoading] = useState(false);
  const [metadataApplyBusy, setMetadataApplyBusy] = useState(false);
  const [duplicateCompleteBusy, setDuplicateCompleteBusy] = useState(false);
  const [preferredDuplicateKeeperId, setPreferredDuplicateKeeperId] = useState<
    string | null
  >(null);
  const [aiManualConfirmed, setAiManualConfirmed] = useState(false);
  const [metadataApplyMessage, setMetadataApplyMessage] = useState<
    string | null
  >(null);
  const [activationBusy, setActivationBusy] = useState(false);
  const [activationMessage, setActivationMessage] = useState<string | null>(
    null,
  );
  const [activationError, setActivationError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDiagnosisRegistryCandidates(client, {
        status: status || undefined,
        showResolved,
        limit: 200,
      });
      setCandidates(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load registry candidates.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, status, showResolved]);

  async function runReview(
    candidate: DiagnosisRegistryCandidate,
    action: () => Promise<unknown>,
  ) {
    if (!access.canPublishEditorial) {
      setActionError('Requires senior editor');
      return;
    }

    try {
      setBusyId(candidate.id);
      setActionError(null);
      setCreationResult(null);
      setPreferredDuplicateKeeperId(null);
      setMetadataSuggestion(null);
      setAiMetadataSuggestion(null);
      setMetadataDraft(null);
      setSelectedAliases(new Set());
      setAiManualConfirmed(false);
      setMetadataApplyMessage(null);
      await action();
      await load();
    } catch (reviewError) {
      setActionError(
        reviewError instanceof Error
          ? reviewError.message
          : 'Registry candidate review failed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  function markNeedsReview(candidate: DiagnosisRegistryCandidate) {
    const note = window.prompt('Review note', candidate.reviewNote ?? '');
    if (note === null) return;
    void runReview(candidate, () =>
      reviewDiagnosisRegistryCandidate(client, candidate.id, {
        action: 'mark_needs_review',
        note: note.trim() || undefined,
      }),
    );
  }

  function reject(candidate: DiagnosisRegistryCandidate) {
    const note = window.prompt('Reject note', candidate.reviewNote ?? '');
    if (note === null) return;
    void runReview(candidate, () =>
      reviewDiagnosisRegistryCandidate(client, candidate.id, {
        action: 'reject',
        note: note.trim() || undefined,
      }),
    );
  }

  function markNotDuplicate(candidate: DiagnosisRegistryCandidate) {
    const note = window.prompt(
      'Why is this not a duplicate?',
      'Reviewed duplicate risk; keep this draft separate.',
    );
    if (note === null) return;
    void runReview(candidate, () =>
      reviewDiagnosisRegistryCandidate(client, candidate.id, {
        action: 'mark_needs_review',
        note: note.trim() || undefined,
      }),
    );
  }

  async function confirmCreateRegistry(candidate: DiagnosisRegistryCandidate) {
    if (!access.canPublishEditorial) {
      setActionError('Requires senior editor');
      return;
    }

    try {
      setBusyId(candidate.id);
      setActionError(null);
      setCreationResult(null);
      setPreferredDuplicateKeeperId(null);
      setMetadataSuggestion(null);
      setAiMetadataSuggestion(null);
      setMetadataDraft(null);
      setSelectedAliases(new Set());
      setAiManualConfirmed(false);
      setMetadataApplyMessage(null);
      const result = await createRegistryFromCandidate(client, candidate.id);
      setCreationResult(result);
      setCandidateToCreate(null);
      await load();
    } catch (createError) {
      setActionError(
        createError instanceof Error
          ? createError.message
          : 'Registry creation failed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadMetadataSuggestion() {
      if (!creationResult) {
        return;
      }

      try {
        setActivationError(null);
        setActivationMessage(null);
        setAiManualConfirmed(false);
        setMetadataApplyMessage(null);
        const suggestion = await getDiagnosisRegistryMetadataSuggestions(
          client,
          creationResult.registry.id,
        );
        if (!active) return;
        setMetadataSuggestion(suggestion);
        setMetadataDraft((current) => current ?? {
          ...suggestion.metadata,
          isPlayable: true,
          isGeneratable: creationResult.registry.isGeneratable,
        });
        setSelectedAliases((current) =>
          current.size
            ? current
            : new Set(suggestion.aliases.map((alias) => alias.normalizedTerm)),
        );
      } catch (suggestionError) {
        if (!active) return;
        setActivationError(
          suggestionError instanceof Error
            ? suggestionError.message
            : 'Metadata suggestions could not be loaded.',
        );
      }
    }

    void loadMetadataSuggestion();
    return () => {
      active = false;
    };
  }, [client, creationResult]);

  async function generateAiMetadata() {
    if (!creationResult) {
      return;
    }

    try {
      setAiMetadataLoading(true);
      setActivationError(null);
      setActivationMessage(null);
      setMetadataApplyMessage(null);
      setAiManualConfirmed(false);
      const response = await generateDiagnosisRegistryAiMetadataSuggestion(
        client,
        creationResult.registry.id,
        {
          includeAliases: true,
          includeMetadata: true,
        },
      );
      const suggestion = response.suggestion;
      setAiMetadataSuggestion(suggestion);
      setMetadataDraft((current) => ({
        ...(current ?? {}),
        specialty: suggestion.specialty,
        subspecialty: suggestion.subspecialty,
        category: suggestion.category,
        bodySystem: suggestion.bodySystem,
        organSystem: suggestion.organSystem,
        difficultyBand: suggestion.difficultyBand,
        rarityBand: suggestion.rarityBand,
        clinicalSetting: suggestion.clinicalSetting,
        ageGroup: suggestion.ageGroup,
        urgencyLevel: suggestion.urgencyLevel,
        preferredClueTypes: suggestion.preferredClueTypes,
        excludedClueTypes: suggestion.excludedClueTypes,
        isPlayable: current?.isPlayable ?? true,
        isGeneratable:
          current?.isGeneratable ?? creationResult.registry.isGeneratable,
      }));
      setSelectedAliases((current) => {
        const next = new Set(current);
        for (const alias of suggestion.aliases) {
          const normalizedTerm = normalizeAlias(alias);
          if (normalizedTerm) {
            next.add(normalizedTerm);
          }
        }
        return next;
      });
    } catch (aiError) {
      setActivationError(
        aiError instanceof Error
          ? aiError.message
          : 'AI metadata generation failed.',
      );
    } finally {
      setAiMetadataLoading(false);
    }
  }

  async function applyMetadataDraft() {
    if (!creationResult || !metadataDraft) {
      return;
    }

    if (
      (aiMetadataSuggestion?.metadataConfidence ?? 1) < 0.7 &&
      !aiManualConfirmed
    ) {
      setActivationError(
        'Low-confidence AI metadata requires manual confirmation before applying.',
      );
      return;
    }

    try {
      setMetadataApplyBusy(true);
      setActivationError(null);
      setMetadataApplyMessage(null);
      await updateDiagnosisRegistryMetadata(
        client,
        creationResult.registry.id,
        metadataDraft,
      );
      setMetadataApplyMessage(
        'Metadata saved to the draft registry row. Activation is still gated by duplicate and lifecycle checks.',
      );
      await load();
    } catch (applyError) {
      setActivationError(
        applyError instanceof Error
          ? applyError.message
          : 'Metadata could not be applied.',
      );
    } finally {
      setMetadataApplyBusy(false);
    }
  }

  async function activateCreatedRegistry() {
    if (!creationResult || !metadataDraft) {
      return;
    }

    if (
      (aiMetadataSuggestion?.metadataConfidence ?? 1) < 0.7 &&
      !aiManualConfirmed
    ) {
      setActivationError(
        'Low-confidence AI metadata requires manual confirmation before activation.',
      );
      return;
    }

    try {
      setActivationBusy(true);
      setActivationError(null);
      setActivationMessage(null);
      await updateDiagnosisRegistryMetadata(
        client,
        creationResult.registry.id,
        metadataDraft,
      );
      const aliasesToCreate = getMergedAliasSuggestions(
        metadataSuggestion,
        aiMetadataSuggestion,
      ).filter((alias) => selectedAliases.has(alias.normalizedTerm));
      for (const alias of aliasesToCreate) {
        await addDiagnosisAlias(client, creationResult.registry.id, {
          alias: alias.term,
          kind: alias.term.length <= 6 && alias.term === alias.term.toUpperCase()
            ? 'ABBREVIATION'
            : 'ACCEPTED',
          acceptedForMatch: alias.acceptedForMatch,
        });
      }
      await updateDiagnosisRegistryLifecycle(
        client,
        creationResult.registry.id,
        'activate_for_dictionary',
        { isGeneratable: Boolean(metadataDraft.isGeneratable) },
      );
      setActivationMessage(
        'Activated for dictionary. The next dictionary version will include this diagnosis.',
      );
      await load();
    } catch (activationFailure) {
      setActivationError(
        activationFailure instanceof Error
          ? activationFailure.message
          : 'Dictionary activation failed.',
      );
    } finally {
      setActivationBusy(false);
    }
  }

  async function completeDuplicateKeeperWorkflow(keeperRegistryId: string) {
    if (!creationResult || !metadataDraft) {
      return;
    }

    try {
      setDuplicateCompleteBusy(true);
      setActivationError(null);
      setActivationMessage(null);
      const aliases = getMergedAliasSuggestions(
        metadataSuggestion,
        aiMetadataSuggestion,
      )
        .filter((alias) => selectedAliases.has(alias.normalizedTerm))
        .map((alias) => ({
          term: alias.term,
          acceptedForMatch: alias.acceptedForMatch,
          kind:
            alias.term.length <= 8 && alias.term === alias.term.toUpperCase()
              ? ('ABBREVIATION' as const)
              : ('ACCEPTED' as const),
        }));
      const result = await completeDuplicateKeeper(client, {
        keeperRegistryId,
        sourceDraftRegistryId: creationResult.registry.id,
        metadata: metadataDraft,
        aliases,
        reason:
          'Completed existing duplicate registry from draft activation workflow.',
      });
      setActivationMessage(
        'Existing duplicate registry completed. Review the keeper lifecycle, then activate for dictionary when blockers are clear.',
      );
      retargetActivationToKeeper(result);
      await load();
    } catch (completeError) {
      setActivationError(
        completeError instanceof Error
          ? completeError.message
          : 'Duplicate keeper completion failed.',
      );
    } finally {
      setDuplicateCompleteBusy(false);
    }
  }

  function retargetActivationToKeeper(result: CompleteDuplicateKeeperResult) {
    setCreationResult((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        registry: {
          ...current.registry,
          id: result.keeperRegistryId,
          status: result.lifecycle.lifecycle
            .status as CreateRegistryFromCandidateResult['registry']['status'],
          active: result.lifecycle.lifecycle.active,
          onboardingStatus: result.lifecycle.lifecycle.onboardingStatus,
          isPlayable: result.lifecycle.lifecycle.isPlayable,
          isGeneratable: result.lifecycle.lifecycle.isGeneratable,
        },
      };
    });
  }

  function startActivationWorkflow(
    candidate: DiagnosisRegistryCandidate,
    preferredKeeperId?: string,
  ) {
    if (!candidate.createdRegistry || !candidate.registryQueueState) {
      return;
    }

    setPreferredDuplicateKeeperId(preferredKeeperId ?? null);
    setActionError(null);
    setActivationError(null);
    setActivationMessage(null);
    setMetadataSuggestion(null);
    setAiMetadataSuggestion(null);
    setMetadataDraft(null);
    setSelectedAliases(new Set());
    setAiManualConfirmed(false);
    setMetadataApplyMessage(null);
    setCreationResult({
      candidate,
      registry: {
        id: candidate.createdRegistry.id,
        canonicalName: candidate.createdRegistry.canonicalName,
        canonicalNormalized: candidate.proposedCanonicalNormalized,
        displayLabel: candidate.createdRegistry.displayLabel,
        status: candidate.registryQueueState.status,
        active: candidate.registryQueueState.active,
        onboardingStatus: candidate.registryQueueState.onboardingStatus,
        isPlayable: candidate.registryQueueState.isPlayable,
        isGeneratable: candidate.registryQueueState.isGeneratable,
      },
      createdAliases: [],
      rejectedAliases: [],
      mappingsResolvedCount: 0,
      structuredLinksUpdatedCount: 0,
    });
  }

  if (access.status === 'loading') {
    return <LoadingState title="Checking editorial access" />;
  }

  if (!access.canAccessEditorial) {
    return (
      <ErrorState
        title="Editorial access required"
        message="Registry candidate review is available to editor, senior_editor, and admin roles."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-900">
              Registry candidates
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Review proposed diagnosis registry entries from unresolved
              differential mappings before senior creation.
            </p>
          </div>
          <StatusBadge status={`${candidates.length} candidates`} tone="info" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[220px_220px_auto]">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as DiagnosisRegistryCandidateStatus | '',
                )
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            >
              {statusOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option || 'All'}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
            />
            Show resolved rows
          </label>

          <button
            type="button"
            onClick={() => void load()}
            className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Refresh
          </button>
        </div>
      </section>

      {actionError ? (
        <ErrorState title="Action failed" message={actionError} />
      ) : null}

      {creationResult ? (
        <RegistryCreationSuccess
          result={creationResult}
          suggestion={metadataSuggestion}
          aiSuggestion={aiMetadataSuggestion}
          metadataDraft={metadataDraft}
          selectedAliases={selectedAliases}
          aiMetadataLoading={aiMetadataLoading}
          metadataApplyBusy={metadataApplyBusy}
          duplicateCompleteBusy={duplicateCompleteBusy}
          metadataApplyMessage={metadataApplyMessage}
          aiManualConfirmed={aiManualConfirmed}
          activationBusy={activationBusy}
          activationMessage={activationMessage}
          activationError={activationError}
          duplicateSuggestions={getDuplicateSuggestions(creationResult.candidate)}
          preferredDuplicateKeeperId={preferredDuplicateKeeperId}
          onMetadataDraftChange={setMetadataDraft}
          onGenerateAiMetadata={() => void generateAiMetadata()}
          onApplyMetadata={() => void applyMetadataDraft()}
          onCompleteDuplicateKeeper={(keeperRegistryId) =>
            void completeDuplicateKeeperWorkflow(keeperRegistryId)
          }
          onAiManualConfirmedChange={setAiManualConfirmed}
          onToggleAlias={(normalizedTerm) => {
            setSelectedAliases((current) => {
              const next = new Set(current);
              if (next.has(normalizedTerm)) {
                next.delete(normalizedTerm);
              } else {
                next.add(normalizedTerm);
              }
              return next;
            });
          }}
          onActivate={() => void activateCreatedRegistry()}
        />
      ) : null}

      {loading ? (
        <LoadingState title="Loading registry candidates" />
      ) : error ? (
        <ErrorState title="Unable to load candidates" message={error} />
      ) : candidates.length ? (
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <RegistryCandidateCard
              key={candidate.id}
              candidate={candidate}
              busy={busyId === candidate.id}
              canReview={access.canPublishEditorial}
              onMarkNeedsReview={() => markNeedsReview(candidate)}
              onReject={() => reject(candidate)}
              onMarkNotDuplicate={() => markNotDuplicate(candidate)}
              onCreateRegistry={() => setCandidateToCreate(candidate)}
              onCompleteActivation={(preferredKeeperId) =>
                startActivationWorkflow(candidate, preferredKeeperId)
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No registry candidates match the current filters.
        </div>
      )}

      {candidateToCreate ? (
        <CreateRegistryConfirmationModal
          candidate={candidateToCreate}
          busy={busyId === candidateToCreate.id}
          onClose={() => setCandidateToCreate(null)}
          onConfirm={() => void confirmCreateRegistry(candidateToCreate)}
        />
      ) : null}
    </div>
  );
}

function RegistryCandidateCard({
  candidate,
  busy,
  canReview,
  onMarkNeedsReview,
  onReject,
  onMarkNotDuplicate,
  onCreateRegistry,
  onCompleteActivation,
}: {
  candidate: DiagnosisRegistryCandidate;
  busy: boolean;
  canReview: boolean;
  onMarkNeedsReview: () => void;
  onReject: () => void;
  onMarkNotDuplicate: () => void;
  onCreateRegistry: () => void;
  onCompleteActivation: (preferredKeeperId?: string) => void;
}) {
  const aliases = getStringArray(candidate.proposedAliases);
  const suggestions = getDuplicateSuggestions(candidate);
  const queueState = candidate.registryQueueState;
  const duplicateKeepers = candidate.createdRegistry
    ? getRegistryDuplicateKeepers(suggestions, candidate.createdRegistry.id)
    : [];
  const canCreateRegistry =
    canReview && !['CREATED', 'REJECTED', 'MERGED'].includes(candidate.status);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {candidate.proposedDisplayLabel}
            </h2>
            <StatusBadge status={candidate.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {candidate.proposedCanonicalName} /{' '}
            {candidate.proposedCanonicalNormalized}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onMarkNeedsReview}
            disabled={!canReview || busy}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark needs review
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={!canReview || busy}
            className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onCreateRegistry}
            disabled={!canCreateRegistry || busy}
            className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={canReview ? undefined : 'Requires senior editor'}
          >
            Create registry entry
          </button>
          {candidate.createdRegistry ? (
            <button
              type="button"
              onClick={() => onCompleteActivation()}
              disabled={!canReview || busy || queueState?.dictionaryVisible}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={canReview ? undefined : 'Requires senior editor'}
            >
              Complete activation
            </button>
          ) : null}
        </div>
      </div>

      {queueState ? <RegistryQueueStateBadges state={queueState} /> : null}

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <InfoItem
          label="Source raw text"
          value={candidate.sourceRawText || 'Unknown'}
        />
        <InfoItem
          label="Context diagnosis"
          value={candidate.contextDiagnosisRegistry?.displayLabel ?? 'Unknown'}
        />
        <InfoItem
          label="Source"
          value={`${formatLabel(candidate.sourceType)} / ${
            candidate.sourceMappingId ?? candidate.sourceId
          }`}
        />
      </dl>

      <section className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Proposed aliases
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {aliases.length ? aliases.join(', ') : 'No aliases proposed.'}
        </p>
      </section>

      <DuplicateSuggestions suggestions={suggestions} />

      {candidate.createdRegistry && duplicateKeepers.length ? (
        <DuplicateResolutionPanel
          sourceCandidate={candidate}
          sourceRegistry={candidate.createdRegistry}
          sourceQueueState={queueState}
          keepers={duplicateKeepers}
          canReview={canReview}
          busy={busy}
          onCompleteKeeper={(keeperId) => onCompleteActivation(keeperId)}
          onMarkNotDuplicate={onMarkNotDuplicate}
        />
      ) : null}

      {candidate.reviewNote ? (
        <section className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Review note
          </p>
          <p className="mt-1 text-sm text-slate-700">{candidate.reviewNote}</p>
        </section>
      ) : null}

      {candidate.createdRegistry ? (
        <section className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Created registry
              </p>
              <Link
                to={`/editorial/diagnoses/${candidate.createdRegistry.id}`}
                className="mt-1 block text-sm font-semibold text-emerald-900 underline"
              >
                {candidate.createdRegistry.displayLabel}
              </Link>
            </div>
            {queueState ? (
              <div className="text-right text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                <p>Status {queueState.status}</p>
                <p>Aliases {queueState.aliasCount}</p>
              </div>
            ) : null}
          </div>
          {queueState?.blockerReasons.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-emerald-950">
              {queueState.blockerReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {!canReview ? (
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
          Review actions require senior editor access.
        </p>
      ) : null}
    </article>
  );
}

function CreateRegistryConfirmationModal({
  candidate,
  busy,
  onClose,
  onConfirm,
}: {
  candidate: DiagnosisRegistryCandidate;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const aliases = getStringArray(candidate.proposedAliases);
  const suggestions = getDuplicateSuggestions(candidate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
              Creates a new canonical diagnosis identity
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Create registry entry
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
          >
            Close
          </button>
        </div>

        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoItem label="Canonical" value={candidate.proposedCanonicalName} />
          <InfoItem
            label="Display label"
            value={candidate.proposedDisplayLabel}
          />
          <InfoItem
            label="Source differential"
            value={candidate.sourceRawText}
          />
          <InfoItem
            label="Context"
            value={
              candidate.contextDiagnosisRegistry?.displayLabel ?? 'Unknown'
            }
          />
        </dl>

        <section className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Aliases
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {aliases.length ? aliases.join(', ') : 'No aliases proposed.'}
          </p>
        </section>

        <DuplicateSuggestions suggestions={suggestions} />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Creating...' : 'Create registry entry'}
          </button>
        </div>
      </section>
    </div>
  );
}

function RegistryQueueStateBadges({
  state,
}: {
  state: NonNullable<DiagnosisRegistryCandidate['registryQueueState']>;
}) {
  const duplicateRisk =
    state.duplicateRisk.registryCanonicalMatches +
    state.duplicateRisk.registryAliasMatches;
  const badges = [
    {
      label: state.status === 'DRAFT' ? 'Draft registry' : state.status,
      tone: state.status === 'DRAFT' ? 'warning' : 'info',
      show: true,
    },
    {
      label: state.dictionaryVisible
        ? 'Dictionary active'
        : 'Not dictionary active',
      tone: state.dictionaryVisible ? 'success' : 'warning',
      show: true,
    },
    {
      label: 'Missing metadata',
      tone: 'warning',
      show: state.missingMetadataFields.length > 0,
    },
    {
      label: 'No aliases',
      tone: 'warning',
      show: state.aliasCount === 0,
    },
    {
      label: 'Duplicate risk',
      tone: 'danger',
      show: duplicateRisk > 0,
    },
    {
      label: 'Suggested metadata',
      tone: 'info',
      show: state.suggestedMetadataAvailable,
    },
    {
      label: 'Ready to activate',
      tone: 'success',
      show: !state.activationBlocked && !state.dictionaryVisible,
    },
  ] as const;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {badges
        .filter((badge) => badge.show)
        .map((badge) => (
          <StatusBadge
            key={badge.label}
            status={badge.label}
            tone={badge.tone}
          />
        ))}
      <StatusBadge
        status={`Active ${String(state.active)}`}
        tone={state.active ? 'success' : 'warning'}
      />
      <StatusBadge
        status={`Playable ${String(state.isPlayable)}`}
        tone={state.isPlayable ? 'success' : 'warning'}
      />
      <StatusBadge
        status={`Generatable ${String(state.isGeneratable)}`}
        tone={state.isGeneratable ? 'success' : 'warning'}
      />
      <StatusBadge
        status={`Onboarding ${formatLabel(state.onboardingStatus ?? 'NEW')}`}
        tone="info"
      />
    </div>
  );
}

function DuplicateResolutionPanel({
  sourceCandidate,
  sourceRegistry,
  sourceQueueState,
  keepers,
  canReview,
  busy,
  onCompleteKeeper,
  onMarkNotDuplicate,
}: {
  sourceCandidate: DiagnosisRegistryCandidate;
  sourceRegistry: NonNullable<DiagnosisRegistryCandidate['createdRegistry']>;
  sourceQueueState: DiagnosisRegistryCandidate['registryQueueState'];
  keepers: DiagnosisRegistryDuplicateSummary[];
  canReview: boolean;
  busy: boolean;
  onCompleteKeeper: (keeperRegistryId: string) => void;
  onMarkNotDuplicate: () => void;
}) {
  return (
    <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
            Duplicate resolution
          </p>
          <h3 className="mt-1 text-base font-semibold text-amber-950">
            {sourceRegistry.displayLabel}
          </h3>
          <p className="mt-1 text-sm text-amber-900">
            This created draft overlaps with existing registry rows. Choose a
            keeper by diagnosis name, complete its metadata, then activate only
            after duplicate blockers clear.
          </p>
        </div>
        <StatusBadge status="Duplicate risk" tone="danger" />
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <InfoItem
          label="Source draft"
          value={sourceRegistry.displayLabel}
        />
        <InfoItem
          label="Draft lifecycle"
          value={[
            sourceQueueState?.status ?? 'Unknown',
            sourceQueueState?.dictionaryVisible
              ? 'Dictionary active'
              : 'Not dictionary active',
            `Aliases ${sourceQueueState?.aliasCount ?? 0}`,
          ].join(' / ')}
        />
        <InfoItem
          label="Candidate source text"
          value={sourceCandidate.sourceRawText || 'Unknown'}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {keepers.map((keeper, index) => (
          <article
            key={keeper.id}
            className="rounded-lg border border-amber-200 bg-white p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  {index === 0 ? 'Recommended keeper' : 'Possible keeper'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {keeper.displayLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {keeper.canonicalName}
                </p>
              </div>
              <StatusBadge
                status={keeper.dictionaryVisible ? 'Dictionary active' : keeper.status}
                tone={keeper.dictionaryVisible ? 'success' : 'warning'}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge
                status={keeper.active ? 'Active' : 'Inactive'}
                tone={keeper.active ? 'success' : 'warning'}
              />
              <StatusBadge
                status={keeper.isPlayable ? 'Playable' : 'Not playable'}
                tone={keeper.isPlayable ? 'success' : 'warning'}
              />
              <StatusBadge
                status={keeper.isGeneratable ? 'Generatable' : 'Not generatable'}
                tone={keeper.isGeneratable ? 'success' : 'warning'}
              />
              <StatusBadge
                status={
                  keeper.metadataComplete
                    ? 'Metadata complete'
                    : 'Missing metadata'
                }
                tone={keeper.metadataComplete ? 'success' : 'warning'}
              />
            </div>

            <dl className="mt-3 grid gap-2 text-xs md:grid-cols-2">
              <KeeperMeta label="Specialty" value={keeper.specialty} />
              <KeeperMeta label="Body system" value={keeper.bodySystem} />
              <KeeperMeta
                label="Aliases"
                value={String(keeper.aliasCount ?? 0)}
              />
              <KeeperMeta
                label="Linked mappings"
                value={String(keeper.linkedMappingCount ?? 0)}
              />
              <KeeperMeta label="Created" value={formatDate(keeper.createdAt)} />
              <KeeperMeta
                label="Missing fields"
                value={
                  keeper.missingMetadataFields?.length
                    ? keeper.missingMetadataFields.join(', ')
                    : 'None'
                }
              />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCompleteKeeper(keeper.id)}
                disabled={!canReview || busy}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete this registry
              </button>
              <Link
                to={`/editorial/registry-merge?source=${sourceRegistry.id}&target=${keeper.id}`}
                className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                Merge draft into this registry
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-200 pt-3">
        <button
          type="button"
          onClick={onMarkNotDuplicate}
          disabled={!canReview || busy}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mark as not duplicate
        </button>
        <span className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700">
          Keep separate requires senior override
        </span>
      </div>
    </section>
  );
}

function KeeperMeta({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
      <dt className="font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words font-medium text-slate-800">
        {value || 'Unknown'}
      </dd>
    </div>
  );
}

function RegistryCreationSuccess({
  result,
  suggestion,
  aiSuggestion,
  metadataDraft,
  selectedAliases,
  aiMetadataLoading,
  metadataApplyBusy,
  duplicateCompleteBusy,
  metadataApplyMessage,
  aiManualConfirmed,
  activationBusy,
  activationMessage,
  activationError,
  duplicateSuggestions,
  preferredDuplicateKeeperId,
  onMetadataDraftChange,
  onGenerateAiMetadata,
  onApplyMetadata,
  onCompleteDuplicateKeeper,
  onAiManualConfirmedChange,
  onToggleAlias,
  onActivate,
}: {
  result: CreateRegistryFromCandidateResult;
  suggestion: DiagnosisRegistryMetadataSuggestion | null;
  aiSuggestion: AiDiagnosisRegistryMetadataSuggestion | null;
  metadataDraft: UpdateDiagnosisRegistryMetadataPayload | null;
  selectedAliases: Set<string>;
  aiMetadataLoading: boolean;
  metadataApplyBusy: boolean;
  duplicateCompleteBusy: boolean;
  metadataApplyMessage: string | null;
  aiManualConfirmed: boolean;
  activationBusy: boolean;
  activationMessage: string | null;
  activationError: string | null;
  duplicateSuggestions: DiagnosisRegistryCandidateDuplicateSuggestions;
  preferredDuplicateKeeperId: string | null;
  onMetadataDraftChange: (
    next: UpdateDiagnosisRegistryMetadataPayload | null,
  ) => void;
  onGenerateAiMetadata: () => void;
  onApplyMetadata: () => void;
  onCompleteDuplicateKeeper: (keeperRegistryId: string) => void;
  onAiManualConfirmedChange: (checked: boolean) => void;
  onToggleAlias: (normalizedTerm: string) => void;
  onActivate: () => void;
}) {
  const workspacePath = `/editorial/diagnoses/${result.registry.id}`;
  const aliasSuggestions = getMergedAliasSuggestions(suggestion, aiSuggestion);
  const duplicateKeepers = getRegistryDuplicateKeepers(
    duplicateSuggestions,
    result.registry.id,
    preferredDuplicateKeeperId,
  );
  const lowMetadataConfidence = Boolean(
    aiSuggestion && aiSuggestion.metadataConfidence < 0.7,
  );
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            Registry entry created
          </p>
          <Link
            to={workspacePath}
            className="mt-1 block text-sm text-emerald-800 underline"
          >
            {result.registry.displayLabel}
          </Link>
        </div>
        <StatusBadge
          status={`${result.mappingsResolvedCount} mappings resolved`}
          tone="info"
        />
        <StatusBadge
          status={`${result.structuredLinksUpdatedCount} links synced`}
          tone="info"
        />
      </div>
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
          Dictionary activation required
        </p>
        <p className="mt-1 text-sm text-amber-900">
          This created a draft registry entry and resolved mappings. It is not
          visible to gameplay, autocomplete, or the guess dictionary until a
          senior editor activates it for dictionary use.
        </p>
      </div>
      {result.rejectedAliases.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Alias warnings
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {result.rejectedAliases.map((alias) => (
              <li key={`${alias.term}-${alias.reason}`}>
                {alias.term}: {alias.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 rounded-lg border border-emerald-200 bg-white/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
          Next editorial steps
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            'Open workspace',
            'Seed teaching rules',
            'Generate editorial brief',
            'Generate education draft',
            'Generate targeted case',
          ].map((label) => (
            <Link
              key={label}
              to={workspacePath}
              className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Step 1 - Review metadata
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Suggestions are draft-only and must be checked before activation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestion ? (
              <StatusBadge
                status={`Heuristic ${Math.round(
                  suggestion.confidence * 100,
                )}%`}
                tone="info"
              />
            ) : (
              <StatusBadge status="Loading suggestions" tone="warning" />
            )}
            {aiSuggestion ? (
              <StatusBadge
                status={`AI metadata ${Math.round(
                  aiSuggestion.metadataConfidence * 100,
                )}%`}
                tone={lowMetadataConfidence ? 'warning' : 'success'}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGenerateAiMetadata}
            disabled={aiMetadataLoading || activationBusy}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiMetadataLoading ? 'Generating AI metadata...' : 'Generate AI metadata'}
          </button>
          <button
            type="button"
            onClick={onApplyMetadata}
            disabled={
              !metadataDraft ||
              metadataApplyBusy ||
              activationBusy ||
              (lowMetadataConfidence && !aiManualConfirmed)
            }
            className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {metadataApplyBusy ? 'Applying metadata...' : 'Apply metadata'}
          </button>
        </div>

        {aiSuggestion ? (
          <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-800">
                  AI proposal
                </p>
                <p className="mt-1 text-sm font-semibold text-indigo-950">
                  {aiSuggestion.displayLabel} / {aiSuggestion.canonicalName}
                </p>
              </div>
              <StatusBadge
                status={`Metadata ${Math.round(
                  aiSuggestion.metadataConfidence * 100,
                )}%`}
                tone={lowMetadataConfidence ? 'warning' : 'success'}
              />
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <div className="rounded-md border border-indigo-200 bg-white/70 p-2 text-indigo-950">
                Identity confidence:{' '}
                <span className="font-semibold">
                  {Math.round(aiSuggestion.identityConfidence * 100)}%
                </span>
              </div>
              <div className="rounded-md border border-indigo-200 bg-white/70 p-2 text-indigo-950">
                Metadata confidence:{' '}
                <span className="font-semibold">
                  {Math.round(aiSuggestion.metadataConfidence * 100)}%
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-indigo-900">
              {aiSuggestion.rationale}
            </p>
            {aiSuggestion.warnings.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {aiSuggestion.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {lowMetadataConfidence ? (
              <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={aiManualConfirmed}
                  onChange={(event) =>
                    onAiManualConfirmedChange(event.target.checked)
                  }
                />
                I reviewed this low-confidence AI proposal and confirm the
                metadata manually.
              </label>
            ) : null}
          </div>
        ) : null}

        {metadataDraft ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ['specialty', 'Specialty'],
              ['subspecialty', 'Subspecialty'],
              ['category', 'Category'],
              ['bodySystem', 'Body system'],
              ['organSystem', 'Organ system'],
              ['difficultyBand', 'Difficulty'],
              ['rarityBand', 'Rarity'],
              ['clinicalSetting', 'Clinical setting'],
              ['ageGroup', 'Age group'],
              ['urgencyLevel', 'Urgency'],
            ].map(([field, label]) => (
              <label
                key={field}
                className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
              >
                {label}
                <input
                  value={String(
                    metadataDraft[field as keyof UpdateDiagnosisRegistryMetadataPayload] ??
                      '',
                  )}
                  onChange={(event) =>
                    onMetadataDraftChange({
                      ...metadataDraft,
                      [field]: event.target.value || null,
                    })
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(metadataDraft.isGeneratable)}
                onChange={(event) =>
                  onMetadataDraftChange({
                    ...metadataDraft,
                    isGeneratable: event.target.checked,
                  })
                }
              />
              Enable generation after dictionary activation
            </label>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Step 2 - Review aliases
          </p>
          {aliasSuggestions.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {aliasSuggestions.map((alias) => (
                <label
                  key={alias.normalizedTerm}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  title={alias.rationale}
                >
                  <input
                    type="checkbox"
                    checked={selectedAliases.has(alias.normalizedTerm)}
                    onChange={() => onToggleAlias(alias.normalizedTerm)}
                  />
                  {alias.term}
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              No extra aliases were suggested.
            </p>
          )}
        </div>

        {suggestion?.rationale.length ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {suggestion.rationale.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        {duplicateKeepers.length ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
              Duplicate existing registry found
            </p>
            <p className="mt-1 text-sm text-amber-900">
              This draft appears to duplicate an existing registry row. Complete
              the keeper with the reviewed metadata and aliases, then activate
              the keeper when lifecycle blockers are clear.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {duplicateKeepers.map((keeper) => (
                <button
                  key={keeper.id}
                  type="button"
                  onClick={() => onCompleteDuplicateKeeper(keeper.id)}
                  disabled={
                    !metadataDraft ||
                    duplicateCompleteBusy ||
                    activationBusy ||
                    (lowMetadataConfidence && !aiManualConfirmed)
                  }
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {duplicateCompleteBusy
                    ? 'Completing duplicate...'
                    : `Complete existing registry instead: ${keeper.displayLabel}`}
                </button>
              ))}
              <Link
                to="/editorial/registry-merge"
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Merge this draft manually
              </Link>
              <span className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700">
                Keep separate requires senior override
              </span>
            </div>
          </div>
        ) : null}

        {metadataApplyMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {metadataApplyMessage}
          </div>
        ) : null}

        {activationError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {activationError}
          </div>
        ) : null}
        {activationMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {activationMessage}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">
            Step 3 - Activate for dictionary when metadata and aliases are safe.
          </p>
          <button
            type="button"
            onClick={onActivate}
            disabled={
              !metadataDraft ||
              activationBusy ||
              (lowMetadataConfidence && !aiManualConfirmed)
            }
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activationBusy ? 'Activating...' : 'Activate for dictionary'}
          </button>
        </div>
      </div>
    </section>
  );
}

type RegistryAliasSuggestion = {
  term: string;
  normalizedTerm: string;
  acceptedForMatch: boolean;
  confidence: number;
  rationale: string;
};

function getMergedAliasSuggestions(
  heuristic: DiagnosisRegistryMetadataSuggestion | null,
  aiSuggestion: AiDiagnosisRegistryMetadataSuggestion | null,
): RegistryAliasSuggestion[] {
  const seen = new Set<string>();
  const aliases: RegistryAliasSuggestion[] = [];

  const add = (alias: RegistryAliasSuggestion) => {
    if (!alias.normalizedTerm || seen.has(alias.normalizedTerm)) {
      return;
    }
    seen.add(alias.normalizedTerm);
    aliases.push(alias);
  };

  for (const alias of heuristic?.aliases ?? []) {
    add(alias);
  }

  const aiConfidence = aiSuggestion?.confidence ?? 0.5;
  for (const alias of aiSuggestion?.aliases ?? []) {
    const normalizedTerm = normalizeAlias(alias);
    if (!normalizedTerm) {
      continue;
    }
    add({
      term: alias,
      normalizedTerm,
      acceptedForMatch: true,
      confidence: aiConfidence,
      rationale: 'Proposed by AI metadata generation',
    });
  }

  return aliases;
}

function getRegistryDuplicateKeepers(
  suggestions: DiagnosisRegistryCandidateDuplicateSuggestions,
  sourceRegistryId: string,
  preferredKeeperId?: string | null,
): DiagnosisRegistryDuplicateSummary[] {
  const keepers = new Map<string, DiagnosisRegistryDuplicateSummary>();
  for (const match of suggestions.registryCanonicalMatches ?? []) {
    if (match.id !== sourceRegistryId) {
      keepers.set(match.id, match);
    }
  }
  for (const match of suggestions.registryAliasMatches ?? []) {
    if (match.registry.id !== sourceRegistryId) {
      keepers.set(match.registry.id, match.registry);
    }
  }
  return [...keepers.values()].sort((left, right) => {
    if (left.id === preferredKeeperId) return -1;
    if (right.id === preferredKeeperId) return 1;
    const leftScore = getDuplicateKeeperScore(left);
    const rightScore = getDuplicateKeeperScore(right);
    return rightScore - leftScore || left.displayLabel.localeCompare(right.displayLabel);
  });
}

function getDuplicateKeeperScore(keeper: DiagnosisRegistryDuplicateSummary) {
  let score = 0;
  if (keeper.dictionaryVisible) score += 8;
  if (keeper.status === 'ACTIVE') score += 6;
  if (keeper.metadataComplete) score += 4;
  score += Math.min(keeper.aliasCount ?? 0, 4);
  score += Math.min(keeper.linkedMappingCount ?? 0, 4);
  if (keeper.active) score += 1;
  return score;
}

function DuplicateSuggestions({
  suggestions,
}: {
  suggestions: DiagnosisRegistryCandidateDuplicateSuggestions;
}) {
  const canonicalMatches = suggestions.registryCanonicalMatches ?? [];
  const aliasMatches = suggestions.registryAliasMatches ?? [];
  const candidateMatches = suggestions.candidateMatches ?? [];
  const total =
    canonicalMatches.length + aliasMatches.length + candidateMatches.length;

  return (
    <section className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Duplicate suggestions
      </p>
      {total ? (
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {canonicalMatches.map((match) => (
            <SuggestionItem
              key={`registry-${match.id}`}
              title={match.displayLabel}
              meta={`Registry canonical / ${formatRegistrySummary(match)}`}
            />
          ))}
          {aliasMatches.map((match) => (
            <SuggestionItem
              key={`alias-${match.aliasId}`}
              title={match.aliasTerm}
              meta={`Alias for ${match.registry.displayLabel} / ${formatRegistrySummary(
                match.registry,
              )}`}
            />
          ))}
          {candidateMatches.map((match) => (
            <SuggestionItem
              key={`candidate-${match.id}`}
              title={match.proposedDisplayLabel}
              meta={`Candidate / ${match.status} / ${match.id}`}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          No duplicate suggestions were captured.
        </p>
      )}
    </section>
  );
}

function SuggestionItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 break-all text-xs text-slate-500">{meta}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">
        {value}
      </dd>
    </div>
  );
}

function getDuplicateSuggestions(
  candidate: DiagnosisRegistryCandidate,
): DiagnosisRegistryCandidateDuplicateSuggestions {
  const value = candidate.duplicateSuggestions;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as DiagnosisRegistryCandidateDuplicateSuggestions;
}

function getStringArray(value: JsonValue | string[] | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: unknown[] = value;
  return items.filter((item): item is string => typeof item === 'string');
}

function normalizeAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatRegistrySummary(registry: DiagnosisRegistryDuplicateSummary) {
  return [
    registry.status,
    registry.dictionaryVisible ? 'dictionary active' : 'not dictionary active',
    registry.specialty ?? registry.bodySystem ?? 'metadata incomplete',
    `${registry.aliasCount ?? 0} aliases`,
  ].join(' / ');
}
