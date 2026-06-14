import type { ReactNode } from 'react';
import { ArrowDownRight, Sparkles } from 'lucide-react';

import StatusBadge from '../../../components/ui/StatusBadge';
import type {
  MimicEliminationLike,
  StatusBadgeTone,
} from '../../../components/ui/statusBadgeMeta';
import {
  mimicStateTone,
  toneBgClass,
  toneBorderClass,
  toneTextClass,
} from '../../../components/ui/statusBadgeMeta';
import { formatLabel } from './workspaceTransforms';

export function EditorialNarrativeThread({
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
            <h3 className="font-display text-base font-light italic leading-6 text-slate-100">
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
      <div className="mt-3 space-y-3">{children}</div>
    </article>
  );
}

export function NarrativeStream({ children }: { children: ReactNode }) {
  return (
    <div className="relative space-y-3 pl-5">
      <div
        className="absolute top-1 bottom-1 left-[7px] w-px bg-white/10"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

function toneDotClass(tone?: StatusBadgeTone) {
  if (tone === 'danger') return 'bg-[var(--color-rose)]';
  if (tone === 'warning') return 'bg-[var(--color-amber)]';
  if (tone === 'success') return 'bg-[var(--color-green)]';
  if (tone === 'info') return 'bg-[var(--color-teal)]';
  return 'bg-slate-500';
}

export function NarrativeCheckpoint({
  marker,
  title,
  tone = 'neutral',
  state,
  children,
}: {
  marker?: ReactNode;
  title: ReactNode;
  tone?: StatusBadgeTone;
  state?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative">
      <span
        className={`absolute top-3 -left-5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-navy-mid)] ${toneDotClass(
          tone,
        )}`}
        aria-hidden="true"
      />
      <div
        className={`rounded-lg border ${toneBorderClass(tone)} ${toneBgClass(
          tone,
        )} p-3`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {marker}
          </div>
          {state}
        </div>
        <p className="mt-2 break-words text-sm leading-6 text-slate-200">
          {title}
        </p>
        {children ? <div className="mt-3 space-y-3">{children}</div> : null}
      </div>
    </div>
  );
}

export function ReasoningTransition({
  tone = 'info',
  children,
}: {
  tone?: StatusBadgeTone;
  children: ReactNode;
}) {
  return (
    <div className="relative flex items-start gap-2 py-0.5">
      <ArrowDownRight
        className={`absolute -left-5 top-0.5 h-3 w-3 ${toneTextClass(tone)}`}
        aria-hidden="true"
      />
      <p className={`text-xs italic leading-5 ${toneTextClass(tone)}`}>
        {children}
      </p>
    </div>
  );
}

export function DiscriminatorReveal({
  label,
  strength,
  evidence,
}: {
  label: string;
  strength?: string;
  evidence?: string;
}) {
  return (
    <span className="inline-flex max-w-full flex-col gap-0.5 rounded-md border border-[var(--color-green)]/25 bg-[var(--color-green)]/10 px-2 py-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-green)]">
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
        {label}
        {strength ? ` · ${formatLabel(strength)}` : ''}
      </span>
      {evidence ? (
        <span className="text-[10px] leading-4 text-slate-400">
          {evidence}
        </span>
      ) : null}
    </span>
  );
}

export function LearnerFailureProjection({
  tone = 'warning',
  children,
}: {
  tone?: StatusBadgeTone;
  children: ReactNode;
}) {
  return (
    <p
      className={`rounded-md border px-3 py-2 text-xs leading-5 ${toneBorderClass(
        tone,
      )} ${toneBgClass(tone)} ${toneTextClass(tone)}`}
    >
      <span className="font-semibold">If a learner reaches here: </span>
      <span className="text-slate-300">{children}</span>
    </p>
  );
}

export function MimicStateIndicator({
  finalStatus,
  eliminationStrength,
  prematureCollapseRisk,
  remainingConfusionRisk,
}: MimicEliminationLike) {
  const tone = mimicStateTone({
    finalStatus,
    eliminationStrength,
    prematureCollapseRisk,
    remainingConfusionRisk,
  });

  let label = formatLabel(finalStatus);
  if (finalStatus === 'persistent' || prematureCollapseRisk) {
    label = 'Still a live threat';
  } else if (finalStatus === 'unresolved') {
    label = 'Unresolved';
  } else if (finalStatus === 'eliminated') {
    label = remainingConfusionRisk
      ? 'Eliminated — confusion lingers'
      : `Eliminated (${formatLabel(eliminationStrength ?? 'unknown')})`;
  }

  return <StatusBadge status={label} tone={tone} />;
}
