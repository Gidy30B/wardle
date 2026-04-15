import type { ReactNode } from 'react';

type ErrorStateProps = {
  title?: string;
  message: string;
  action?: ReactNode;
};

export default function ErrorState({
  title = 'Something went wrong',
  message,
  action,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">
        Error
      </p>
      <h2 className="mt-2 text-lg font-semibold text-rose-900">{title}</h2>
      <p className="mt-2 text-sm text-rose-700">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
