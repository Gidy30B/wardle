import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { ContentCoverageRow } from '../components/ContentCoverageRow.tsx';
import { ContentTeachingRiskCard } from '../components/ContentTeachingRiskCard.tsx';
import { EducationCoverageCard } from '../components/EducationCoverageCard.tsx';
import {
  EducationCandidatePacketList,
  EducationRevisionPacket,
} from '../components/EducationWorkPackets.tsx';
import type { EducationBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import type { WorkspacePacketTarget } from '../viewModels/workflowNavigationViewModel.ts';

export function EducationBoard({
  board,
  actionAccess,
  pendingAction,
  activePacketTarget,
  onRunAction,
}: {
  board: EducationBoardViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  activePacketTarget?: WorkspacePacketTarget | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail="Learner-facing content should address the diagnostic contest, discriminating features, and unsupported claims."
        tone={board.tone}
      />

      <CompactPanel
        title="Education revision standing"
        subtitle={board.standingSummary.detail}
      >
        <div className="grid gap-2 md:grid-cols-3">
          {board.standingSummary.rows.map((row) => (
            <div
              key={row.label}
              className="rounded-md border border-white/10 bg-white/[0.03] p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {row.label}
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-slate-100">
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </CompactPanel>

      <CompactPanel title="Learner content section coverage">
        {board.sections.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {board.sections.map((section) => (
              <EducationCoverageCard
                key={section.id}
                section={section}
                actionAccess={actionAccess}
                pendingAction={pendingAction}
                onRunAction={onRunAction}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No learner content sections projected"
            detail="Learner content sections will appear once education content is available."
          />
        )}
      </CompactPanel>

      <EducationCandidatePacketList
        packets={board.candidatePackets}
        actionAccess={actionAccess}
        pendingAction={pendingAction}
        activePacketId={
          activePacketTarget?.type === 'educationCandidate'
            ? activePacketTarget.id
            : null
        }
        onRunAction={onRunAction}
      />

      {board.revisionPacket ? (
        <CompactPanel
          title="Education revision work packet"
          subtitle="Exact revision review is separate from candidate application and publication authorization."
        >
          <EducationRevisionPacket
            packet={board.revisionPacket}
            actionAccess={actionAccess}
            pendingAction={pendingAction}
            highlighted={
              activePacketTarget?.type === 'educationRevision' &&
              activePacketTarget.id === board.revisionPacket.id
            }
            onRunAction={onRunAction}
          />
        </CompactPanel>
      ) : null}

      <CompactPanel title="Diagnostic reasoning coverage in learner content">
        {board.coverage.length ? (
          <div className="space-y-3">
            {board.coverage.map((row) => (
              <ContentCoverageRow key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No reasoning coverage in learner content"
            detail="Diagnostic reasoning comparisons will appear here once projected."
          />
        )}
      </CompactPanel>

      {board.teachingRisks.length ? (
        <CompactPanel title="Learner content risks">
          <div className="space-y-3">
            {board.teachingRisks.map((risk) => (
              <ContentTeachingRiskCard key={risk.id} risk={risk} />
            ))}
          </div>
        </CompactPanel>
      ) : null}
    </div>
  );
}
