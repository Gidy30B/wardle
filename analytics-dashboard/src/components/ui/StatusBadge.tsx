import {
  getStatusBadgeMeta,
  type StatusBadgeKind,
  type StatusBadgeTone,
  type StatusBadgeValue,
} from './statusBadgeMeta';

type StatusBadgeProps = {
  status: StatusBadgeValue | null | undefined;
  kind?: StatusBadgeKind;
  tone?: StatusBadgeTone;
  className?: string;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
};

export default function StatusBadge({
  status,
  kind,
  tone,
  className = '',
}: StatusBadgeProps) {
  const meta = getStatusBadgeMeta(status, kind);
  const resolvedTone = tone ?? meta.tone;

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
        toneClasses[resolvedTone],
        className,
      ].join(' ')}
    >
      {meta.label}
    </span>
  );
}
