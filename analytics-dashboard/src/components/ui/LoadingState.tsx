type LoadingStateProps = {
  title?: string;
  description?: string;
};

export default function LoadingState({
  title = 'Loading',
  description = 'Please wait while we fetch the latest admin data.',
}: LoadingStateProps) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
