import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../core/db/prisma.service.js';
import type {
  AuthorityAssignment,
  AuthorityScope,
} from '../editorial-governance/authority-assignment/index.js';

type AuthorityAssignmentClient = Prisma.TransactionClient | PrismaService;

type RuntimeAssignmentRecord = {
  id: string;
  assignmentSchemaVersion: string;
  subjectType: string;
  subjectId: string;
  authorityType: string;
  authorityTypeSchemaVersion: string;
  status: string;
  scopeMode: string;
  scope: unknown;
  allowedDecisionTypes: string[];
  authorityEvidenceReference: string;
  grantingAuthoritySnapshot: unknown;
  grantedByActorType: string;
  grantedByActorId: string;
  grantingAuthorityAssignmentId: string;
  grantedAt: Date;
  validFrom: Date;
  validUntil: Date | null;
  reviewDueAt: Date | null;
  rationale: string;
  delegationAllowed: boolean;
  maximumDelegationDepth: number;
  parentAssignmentId: string | null;
  humanAuthorityActorId: string | null;
  suspendedAt: Date | null;
  revokedAt: Date | null;
  revokedByActorId: string | null;
  supersededByAssignmentId: string | null;
};

@Injectable()
export class EditorialAuthorityAssignmentRepository {
  async loadCandidatesForApproval(
    client: AuthorityAssignmentClient,
    input: {
      actorUserId: string;
      authorityType: string;
      decisionType: string;
      assignmentReferences?: string[];
    },
  ): Promise<AuthorityAssignment[]> {
    const where: Record<string, unknown> = {
      subjectType: 'USER',
      subjectId: input.actorUserId,
      authorityType: input.authorityType,
      allowedDecisionTypes: {
        has: input.decisionType,
      },
    };

    if (input.assignmentReferences && input.assignmentReferences.length > 0) {
      where.id = { in: input.assignmentReferences };
    }

    const records = await (client as any).editorialAuthorityAssignment.findMany({
      where,
      orderBy: [{ grantedAt: 'desc' }, { id: 'asc' }],
    });

    return (records as RuntimeAssignmentRecord[]).map((record) =>
      this.toAuthorityAssignment(record),
    );
  }

  private toAuthorityAssignment(
    record: RuntimeAssignmentRecord,
  ): AuthorityAssignment {
    return {
      assignmentId: record.id,
      assignmentSchemaVersion:
        record.assignmentSchemaVersion as AuthorityAssignment['assignmentSchemaVersion'],
      subjectType: record.subjectType as AuthorityAssignment['subjectType'],
      subjectId: record.subjectId,
      authorityType: record.authorityType,
      authorityTypeSchemaVersion: record.authorityTypeSchemaVersion,
      status: record.status as AuthorityAssignment['status'],
      scopeMode: record.scopeMode as AuthorityAssignment['scopeMode'],
      scope: this.toScope(record.scope),
      allowedDecisionTypes: record.allowedDecisionTypes,
      authorityEvidenceReference: record.authorityEvidenceReference,
      grantingAuthoritySnapshot: this.toRecord(record.grantingAuthoritySnapshot),
      grantedByActorType:
        record.grantedByActorType as AuthorityAssignment['grantedByActorType'],
      grantedByActorId: record.grantedByActorId,
      grantingAuthorityAssignmentId: record.grantingAuthorityAssignmentId,
      grantedAt: record.grantedAt.toISOString(),
      validFrom: record.validFrom.toISOString(),
      validUntil: record.validUntil?.toISOString(),
      reviewDueAt: record.reviewDueAt?.toISOString(),
      rationale: record.rationale,
      delegationAllowed: record.delegationAllowed,
      maximumDelegationDepth: record.maximumDelegationDepth,
      parentAssignmentId: record.parentAssignmentId ?? undefined,
      humanAuthorityActorId: record.humanAuthorityActorId ?? undefined,
      suspendedAt: record.suspendedAt?.toISOString(),
      revokedAt: record.revokedAt?.toISOString(),
      revokedByActorId: record.revokedByActorId ?? undefined,
      supersededByAssignmentId: record.supersededByAssignmentId ?? undefined,
    };
  }

  private toScope(value: unknown): AuthorityScope {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }
    return value as AuthorityScope;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }
}
