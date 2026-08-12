export function BoardEmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-navy-border)] bg-white/[0.025] px-4 py-5 text-sm leading-6 text-slate-400">
      <p className="font-semibold text-slate-200">{title}</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}
