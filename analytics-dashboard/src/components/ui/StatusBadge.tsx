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
  neutral: 'border-[var(--color-navy-border)] bg-white/5 text-slate-300',
  success: 'border-[var(--color-green)]/35 bg-[var(--color-green)]/10 text-[var(--color-green)]',
  warning: 'border-[var(--color-amber)]/35 bg-[var(--color-amber)]/10 text-[var(--color-amber)]',
  danger: 'border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10 text-[var(--color-rose)]',
  info: 'border-[var(--color-teal)]/35 bg-[var(--color-teal)]/10 text-[var(--color-teal)]',
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
