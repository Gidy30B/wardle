import type { EditorialQueueFilter } from '../../api/admin';
import CaseDetailSection from './CaseDetailSection';

type PublishReadinessSummary = {
  title: string;
  description: string;
  tone: 'success' | 'info' | 'neutral';
};

type CaseWorkflowSectionProps = {
  queue: EditorialQueueFilter;
  anyActionPending: boolean;
  reviewNotes: string;
  publishReady: boolean;
  publishReadiness: PublishReadinessSummary | null;
  onReviewNotesChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onStartReview: () => void;
  onMarkReadyToPublish: () => void;
  onRerunValidation: () => void;
};

function actionButtonClass(tone: 'primary' | 'danger' | 'secondary' = 'primary') {
  if (tone === 'danger') {
    return 'border-rose-200 bg-rose-600 text-white hover:bg-rose-700';
  }

  if (tone === 'secondary') {
    return 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100';
  }

  return 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800';
}

export default function CaseWorkflowSection({
  queue,
  anyActionPending,
  reviewNotes,
  publishReady,
  publishReadiness,
  onReviewNotesChange,
  onApprove,
  onReject,
  onStartReview,
  onMarkReadyToPublish,
  onRerunValidation,
}: CaseWorkflowSectionProps) {
  return (
    <CaseDetailSection
      title="Workflow actions"
      description={
        queue === 'publish'
          ? 'Publish-focused handling stays in this same action surface so the workflow does not split across pages.'
          : 'The backend remains the source of truth for which transitions are allowed.'
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Decision actions
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={anyActionPending}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                actionButtonClass('primary'),
              ].join(' ')}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={anyActionPending}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                actionButtonClass('danger'),
              ].join(' ')}
            >
              Reject
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={onStartReview}
              disabled={anyActionPending}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                actionButtonClass('secondary'),
              ].join(' ')}
            >
              Start review
            </button>
            <button
              type="button"
              onClick={onMarkReadyToPublish}
              disabled={anyActionPending}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                publishReady
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : actionButtonClass('primary'),
              ].join(' ')}
            >
              Mark ready to publish
            </button>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Review notes
          </span>
          <textarea
            className="min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="Add context for approval or rejection."
            value={reviewNotes}
            onChange={(event) => onReviewNotesChange(event.target.value)}
            disabled={anyActionPending}
          />
        </label>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Maintenance actions
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={onRerunValidation}
              disabled={anyActionPending}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                actionButtonClass('secondary'),
              ].join(' ')}
            >
              Rerun validation
            </button>
          </div>
        </div>

        {queue === 'publish' || publishReady ? (
          <div
            className={[
              'rounded-xl border px-4 py-3',
              publishReadiness?.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : publishReadiness?.tone === 'info'
                  ? 'border-sky-200 bg-sky-50'
                  : 'border-slate-200 bg-white',
            ].join(' ')}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {publishReadiness?.title ?? 'Publish status'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {publishReadiness?.description}
                </p>
              </div>
              {publishReady ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Publish ready
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </CaseDetailSection>
  );
}
