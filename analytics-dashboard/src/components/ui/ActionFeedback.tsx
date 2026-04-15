export type ActionFeedbackKind = 'pending' | 'success' | 'error';

export type ActionFeedbackState = {
  kind: ActionFeedbackKind;
  message: string;
};

type ActionFeedbackProps = {
  feedback: ActionFeedbackState | null;
  onDismiss?: () => void;
};

const toneClasses: Record<ActionFeedbackKind, string> = {
  pending: 'border-sky-200 bg-sky-50 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
};

const toneLabels: Record<ActionFeedbackKind, string> = {
  pending: 'In progress',
  success: 'Success',
  error: 'Error',
};

export default function ActionFeedback({
  feedback,
  onDismiss,
}: ActionFeedbackProps) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      className={[
        'flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm shadow-sm',
        toneClasses[feedback.kind],
      ].join(' ')}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">
          {toneLabels[feedback.kind]}
        </p>
        <p className="font-medium">{feedback.message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-white/70"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
