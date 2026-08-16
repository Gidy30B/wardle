import { Injectable } from '@nestjs/common';

export type CaseReviewContextSnapshotPurpose =
  | 'REVIEW_OPENING'
  | 'DECISION_SUBMISSION'
  | 'PUBLICATION_READINESS';

export type CaseEditorialDecisionType =
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_CHANGES'
  | 'MARK_READY_TO_PUBLISH';

export type PublicationReadinessOutcome = 'READY' | 'BLOCKED' | 'STALE';

export type CaseReviewEventType =
  | 'REVIEW_OPENED'
  | 'REVIEW_REFRESHED'
  | 'REVIEW_ASSIGNED'
  | 'REVIEW_CANCELLED'
  | 'DECISION_SUBMITTED'
  | 'PUBLICATION_READINESS_DECIDED'
  | 'SNAPSHOT_INVALIDATED';

type CaseReviewGovernanceClient = {
  caseReviewContextSnapshot: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      caseReviewId: string;
      caseId: string;
      revisionId: string;
      purpose: CaseReviewContextSnapshotPurpose;
    } | null>;
    findMany: (args: unknown) => Promise<CaseReviewHistoryRecord[]>;
  };
  caseEditorialDecision: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<CaseReviewHistoryRecord[]>;
  };
  caseReviewEvent: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<CaseReviewHistoryRecord[]>;
  };
};

export type CreateCaseEditorialDecisionInput = {
  caseReviewId: string;
  contextSnapshotId: string;
  caseId: string;
  revisionId: string;
  decisionType: CaseEditorialDecisionType;
  actorUserId: string;
  actorRole: string;
  rationale: string;
  previousEditorialStatus?: string | null;
  resultingEditorialStatus?: string | null;
  supportingValidationRunId?: string | null;
  readinessOutcome?: PublicationReadinessOutcome | null;
  blockers?: unknown;
  warnings?: unknown;
  approvingDecisionId?: string | null;
  correlationId?: string | null;
};

export type CreateCaseReviewEventInput = {
  caseReviewId?: string | null;
  caseId: string;
  revisionId?: string | null;
  eventType: CaseReviewEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  payload?: unknown;
  correlationId?: string | null;
};

type CaseReviewHistoryRecord = {
  id: string;
  createdAt: Date;
};

export type CaseReviewHistoryEntry = CaseReviewHistoryRecord & {
  kind: 'CONTEXT_SNAPSHOT' | 'EDITORIAL_DECISION' | 'REVIEW_EVENT';
};

@Injectable()
export class CaseReviewGovernanceRepository {
  async createEditorialDecision(
    client: CaseReviewGovernanceClient,
    input: CreateCaseEditorialDecisionInput,
  ) {
    const rationale = input.rationale.trim();

    if (!rationale) {
      throw new Error(
        'Case editorial decisions require a non-empty rationale.',
      );
    }

    const snapshot = await client.caseReviewContextSnapshot.findUnique({
      where: { id: input.contextSnapshotId },
      select: {
        id: true,
        caseReviewId: true,
        caseId: true,
        revisionId: true,
        purpose: true,
      },
    });

    if (!snapshot) {
      throw new Error(
        'Case editorial decision requires an existing context snapshot.',
      );
    }

    if (
      snapshot.caseReviewId !== input.caseReviewId ||
      snapshot.caseId !== input.caseId ||
      snapshot.revisionId !== input.revisionId
    ) {
      throw new Error(
        'Case editorial decision must target the same review, case, and revision as its context snapshot.',
      );
    }

    if (input.decisionType === 'MARK_READY_TO_PUBLISH') {
      if (snapshot.purpose !== 'PUBLICATION_READINESS') {
        throw new Error(
          'Mark-ready decisions must be based on a publication-readiness context snapshot.',
        );
      }

      if (!input.approvingDecisionId) {
        throw new Error(
          'Mark-ready decisions require a linked approving editorial decision.',
        );
      }

      if (!input.readinessOutcome) {
        throw new Error('Mark-ready decisions require a readiness outcome.');
      }
    }

    return client.caseEditorialDecision.create({
      data: {
        ...input,
        rationale,
      },
    });
  }

  async recordEvent(
    client: CaseReviewGovernanceClient,
    input: CreateCaseReviewEventInput,
  ) {
    return client.caseReviewEvent.create({
      data: input,
    });
  }

  async listCaseHistory(
    client: CaseReviewGovernanceClient,
    caseId: string,
  ): Promise<CaseReviewHistoryEntry[]> {
    const [snapshots, decisions, events] = await Promise.all([
      client.caseReviewContextSnapshot.findMany({
        where: { caseId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      client.caseEditorialDecision.findMany({
        where: { caseId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      client.caseReviewEvent.findMany({
        where: { caseId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return [
      ...snapshots.map((record) => ({
        ...record,
        kind: 'CONTEXT_SNAPSHOT' as const,
      })),
      ...decisions.map((record) => ({
        ...record,
        kind: 'EDITORIAL_DECISION' as const,
      })),
      ...events.map((record) => ({
        ...record,
        kind: 'REVIEW_EVENT' as const,
      })),
    ].sort((left, right) => {
      const createdAtDelta =
        left.createdAt.getTime() - right.createdAt.getTime();

      if (createdAtDelta !== 0) return createdAtDelta;

      return left.id.localeCompare(right.id);
    });
  }
}
