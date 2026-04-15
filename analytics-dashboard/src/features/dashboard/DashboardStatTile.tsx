type DashboardStatTileProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
};

const toneClasses: Record<NonNullable<DashboardStatTileProps['tone']>, string> = {
  default: 'border-slate-200 bg-slate-50',
  success: 'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-rose-200 bg-rose-50',
  info: 'border-sky-200 bg-sky-50',
};

export default function DashboardStatTile({
  label,
  value,
  hint,
  tone = 'default',
}: DashboardStatTileProps) {
  return (
    <div className={['rounded-2xl border p-4', toneClasses[tone]].join(' ')}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
