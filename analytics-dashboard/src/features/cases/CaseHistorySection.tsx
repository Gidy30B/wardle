import type {
  EditorialCaseDetail,
  EditorialCaseReview,
  EditorialCaseRevision,
} from '../../api/admin';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import CaseDetailSection from './CaseDetailSection';
import {
  formatDateLabel,
  formatSourceLabel,
  getCaseDisplaySummary,
  isCurrentRevision,
} from './cases.helpers';

type CaseHistorySectionProps = {
  detail: EditorialCaseDetail;
  latestReview: EditorialCaseReview | null;
  revisions: EditorialCaseRevision[];
  revisionsLoading: boolean;
  revisionsError: string | null;
  anyActionPending: boolean;
  onRestoreRevision: (revision: EditorialCaseRevision) => void;
};

export default function CaseHistorySection({
  detail,
  latestReview,
  revisions,
  revisionsLoading,
  revisionsError,
  anyActionPending,
  onRestoreRevision,
}: CaseHistorySectionProps) {
  return (
    <>
      <CaseDetailSection
        title="Review summary"
        description="The latest editorial review decision and notes."
        collapsible
        defaultOpen={false}
      >
        {latestReview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={latestReview.decision} kind="review" />
              <p className="text-sm text-slate-500">
                {formatDateLabel(latestReview.decidedAt ?? latestReview.createdAt)}
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg bg-white px-3 py-3">
                <dt className="text-slate-500">Reviewer</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {latestReview.reviewerUserId ?? 'Not recorded'}
                </dd>
              </div>
              <div className="rounded-lg bg-white px-3 py-3">
                <dt className="text-slate-500">Review source</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {formatSourceLabel(latestReview.source)}
                </dd>
              </div>
            </dl>
            <div className="rounded-lg bg-white px-3 py-3">
              <p className="text-sm font-semibold text-slate-900">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {latestReview.notes?.trim() || 'No notes provided.'}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No review yet"
            description="Start review or submit a review decision from the workflow actions."
          />
        )}
      </CaseDetailSection>

      <CaseDetailSection
        title="Revision history"
        description="Restore an earlier revision when you need to roll case content back."
        collapsible
        defaultOpen={false}
      >
        {revisionsLoading ? (
          <LoadingState
            title="Loading revision history"
            description="Fetching revision timeline for the selected case."
          />
        ) : revisionsError ? (
          <ErrorState
            title="Unable to load revisions"
            message={revisionsError}
          />
        ) : revisions.length === 0 ? (
          <EmptyState
            title="No revisions available"
            description="Revision history will appear here when the backend returns revision records."
          />
        ) : (
          <div className="space-y-3">
            {revisions.map((revision) => {
              const current = isCurrentRevision(detail, revision);
              const revisionValidation = getCaseDisplaySummary({
                ...detail,
                validationRuns: revision.validationRuns,
                reviews: revision.reviews,
              }).latestValidation;

              return (
                <div
                  key={revision.id}
                  className={[
                    'rounded-lg border bg-white p-4',
                    current ? 'border-slate-900' : 'border-slate-200',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          Revision {revision.revisionNumber}
                        </p>
                        {current ? (
                          <span className="rounded-full border border-slate-900 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatSourceLabel(revision.source)} -{' '}
                        {formatDateLabel(revision.createdAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRestoreRevision(revision)}
                      disabled={anyActionPending || current}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {current ? 'Current revision' : 'Restore revision'}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Validation
                      </p>
                      <div className="mt-2">
                        <StatusBadge
                          status={revisionValidation?.outcome}
                          kind="validation"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Difficulty
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {revision.difficulty}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CaseDetailSection>
    </>
  );
}
