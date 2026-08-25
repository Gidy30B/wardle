import type { ReactNode } from 'react';
import StatusBadge from '../../../../components/ui/StatusBadge.tsx';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import {
  CompactPanel,
  IssueSummaryStrip,
} from '../EditorialPrimitives.tsx';
import type {
  EducationCandidatePacketViewModel,
  EducationGovernanceHistoryEntry,
  EducationPacketFact,
  EducationPublicationPacketViewModel,
  EducationRevisionPacketViewModel,
  EducationWorkPacketTone,
} from '../viewModels/educationWorkPacketViewModel.ts';
import { WorkspaceReviewActionButtons } from './WorkspaceReviewActionButtons.tsx';

export function EducationCandidatePacket({
  packet,
  actionAccess,
  pendingAction,
  highlighted = false,
  onRunAction,
}: {
  packet: EducationCandidatePacketViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  highlighted?: boolean;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <PacketShell
      eyebrow="Education Candidate"
      title={packet.title}
      subtitle={packet.purpose.nextStep}
      tone={packet.tone}
      status={packet.statusLabel}
      highlighted={highlighted}
    >
      <FactGrid items={packet.identity} />

      <div className="grid gap-3 lg:grid-cols-2">
        <PacketBlock title={packet.currentMaterial.title}>
          <JsonPreview value={packet.currentMaterial.content} />
        </PacketBlock>
        <PacketBlock title={packet.proposedMaterial.title}>
          <JsonPreview value={packet.proposedMaterial.content} />
        </PacketBlock>
      </div>

      {packet.proposedMaterial.references ? (
        <PacketBlock title="Proposed references">
          <JsonPreview value={packet.proposedMaterial.references} />
        </PacketBlock>
      ) : null}

      <IssueSummaryStrip
        blockers={packet.validation.blockers}
        warnings={packet.validation.warnings}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <PacketBlock title="Generation provenance">
          <FactList items={packet.provenance} />
        </PacketBlock>
        <PacketBlock title="Governance history">
          <HistoryList entries={packet.history} />
        </PacketBlock>
      </div>

      {packet.application.stale || packet.application.failureReason ? (
        <p className="rounded-md border border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10 px-3 py-2 text-sm leading-6 text-rose-100">
          {packet.application.failureReason ??
            'Candidate was based on an older Education revision. Current Education has changed and nothing was applied.'}
        </p>
      ) : null}

      <WorkspaceReviewActionButtons
        actionIds={packet.actionIds}
        access={actionAccess}
        payload={{
          candidateId: packet.id,
          note: defaultCandidateNote(packet),
        }}
        pendingAction={pendingAction}
        subjectId={packet.id}
        subjectLabel={packet.title}
        includeConfirmationActions
        confirmationMessage={packet.application.confirmationMessage}
        onRunAction={onRunAction}
      />
    </PacketShell>
  );
}

export function EducationRevisionPacket({
  packet,
  actionAccess,
  pendingAction,
  highlighted = false,
  onRunAction,
}: {
  packet: EducationRevisionPacketViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  highlighted?: boolean;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <PacketShell
      eyebrow="Education Revision"
      title={packet.title}
      subtitle={packet.question}
      tone={packet.tone}
      status="Exact revision"
      highlighted={highlighted}
    >
      <FactGrid items={packet.identity} />
      <FactGrid items={packet.standing} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PacketBlock title="Revision material">
          <JsonPreview value={packet.content} />
        </PacketBlock>
        <div className="space-y-3">
          <PacketBlock title="Origin">
            <FactList items={packet.origin} />
          </PacketBlock>
          <PacketBlock title="Governance history">
            <HistoryList entries={packet.history} />
          </PacketBlock>
        </div>
      </div>

      <IssueSummaryStrip
        blockers={packet.validation.blockers}
        warnings={packet.validation.warnings}
      />

      <WorkspaceReviewActionButtons
        actionIds={packet.actionIds}
        access={actionAccess}
        payload={{
          ...packet.actionTarget,
          note: 'Workspace exact Education revision decision.',
        }}
        pendingAction={pendingAction}
        subjectId={packet.id}
        subjectLabel={packet.title}
        includeConfirmationActions
        confirmationMessage={packet.confirmationMessage}
        onRunAction={onRunAction}
      />
    </PacketShell>
  );
}

export function EducationPublicationPacket({
  packet,
  actionAccess,
  pendingAction,
  highlighted = false,
  onRunAction,
}: {
  packet: EducationPublicationPacketViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  highlighted?: boolean;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <PacketShell
      eyebrow="Education Publication"
      title={packet.title}
      subtitle={packet.question}
      tone={packet.tone}
      status={packet.readiness.result}
      highlighted={highlighted}
    >
      <FactGrid items={packet.identity} />
      <FactGrid items={packet.standing} />

      <IssueSummaryStrip blockers={packet.blockers} warnings={packet.warnings} />

      <WorkspaceReviewActionButtons
        actionIds={packet.actionIds}
        access={actionAccess}
        payload={{
          ...packet.actionTarget,
          expectedApprovalDecisionId:
            packet.actionTarget.expectedApprovalDecisionId ?? undefined,
          expectedActivePublicationDecisionId:
            packet.actionTarget.expectedActivePublicationDecisionId ?? undefined,
          note: 'Workspace exact Education publication authorization.',
        }}
        pendingAction={pendingAction}
        subjectId={packet.id}
        subjectLabel={packet.title}
        includeConfirmationActions
        confirmationMessage={packet.confirmationMessage}
        onRunAction={onRunAction}
      />
    </PacketShell>
  );
}

export function EducationCandidatePacketList({
  packets,
  actionAccess,
  pendingAction,
  activePacketId,
  onRunAction,
}: {
  packets: EducationCandidatePacketViewModel[];
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  activePacketId?: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  if (!packets.length) {
    return null;
  }

  return (
    <CompactPanel
      title="Education candidate work packets"
      subtitle="AI Education output remains candidate knowledge until human review and separate controlled application."
    >
      <div className="space-y-3">
        {packets.map((packet) => (
          <EducationCandidatePacket
            key={packet.id}
            packet={packet}
            actionAccess={actionAccess}
            pendingAction={pendingAction}
            highlighted={activePacketId === packet.id}
            onRunAction={onRunAction}
          />
        ))}
      </div>
    </CompactPanel>
  );
}

function PacketShell({
  eyebrow,
  title,
  subtitle,
  status,
  tone,
  highlighted = false,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  status: string;
  tone: EducationWorkPacketTone;
  highlighted?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={[
        'rounded-lg border bg-white/[0.03] p-4',
        highlighted
          ? 'border-[var(--color-teal)] shadow-[0_0_0_1px_rgba(45,212,191,0.25)]'
          : 'border-[var(--color-navy-border)]',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-teal)]">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-100">
            {title}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            {subtitle}
          </p>
        </div>
        <StatusBadge status={status} tone={badgeTone(tone)} />
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </article>
  );
}

function PacketBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-white/10 bg-slate-950/20 p-3 text-sm leading-6 text-slate-300">
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function FactGrid({ items }: { items: EducationPacketFact[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={`${item.label}:${item.value}`}
          className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
        >
          <p className="break-all text-sm font-semibold text-slate-100">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function FactList({ items }: { items: EducationPacketFact[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <p key={`${item.label}:${item.value}`} className="text-xs text-slate-400">
          <span className="font-semibold text-slate-300">{item.label}: </span>
          <span className="break-all">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

function HistoryList({ entries }: { entries: EducationGovernanceHistoryEntry[] }) {
  if (!entries.length) {
    return <p className="text-sm text-slate-500">No governance history projected.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-md bg-white/[0.03] px-3 py-2">
          <p className="text-sm font-semibold text-slate-200">{entry.event}</p>
          <p className="mt-1 text-xs text-slate-500">
            {entry.actorUserId ?? 'System'} - {entry.at ?? 'Time not recorded'}
          </p>
          {entry.rationale ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {entry.rationale}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-slate-500">No material projected.</p>;
  }
  if (typeof value === 'string') {
    return <p className="whitespace-pre-wrap text-sm text-slate-300">{value}</p>;
  }

  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 p-3 text-xs leading-5 text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function defaultCandidateNote(packet: EducationCandidatePacketViewModel): string {
  if (packet.actionIds.includes('educationCandidate.apply')) {
    return 'Workspace controlled application of accepted Education candidate.';
  }
  return 'Workspace Education candidate review decision.';
}

function badgeTone(tone: EducationWorkPacketTone) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'success') return 'success';
  if (tone === 'info') return 'info';
  return 'neutral';
}
