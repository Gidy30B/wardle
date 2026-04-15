import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getEditorialCaseRevisions,
  markCaseReadyToPublish,
  rerunCaseValidation,
  restoreCaseRevision,
  startCaseReview,
  submitCaseReview,
  type EditorialCaseDetail,
  type EditorialCaseListItem,
  type EditorialCaseRevision,
  type ReviewDecision,
} from '../../api/admin';
import type { EditorialQueueFilter } from '../../api/admin';
import type { ApiClient } from '../../api/client';
import ActionFeedback from '../../components/ui/ActionFeedback';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import CaseClinicalSection from './CaseClinicalSection';
import CaseHistorySection from './CaseHistorySection';
import CaseValidationSection from './CaseValidationSection';
import CaseWorkflowSection from './CaseWorkflowSection';
import {
  getValidationIssueBuckets,
  parseCaseClues,
  parseValidationFindingIssues,
} from './case.transforms';
import {
  formatDateLabel,
  formatSourceLabel,
  getCaseDisplaySummary,
  getPublishReadinessSummary,
  isPublishReadyStatus,
} from './cases.helpers';

type CaseDetailProps = {
  row: EditorialCaseListItem | null;
  detail: EditorialCaseDetail | null;
  client: ApiClient;
  loading?: boolean;
  error?: string | null;
  refreshSignal: number;
  onRequestRefresh: () => void;
  queue: EditorialQueueFilter;
};

type ConfirmActionConfig = {
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pendingMessage: string;
  successMessage: string;
  tone?: 'primary' | 'danger';
  children?: ReactNode;
  run: () => Promise<unknown>;
};

function SummaryStat({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold text-slate-900">
        {valueNode ?? value}
      </dd>
    </div>
  );
}

export default function CaseDetail({
  row,
  detail,
  client,
  loading = false,
  error = null,
  refreshSignal,
  onRequestRefresh,
  queue,
}: CaseDetailProps) {
  const [revisions, setRevisions] = useState<EditorialCaseRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmActionConfig | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const { feedback, clear, showError, showPending, showSuccess } =
    useActionFeedback();

  useEffect(() => {
    if (!detail) {
      setRevisions([]);
      setRevisionsError(null);
      setRevisionsLoading(false);
      setReviewNotes('');
      setConfirmAction(null);
      return;
    }

    const latestReview = getCaseDisplaySummary(detail).latestReview;
    setReviewNotes(latestReview?.notes ?? '');
  }, [detail]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    let active = true;
    const caseId = detail.id;

    async function loadRevisions() {
      try {
        setRevisionsLoading(true);
        setRevisionsError(null);
        const response = await getEditorialCaseRevisions(client, caseId);

        if (!active) {
          return;
        }

        setRevisions(response);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setRevisions([]);
        setRevisionsError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load revision history',
        );
      } finally {
        if (active) {
          setRevisionsLoading(false);
        }
      }
    }

    void loadRevisions();

    return () => {
      active = false;
    };
  }, [client, detail, refreshSignal]);

  const detailSummary = useMemo(
    () => (detail ? getCaseDisplaySummary(detail) : null),
    [detail],
  );

  const latestValidation = detailSummary?.latestValidation ?? null;
  const latestReview = detailSummary?.latestReview ?? null;
  const anyActionPending = pendingActionId !== null;
  const publishReadiness = detail
    ? getPublishReadinessSummary(detail.editorialStatus)
    : null;
  const publishReady = detail ? isPublishReadyStatus(detail.editorialStatus) : false;
  const clues = useMemo(() => parseCaseClues(detail?.clues), [detail]);
  const showLegacyFallback =
    clues.length === 0 && Boolean(detail?.history || detail?.symptoms.length);
  const validationIssues = useMemo(
    () => parseValidationFindingIssues(latestValidation?.findings),
    [latestValidation],
  );
  const validationBuckets = useMemo(
    () => getValidationIssueBuckets(validationIssues),
    [validationIssues],
  );

  async function runAction(config: {
    id: string;
    pendingMessage: string;
    successMessage: string;
    run: () => Promise<unknown>;
    afterSuccess?: () => void;
  }) {
    try {
      setPendingActionId(config.id);
      showPending(config.pendingMessage);
      await config.run();
      config.afterSuccess?.();
      showSuccess(config.successMessage);
      onRequestRefresh();
      return true;
    } catch (actionError) {
      showError(
        actionError instanceof Error
          ? actionError.message
          : 'The action could not be completed.',
      );
      return false;
    } finally {
      setPendingActionId(null);
    }
  }

  function openApprovalConfirm(decision: ReviewDecision) {
    if (!detail) {
      return;
    }

    const caseId = detail.id;
    const isReject = decision === 'REJECTED';

    setConfirmAction({
      id: `review-${decision.toLowerCase()}`,
      title: isReject ? 'Reject this case?' : 'Approve this case?',
      description: isReject
        ? 'This sends a rejection decision to the backend for the selected case.'
        : 'This sends an approval decision to the backend for the selected case.',
      confirmLabel: isReject ? 'Reject case' : 'Approve case',
      pendingLabel: isReject ? 'Rejecting...' : 'Approving...',
      pendingMessage: isReject
        ? 'Submitting rejection review...'
        : 'Submitting approval review...',
      successMessage: isReject
        ? 'Rejection review submitted.'
        : 'Approval review submitted.',
      tone: isReject ? 'danger' : 'primary',
      children: (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Review notes</p>
          <p className="mt-1 whitespace-pre-wrap break-words">
            {reviewNotes.trim() || 'No notes provided.'}
          </p>
        </div>
      ),
      run: () =>
        submitCaseReview(client, caseId, {
          decision,
          notes: reviewNotes.trim() || undefined,
        }),
    });
  }

  function openRestoreConfirm(revision: EditorialCaseRevision) {
    if (!detail) {
      return;
    }

    const caseId = detail.id;
    setConfirmAction({
      id: `restore-${revision.id}`,
      title: `Restore revision ${revision.revisionNumber}?`,
      description:
        'This replaces the current case content with the selected revision and triggers a fresh validation run.',
      confirmLabel: 'Restore revision',
      pendingLabel: 'Restoring...',
      pendingMessage: `Restoring revision ${revision.revisionNumber}...`,
      successMessage: `Revision ${revision.revisionNumber} restored.`,
      tone: 'danger',
      children: (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p>
            Source:{' '}
            <span className="font-semibold text-slate-900">
              {formatSourceLabel(revision.source)}
            </span>
          </p>
          <p className="mt-1">
            Created:{' '}
            <span className="font-semibold text-slate-900">
              {formatDateLabel(revision.createdAt)}
            </span>
          </p>
        </div>
      ),
      run: () => restoreCaseRevision(client, caseId, revision.id),
    });
  }

  async function handleConfirmAction() {
    if (!confirmAction) {
      return;
    }

    const currentAction = confirmAction;
    const succeeded = await runAction({
      id: currentAction.id,
      pendingMessage: currentAction.pendingMessage,
      successMessage: currentAction.successMessage,
      run: currentAction.run,
    });

    if (succeeded) {
      setConfirmAction(null);
    }
  }

  async function handleStartReview() {
    if (!detail) {
      return;
    }

    const caseId = detail.id;
    await runAction({
      id: 'start-review',
      pendingMessage: 'Starting review...',
      successMessage: 'Review started.',
      run: () => startCaseReview(client, caseId),
    });
  }

  function handleRerunValidation() {
    if (!detail) {
      return;
    }

    const caseId = detail.id;
    setConfirmAction({
      id: 'rerun-validation',
      title: 'Rerun validation?',
      description:
        'This triggers a fresh validation run for the current case revision.',
      confirmLabel: 'Rerun validation',
      pendingLabel: 'Rerunning...',
      pendingMessage: 'Rerunning validation...',
      successMessage: 'Validation rerun requested.',
      tone: 'primary',
      run: () => rerunCaseValidation(client, caseId),
    });
  }

  function handleMarkReadyToPublish() {
    if (!detail) {
      return;
    }

    const caseId = detail.id;
    setConfirmAction({
      id: 'mark-ready',
      title: 'Mark this case ready to publish?',
      description:
        'This asks the backend to transition the selected case into the ready-to-publish state.',
      confirmLabel: 'Mark ready',
      pendingLabel: 'Marking ready...',
      pendingMessage: 'Marking case ready to publish...',
      successMessage: 'Case marked ready to publish.',
      tone: 'primary',
      run: () => markCaseReadyToPublish(client, caseId),
    });
  }

  if (!row) {
    return (
      <EmptyState
        title="No case selected"
        description="Select a case to inspect its editorial summary."
      />
    );
  }

  if (loading) {
    return (
      <LoadingState
        title="Loading case detail"
        description="Fetching editorial context for the selected case."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load case detail"
        message={error}
      />
    );
  }

  if (!detail) {
    return (
      <EmptyState
        title="Case detail unavailable"
        description="The selected case detail could not be loaded yet."
      />
    );
  }

  return (
    <>
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 xl:p-5">
        <ActionFeedback
          feedback={feedback}
          onDismiss={anyActionPending ? undefined : clear}
        />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Editorial detail
          </p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{detail.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {detail.diagnosis.name} - {detail.difficulty} - {detail.date}
              </p>
            </div>
            <StatusBadge status={detail.editorialStatus} kind="editorial" />
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            <SummaryStat label="Diagnosis" value={detail.diagnosis.name} />
            <SummaryStat label="Difficulty" value={detail.difficulty} />
            <SummaryStat
              label="Editorial status"
              valueNode={<StatusBadge status={detail.editorialStatus} kind="editorial" />}
            />
            <SummaryStat
              label="Latest validation"
              valueNode={
                <StatusBadge status={latestValidation?.outcome} kind="validation" />
              }
            />
            <SummaryStat
              label="Latest review"
              valueNode={
                latestReview?.decision ? (
                  <StatusBadge status={latestReview.decision} kind="review" />
                ) : (
                  'No review yet'
                )
              }
            />
          </dl>
        </div>

        <CaseWorkflowSection
          queue={queue}
          anyActionPending={anyActionPending}
          reviewNotes={reviewNotes}
          publishReady={publishReady}
          publishReadiness={publishReadiness}
          onReviewNotesChange={setReviewNotes}
          onApprove={() => openApprovalConfirm('APPROVED')}
          onReject={() => openApprovalConfirm('REJECTED')}
          onStartReview={handleStartReview}
          onMarkReadyToPublish={handleMarkReadyToPublish}
          onRerunValidation={handleRerunValidation}
        />

        <CaseClinicalSection
          detail={detail}
          clues={clues}
          showLegacyFallback={showLegacyFallback}
        />

        <CaseValidationSection
          latestValidation={latestValidation}
          validationIssues={validationIssues}
          validationBuckets={validationBuckets}
        />

        <CaseHistorySection
          detail={detail}
          latestReview={latestReview}
          revisions={revisions}
          revisionsLoading={revisionsLoading}
          revisionsError={revisionsError}
          anyActionPending={anyActionPending}
          onRestoreRevision={openRestoreConfirm}
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? 'Confirm action'}
        description={confirmAction?.description ?? ''}
        confirmLabel={confirmAction?.confirmLabel}
        pendingLabel={confirmAction?.pendingLabel}
        tone={confirmAction?.tone}
        isPending={confirmAction ? pendingActionId === confirmAction.id : false}
        onCancel={() => {
          if (!anyActionPending) {
            setConfirmAction(null);
          }
        }}
        onConfirm={handleConfirmAction}
      >
        {confirmAction?.children}
      </ConfirmDialog>
    </>
  );
}
