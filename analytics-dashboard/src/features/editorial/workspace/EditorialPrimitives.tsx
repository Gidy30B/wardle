import type { ReactNode } from 'react';
import { ArrowRight, WandSparkles } from 'lucide-react';

import type { WorkspaceCoverageMatrixRow } from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';
import { formatLabel } from './workspaceTransforms';

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
          <p className="mt-1 text-sm font-semibold text-slate-900">
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
          ? 'border-rose-200 bg-rose-50'
          : 'border-amber-200 bg-amber-50',
      ].join(' ')}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {messages.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
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
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
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
