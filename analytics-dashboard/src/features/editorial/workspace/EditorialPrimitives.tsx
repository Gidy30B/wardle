import type { ReactNode } from 'react';
import { ArrowRight, ChevronDown, WandSparkles } from 'lucide-react';

import type { WorkspaceCoverageMatrixRow } from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';
import {
  toneBgClass,
  toneBorderClass,
  toneTextClass,
} from '../../../components/ui/statusBadgeMeta';
import { formatLabel } from './workspaceTransforms';

type ChipItem = {
  id: string;
  label: string;
  tone?: StatusBadgeTone;
  className?: string;
};

type StreamSignal = {
  label: string;
  value: string | number | null | undefined;
  tone?: StatusBadgeTone;
};

type PrototypeTone = 'teal' | 'amber' | 'rose' | 'green' | 'slate';

const PROTOTYPE_TONE_CLASSES: Record<PrototypeTone, string> = {
  teal: 'bg-[var(--color-teal-bg)] text-[var(--color-teal)] border-[rgba(0,180,166,0.2)]',
  amber:
    'bg-[var(--color-amber-bg)] text-[var(--color-amber)] border-[rgba(232,160,32,0.2)]',
  rose: 'bg-[var(--color-rose-bg)] text-[var(--color-rose)] border-[rgba(224,92,106,0.2)]',
  green:
    'bg-[var(--color-green-bg)] text-[var(--color-green)] border-[rgba(58,191,138,0.2)]',
  slate:
    'bg-[var(--color-dim1)] text-[var(--color-slate-lt)] border-[var(--color-navy-border)]',
};

export function Pill({
  tone = 'slate',
  size = 'sm',
  children,
}: {
  tone?: PrototypeTone;
  size?: 'xs' | 'sm';
  children: ReactNode;
}) {
  return (
    <span
      className={[
        'inline-flex items-center border font-medium uppercase tracking-[0.04em]',
        size === 'xs'
          ? 'rounded px-1.5 py-px text-[8px]'
          : 'rounded px-[7px] py-[2px] text-[10px]',
        PROTOTYPE_TONE_CLASSES[tone],
      ].join(' ')}
    >
      {children}
    </span>
  );
}

export function Btn({
  variant = 'ghost',
  onClick,
  disabled,
  children,
}: {
  variant?: 'primary' | 'ghost' | 'amber' | 'rose';
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const classes =
    variant === 'primary'
      ? 'bg-[var(--color-teal)] text-[var(--color-navy)]'
      : variant === 'amber'
        ? 'border border-[rgba(232,160,32,0.25)] bg-[var(--color-amber-bg)] text-[var(--color-amber)]'
        : variant === 'rose'
          ? 'border border-[rgba(224,92,106,0.25)] bg-[var(--color-rose-bg)] text-[var(--color-rose)]'
          : 'border border-[var(--color-navy-border)] bg-[var(--color-dim1)] text-[var(--color-slate-lt)]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition hover:bg-[var(--color-dim2)] disabled:cursor-not-allowed disabled:opacity-35 ${classes}`}
    >
      {children}
    </button>
  );
}

export function Warn({
  type,
  children,
}: {
  type: 'amber' | 'rose';
  children: ReactNode;
}) {
  return (
    <div
      className={`mb-2 flex items-start gap-2 rounded-md border p-2.5 text-[12px] leading-relaxed ${PROTOTYPE_TONE_CLASSES[type]}`}
    >
      <span className="shrink-0">{type === 'rose' ? 'x' : '!'}</span>
      <span>{children}</span>
    </div>
  );
}

export function SidebarDetailLayout({
  sidebar,
  detail,
  sidebarWidth = 200,
}: {
  sidebar: ReactNode;
  detail: ReactNode;
  sidebarWidth?: number;
}) {
  return (
    <div className="flex gap-3.5" style={{ minHeight: 500 }}>
      <div
        className="shrink-0 flex flex-col gap-1.5"
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-3.5 overflow-y-auto">
        {detail}
      </div>
    </div>
  );
}

export function EditorialStream({
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="editorial-eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-1 text-base font-semibold text-slate-100">{title}</h2>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export function EditorialEntity({
  eyebrow,
  title,
  subtitle,
  tone = 'neutral',
  state,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tone?: StatusBadgeTone;
  state?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className={`rounded-lg border ${toneBorderClass(tone)} ${toneBgClass(
        tone,
      )} px-4 py-3`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold leading-5 text-slate-100">
              {title}
            </h3>
            {state}
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

export function DistinctionStream({
  title,
  learnerConfusion,
  discriminator,
  action,
  children,
}: {
  title: string;
  learnerConfusion?: string | null;
  discriminator?: string | null;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <EditorialEntity
      eyebrow="Clinical distinction"
      title={title}
      subtitle={discriminator ?? 'No discriminator summary available yet.'}
      tone={learnerConfusion ? 'warning' : 'info'}
      action={action}
    >
      {learnerConfusion ? (
        <LearnerConfusionIndicator>{learnerConfusion}</LearnerConfusionIndicator>
      ) : null}
      <div className="mt-3">{children}</div>
    </EditorialEntity>
  );
}

export function EmbeddedActionBar({
  note,
  children,
}: {
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
      {note ? (
        <p className="min-w-48 flex-1 text-xs leading-5 text-slate-500">{note}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function EvidenceConfidenceStrip({ items }: { items: StreamSignal[] }) {
  return <InlineSignalStrip items={items} label="Evidence confidence" />;
}

export function CoverageStateStrip({ items }: { items: StreamSignal[] }) {
  return <InlineSignalStrip items={items} label="Coverage state" />;
}

export function WorkflowStateInline({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: StatusBadgeTone;
}) {
  return (
    <span
      className={`rounded-full border ${toneBorderClass(tone)} ${toneBgClass(
        tone,
      )} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${toneTextClass(
        tone,
      )}`}
    >
      {label}
    </span>
  );
}

export function LearnerConfusionIndicator({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <p className="rounded-md border border-[var(--color-amber)]/25 bg-[var(--color-amber)]/10 px-3 py-2 text-xs leading-5 text-amber-100">
      <span className="font-semibold">Learner confusion: </span>
      {children}
    </p>
  );
}

export function EditorialFlowDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export function StreamDisclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-md border border-white/10 bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <span>
          <span className="block text-xs font-semibold text-slate-200">
            {title}
          </span>
          {summary ? (
            <span className="mt-0.5 block text-xs leading-5 text-slate-500">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-white/10 p-3">{children}</div>
    </details>
  );
}

export function ReasoningThread({
  items,
}: {
  items: Array<{ label: string; detail: string | ReactNode; tone?: StatusBadgeTone }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="grid gap-2 sm:grid-cols-[9rem_1fr]">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${toneTextClass(
              item.tone,
            )}`}
          >
            {item.label}
          </p>
          <div className="text-xs leading-5 text-slate-300">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function InlineSignalStrip({
  items,
  label,
}: {
  items: StreamSignal[];
  label: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        {items.map((item) => (
          <span key={item.label} className="text-xs text-slate-500">
            {item.label}:{' '}
            <span className={`font-semibold ${toneTextClass(item.tone)}`}>
              {item.value === null || item.value === undefined
                ? 'Unknown'
                : item.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function CompactPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="editorial-panel overflow-hidden rounded-lg">
      <div className="editorial-panel-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="editorial-eyebrow">{title}</p>
            {subtitle ? (
              <p className="mt-1 text-sm leading-5 text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
      <div className="editorial-panel-body">{children}</div>
    </section>
  );
}

export function PrototypeSectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="editorial-eyebrow">{eyebrow}</p> : null}
        <h3 className="mt-1 text-base font-semibold text-slate-100">{title}</h3>
        {subtitle ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EditorialRow({
  title,
  subtitle,
  meta,
  tone = 'neutral',
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  tone?: StatusBadgeTone;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const toneBar =
    tone === 'danger'
      ? 'bg-[var(--color-rose)]'
      : tone === 'warning'
        ? 'bg-[var(--color-amber)]'
        : tone === 'success'
          ? 'bg-[var(--color-green)]'
          : tone === 'info'
            ? 'bg-[var(--color-teal)]'
            : 'bg-[var(--color-navy-border)]';

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--color-navy-border)] bg-white/4 transition hover:bg-white/10">
      <div className={`absolute inset-y-0 left-0 w-0.5 ${toneBar}`} />
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5 pl-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-5 text-slate-100">
              {title}
            </p>
            {meta}
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
          ) : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function StatusStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    tone: StatusBadgeTone;
    detail?: string;
  }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 px-3 py-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {item.label}
            </p>
            <StatusBadge status={String(item.value)} tone={item.tone} />
          </div>
          {item.detail ? (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {item.detail}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ReasoningCard({
  eyebrow,
  title,
  subtitle,
  tone = 'info',
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tone?: StatusBadgeTone;
  action?: ReactNode;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10'
      : tone === 'warning'
        ? 'border-[var(--color-amber)]/35 bg-[var(--color-amber)]/10'
        : tone === 'success'
          ? 'border-[var(--color-green)]/30 bg-[var(--color-green)]/10'
          : 'border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10';

  return (
    <section className={`rounded-lg border p-3 ${toneClass}`}>
      <PrototypeSectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        action={action}
      />
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function InlineReviewBar({
  note,
  children,
}: {
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-navy-border)] pt-3">
      {note ? (
        <p className="min-w-[12rem] flex-1 text-xs italic leading-5 text-slate-500">
          {note}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function CompactMetricGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number | null | undefined;
    tone?: StatusBadgeTone;
  }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-md bg-white/4 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {item.label}
          </p>
          <p
            className={[
              'mt-1 text-sm font-semibold',
              item.tone === 'danger'
                ? 'text-[var(--color-rose)]'
                : item.tone === 'warning'
                  ? 'text-[var(--color-amber)]'
                  : item.tone === 'success'
                    ? 'text-[var(--color-green)]'
                    : item.tone === 'info'
                      ? 'text-[var(--color-teal)]'
                      : 'text-slate-100',
            ].join(' ')}
          >
            {item.value === null || item.value === undefined
              ? 'Unknown'
              : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ClinicalSignalList({
  title,
  items,
  empty,
  tone = 'warning',
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: StatusBadgeTone;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </p>
        <StatusBadge status={String(items.length)} tone={items.length ? tone : 'success'} />
      </div>
      {items.length ? (
        <div className="space-y-1">
          {items.slice(0, 5).map((item) => (
            <p key={item} className="text-xs leading-5 text-slate-300">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-slate-500">{empty}</p>
      )}
    </div>
  );
}

export function CompactSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function CollapsibleDetail({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group rounded-lg border border-[var(--color-navy-border)] bg-white/4"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
        <span>
          <span className="block text-sm font-semibold text-slate-100">
            {title}
          </span>
          {summary ? (
            <span className="mt-0.5 block text-xs leading-5 text-slate-500">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-[var(--color-navy-border)] p-3">
        {children}
      </div>
    </details>
  );
}

export function IssueSummaryStrip({
  blockers,
  warnings,
}: {
  blockers: string[];
  warnings: string[];
}) {
  if (!blockers.length && !warnings.length) {
    return (
      <div className="rounded-lg border border-[var(--color-green)]/25 bg-[var(--color-green)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-green)]">
        No blockers or warnings reported.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {blockers.length ? (
        <IssueBucket title="Blockers" tone="blocker" items={blockers} />
      ) : null}
      {warnings.length ? (
        <IssueBucket title="Warnings" tone="warning" items={warnings} />
      ) : null}
    </div>
  );
}

export function SectionActionGroup({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function ChipOverflowRow({
  items,
  limit = 3,
}: {
  items: ChipItem[];
  limit?: number;
}) {
  const visible = items.slice(0, limit);
  const hidden = items.slice(limit);

  if (!items.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((item) =>
        item.className ? (
          <span
            key={item.id}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${item.className}`}
          >
            {item.label}
          </span>
        ) : (
          <StatusBadge
            key={item.id}
            status={item.label}
            tone={item.tone ?? 'neutral'}
          />
        ),
      )}
      {hidden.length ? (
        <details className="group relative">
          <summary className="inline-flex cursor-pointer list-none rounded-full border border-[var(--color-navy-border)] bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:bg-white/10">
            +{hidden.length}
          </summary>
          <div className="absolute right-0 z-20 mt-2 grid min-w-48 gap-1 rounded-lg border border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] p-2 shadow-xl">
            {hidden.map((item) => (
              <span
                key={item.id}
                className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300"
              >
                {item.label}
              </span>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function SecondaryActionDisclosure({
  label = 'More actions',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-[var(--color-navy-border)] bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10">
        {label}
        <ChevronDown
          className="h-3.5 w-3.5 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid min-w-44 gap-2 rounded-lg border border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] p-2 shadow-xl">
        {children}
      </div>
    </details>
  );
}

export function EmptyGuidance({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-navy-border)] bg-white/4 p-3">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function IssueBucket({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'blocker' | 'warning';
  items: string[];
}) {
  const toneClass =
    tone === 'blocker'
      ? 'border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 text-rose-100'
      : 'border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 text-amber-100';

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em]">
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm leading-5">
        {items.slice(0, 3).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {items.length > 3 ? (
        <p className="mt-2 text-xs opacity-75">+{items.length - 3} more</p>
      ) : null}
    </div>
  );
}

export function EditorialEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-navy-border)] bg-white/4 p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function EditorialSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="editorial-skeleton h-8"
          style={{ width: `${94 - index * 9}%` }}
        />
      ))}
    </div>
  );
}

export function WorkspaceLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <section className="editorial-panel rounded-lg p-5">
        <div className="max-w-3xl">
          <EditorialSkeleton rows={4} />
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-4">
          <CompactPanel
            title="Loading workspace"
            subtitle="Fetching maturity, coverage, audit, and graph signals."
          >
            <EditorialSkeleton rows={6} />
          </CompactPanel>
          <CompactPanel title="Loading editorial signals">
            <EditorialSkeleton rows={5} />
          </CompactPanel>
        </main>
        <aside className="space-y-4">
          <CompactPanel title="Loading copilot rail">
            <EditorialSkeleton rows={5} />
          </CompactPanel>
        </aside>
      </div>
    </div>
  );
}

export function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/8"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {item.value === null || item.value === undefined
              ? 'Unknown'
              : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function MessageList({
  title,
  tone,
  messages,
}: {
  title: string;
  tone: 'warning' | 'blocker';
  messages: string[];
}) {
  return (
    <div
      className={[
        'rounded-lg border px-3 py-2',
        tone === 'blocker'
          ? 'border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10'
          : 'border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10',
      ].join(' ')}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      {messages.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {messages.slice(0, 5).map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None</p>
      )}
    </div>
  );
}

export function CoverageStatusBlock({
  label,
  status,
}: {
  label: string;
  status: WorkspaceCoverageMatrixRow['educationCoverage'];
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-3">
      <p className="text-sm font-semibold text-slate-100">{label}</p>
      <div className="mt-2">
        <CoverageStatusPill status={status} />
      </div>
    </div>
  );
}

export function CoverageStatusPill({
  status,
}: {
  status: WorkspaceCoverageMatrixRow['educationCoverage'];
}) {
  const tone =
    status === 'covered'
      ? 'success'
      : status === 'missing'
        ? 'danger'
        : status === 'partial'
          ? 'warning'
          : 'neutral';

  return <StatusBadge status={formatLabel(status)} tone={tone} />;
}

export function RelationshipActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="editorial-action disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function DrawerActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="editorial-action text-left text-sm"
    >
      {label}
    </button>
  );
}

export function ExplainabilityMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: StatusBadgeTone;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <StatusBadge status={value} tone={tone} />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

export function DraftAIActionsPanel({
  actions,
  empty,
}: {
  actions: Array<{
    id: string;
    label: string;
    detail: string;
    disabled?: boolean;
    onAction?: () => void;
  }>;
  empty?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <WandSparkles
          className="h-4 w-4 text-[var(--color-teal)]"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
          Draft-only AI actions
        </p>
      </div>
      {actions.length ? (
        <div className="mt-3 grid gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={action.onAction}
              className="rounded-lg border border-[var(--color-teal)]/25 bg-[var(--color-teal)]/10 px-3 py-2 text-left transition hover:bg-[var(--color-teal)]/15 disabled:cursor-not-allowed disabled:border-[var(--color-navy-border)] disabled:bg-white/5 disabled:opacity-60"
            >
              <span className="text-sm font-semibold text-slate-100">
                {action.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">
                {action.detail}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          {empty ?? 'No draft AI actions are available for this view.'}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        These actions create or regenerate drafts for editor review; they do not
        publish or activate output automatically.
      </p>
    </div>
  );
}

export function TabNextStepCard({
  title,
  description,
  actionLabel,
  onAction,
  disabled = false,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="editorial-panel rounded-lg border-dashed p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-amber)]">
        Editor next step
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-teal)]/35 bg-[var(--color-teal)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-teal)] transition hover:bg-[var(--color-teal)]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
