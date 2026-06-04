import { Injectable } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisRegistryCandidateStatus,
  DifferentialResolutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type EditorialInboxItemType =
  | 'teachingRules'
  | 'briefs'
  | 'education'
  | 'cases'
  | 'graphCandidates'
  | 'differentials'
  | 'registryCandidates'
  | 'onboarding'
  | 'mergeRisks';

export type EditorialInboxSeverity = 'blocker' | 'urgent' | 'normal' | 'low';

export type EditorialInboxQuery = {
  type?: string;
  severity?: string;
  status?: string;
  specialty?: string;
  limit?: number;
  page?: number;
};

export type EditorialReviewInboxItem = {
  id: string;
  type: EditorialInboxItemType;
  title: string;
  subtitle: string;
  status: string;
  severity: EditorialInboxSeverity;
  diagnosisRegistryId: string | null;
  diagnosisLabel: string | null;
  specialty: string | null;
  sourceId: string;
  sourcePath: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  targetUrl: string;
  recommendedAction: string;
  blockerReason?: string;
};

export type EditorialReviewInboxResponse = {
  summary: {
    total: number;
    urgent: number;
    needsReview: number;
    blockers: number;
    byType: Record<EditorialInboxItemType, number>;
  };
  items: EditorialReviewInboxItem[];
};

const INBOX_TYPES: EditorialInboxItemType[] = [
  'teachingRules',
  'briefs',
  'education',
  'cases',
  'graphCandidates',
  'differentials',
  'registryCandidates',
  'onboarding',
  'mergeRisks',
];

const TEACHING_RULE_STATUSES = ['CANDIDATE', 'NEEDS_REVIEW', 'DRAFT'];
const BRIEF_STATUSES = ['NEEDS_REVIEW', 'DRAFT', 'INACTIVE'];
const EDUCATION_STATUSES = [
  DiagnosisEducationStatus.GENERATED,
  DiagnosisEducationStatus.NEEDS_REVIEW,
  DiagnosisEducationStatus.NEEDS_EDIT,
  DiagnosisEducationStatus.APPROVED,
];
const CASE_STATUSES = [
  CaseEditorialStatus.REVIEW,
  CaseEditorialStatus.NEEDS_EDIT,
  CaseEditorialStatus.APPROVED,
  CaseEditorialStatus.READY_TO_PUBLISH,
];
const DIFFERENTIAL_STATUSES = [
  DifferentialResolutionStatus.UNRESOLVED,
  DifferentialResolutionStatus.AMBIGUOUS,
];
const REGISTRY_CANDIDATE_STATUSES = [
  DiagnosisRegistryCandidateStatus.CANDIDATE,
  DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
  DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
];
const ONBOARDING_STATUSES = [
  DiagnosisEditorialOnboardingStatus.NEW,
  DiagnosisEditorialOnboardingStatus.RULES_STARTED,
  DiagnosisEditorialOnboardingStatus.BRIEF_STARTED,
  DiagnosisEditorialOnboardingStatus.EDUCATION_STARTED,
  DiagnosisEditorialOnboardingStatus.CASE_STARTED,
  DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
];

@Injectable()
export class EditorialReviewInboxService {
  constructor(private readonly prisma: PrismaService) {}

  async getInbox(
    query: EditorialInboxQuery = {},
  ): Promise<EditorialReviewInboxResponse> {
    const rawItems = await this.collectItems(query);
    const filtered = this.applyFilters(rawItems, query);
    const summary = this.buildSummary(filtered);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 250);
    const items = filtered.slice((page - 1) * limit, page * limit);

    return { summary, items };
  }

  private async collectItems(
    query: EditorialInboxQuery,
  ): Promise<EditorialReviewInboxItem[]> {
    const requestedType = this.parseType(query.type);
    const include = (type: EditorialInboxItemType) =>
      !requestedType || requestedType === type;

    const [
      teachingRules,
      briefs,
      education,
      cases,
      graphCandidates,
      caseDifferentials,
      educationDifferentials,
      registryCandidates,
      onboarding,
      mergeRisks,
    ] = await Promise.all([
      include('teachingRules') ? this.collectTeachingRules() : [],
      include('briefs') ? this.collectBriefs() : [],
      include('education') ? this.collectEducation() : [],
      include('cases') ? this.collectCases() : [],
      include('graphCandidates') ? this.collectGraphCandidates() : [],
      include('differentials') ? this.collectCaseDifferentials() : [],
      include('differentials') ? this.collectEducationDifferentials() : [],
      include('registryCandidates') ? this.collectRegistryCandidates() : [],
      include('onboarding') ? this.collectOnboarding() : [],
      include('mergeRisks') ? this.collectMergeRisks() : [],
    ]);

    return [
      ...teachingRules,
      ...briefs,
      ...education,
      ...cases,
      ...graphCandidates,
      ...caseDifferentials,
      ...educationDifferentials,
      ...registryCandidates,
      ...onboarding,
      ...mergeRisks,
    ].sort((left, right) => {
      const severityDelta =
        severityRank(right.severity) - severityRank(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return dateValue(right.updatedAt ?? right.createdAt) -
        dateValue(left.updatedAt ?? left.createdAt);
    });
  }

  private async collectTeachingRules(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.diagnosisTeachingRule.findMany({
      where: { status: { in: TEACHING_RULE_STATUSES } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        diagnosisRegistryId: true,
        createdAt: true,
        updatedAt: true,
        diagnosisRegistry: this.registrySelect(),
      },
    });

    return rows.map((row) => ({
      id: `teaching-rule:${row.id}`,
      type: 'teachingRules',
      title: row.title,
      subtitle: row.category,
      status: row.status,
      severity: row.status === 'NEEDS_REVIEW' ? 'urgent' : 'normal',
      diagnosisRegistryId: row.diagnosisRegistryId,
      diagnosisLabel: row.diagnosisRegistry.displayLabel,
      specialty: row.diagnosisRegistry.specialty,
      sourceId: row.id,
      sourcePath: 'teachingRules',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetUrl: `/editorial/diagnoses/${row.diagnosisRegistryId}`,
      recommendedAction:
        row.status === 'NEEDS_REVIEW'
          ? 'Review and activate teaching rule'
          : 'Continue teaching rule drafting',
    }));
  }

  private async collectBriefs(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.diagnosisEditorialBrief.findMany({
      where: { status: { in: BRIEF_STATUSES } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        summary: true,
        status: true,
        diagnosisRegistryId: true,
        createdAt: true,
        updatedAt: true,
        diagnosisRegistry: this.registrySelect(),
      },
    });

    return rows.map((row) => ({
      id: `brief:${row.id}`,
      type: 'briefs',
      title: `Editorial brief for ${row.diagnosisRegistry.displayLabel}`,
      subtitle: trimText(row.summary, 120),
      status: row.status,
      severity: row.status === 'NEEDS_REVIEW' ? 'urgent' : 'normal',
      diagnosisRegistryId: row.diagnosisRegistryId,
      diagnosisLabel: row.diagnosisRegistry.displayLabel,
      specialty: row.diagnosisRegistry.specialty,
      sourceId: row.id,
      sourcePath: 'editorialBrief',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetUrl: `/editorial/diagnoses/${row.diagnosisRegistryId}`,
      recommendedAction:
        row.status === 'NEEDS_REVIEW'
          ? 'Review editorial brief'
          : 'Complete editorial brief',
    }));
  }

  private async collectEducation(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.diagnosisEducation.findMany({
      where: { editorialStatus: { in: EDUCATION_STATUSES } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        title: true,
        editorialStatus: true,
        diagnosisRegistryId: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        diagnosisRegistry: this.registrySelect(),
      },
    });

    return rows
      .filter(
        (row) =>
          row.editorialStatus !== DiagnosisEducationStatus.APPROVED ||
          !row.publishedAt,
      )
      .map((row) => ({
        id: `education:${row.id}`,
        type: 'education',
        title: row.title,
        subtitle: `Education draft for ${row.diagnosisRegistry.displayLabel}`,
        status: row.editorialStatus,
        severity:
          row.editorialStatus === DiagnosisEducationStatus.NEEDS_REVIEW ||
          row.editorialStatus === DiagnosisEducationStatus.APPROVED
            ? 'urgent'
            : row.editorialStatus === DiagnosisEducationStatus.NEEDS_EDIT
              ? 'normal'
              : 'normal',
        diagnosisRegistryId: row.diagnosisRegistryId,
        diagnosisLabel: row.diagnosisRegistry.displayLabel,
        specialty: row.diagnosisRegistry.specialty,
        sourceId: row.id,
        sourcePath: 'education',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        targetUrl: `/editorial/diagnoses/${row.diagnosisRegistryId}`,
        recommendedAction:
          row.editorialStatus === DiagnosisEducationStatus.APPROVED
            ? 'Publish approved education'
            : row.editorialStatus === DiagnosisEducationStatus.NEEDS_REVIEW
              ? 'Review education draft'
              : 'Edit education draft',
      }));
  }

  private async collectCases(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.case.findMany({
      where: { editorialStatus: { in: CASE_STATUSES } },
      orderBy: [{ approvedAt: 'desc' }, { date: 'desc' }],
      take: 100,
      select: {
        id: true,
        title: true,
        editorialStatus: true,
        proposedDiagnosisText: true,
        diagnosisRegistryId: true,
        approvedAt: true,
        date: true,
        diagnosisRegistry: this.optionalRegistrySelect(),
      },
    });

    return rows.map((row) => ({
      id: `case:${row.id}`,
      type: 'cases',
      title: row.title,
      subtitle: row.proposedDiagnosisText,
      status: row.editorialStatus ?? 'UNKNOWN',
      severity:
        row.editorialStatus === CaseEditorialStatus.REVIEW ||
        row.editorialStatus === CaseEditorialStatus.APPROVED ||
        row.editorialStatus === CaseEditorialStatus.READY_TO_PUBLISH
          ? 'urgent'
          : 'normal',
      diagnosisRegistryId: row.diagnosisRegistryId,
      diagnosisLabel:
        row.diagnosisRegistry?.displayLabel ?? row.proposedDiagnosisText,
      specialty: row.diagnosisRegistry?.specialty ?? null,
      sourceId: row.id,
      sourcePath: 'case',
      createdAt: row.date,
      updatedAt: row.approvedAt ?? row.date,
      targetUrl: `/cases/${row.id}`,
      recommendedAction:
        row.editorialStatus === CaseEditorialStatus.READY_TO_PUBLISH
          ? 'Confirm publish queue readiness'
          : row.editorialStatus === CaseEditorialStatus.APPROVED
            ? 'Mark case ready to publish'
            : row.editorialStatus === CaseEditorialStatus.REVIEW
              ? 'Review case'
              : 'Address requested case edits',
    }));
  }

  private async collectGraphCandidates(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.diagnosisGraphCandidate.findMany({
      where: { status: DiagnosisGraphCandidateStatus.CANDIDATE },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        type: true,
        status: true,
        rawText: true,
        confidence: true,
        unresolvedTargetText: true,
        diagnosisRegistryId: true,
        sourcePath: true,
        createdAt: true,
        updatedAt: true,
        diagnosisRegistry: this.registrySelect(),
      },
    });

    return rows.map((row) => {
      const unresolvedMimic =
        row.type === 'MIMIC' && row.unresolvedTargetText;
      return {
        id: `graph-candidate:${row.id}`,
        type: 'graphCandidates' as const,
        title: row.rawText,
        subtitle: `${row.type}${row.confidence ? ` · ${row.confidence}` : ''}`,
        status: row.status,
        severity: unresolvedMimic ? 'blocker' : 'urgent',
        diagnosisRegistryId: row.diagnosisRegistryId,
        diagnosisLabel: row.diagnosisRegistry.displayLabel,
        specialty: row.diagnosisRegistry.specialty,
        sourceId: row.id,
        sourcePath: row.sourcePath,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        targetUrl: '/diagnosis-graph/candidates',
        recommendedAction: unresolvedMimic
          ? 'Resolve mimic registry identity'
          : 'Review graph candidate',
        blockerReason: unresolvedMimic
          ? 'Mimic candidate has unresolved target text'
          : undefined,
      };
    });
  }

  private async collectCaseDifferentials(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.caseDifferentialMapping.findMany({
      where: { status: { in: DIFFERENTIAL_STATUSES } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        rawText: true,
        status: true,
        sourcePath: true,
        createdAt: true,
        updatedAt: true,
        case: {
          select: {
            id: true,
            title: true,
            diagnosisRegistryId: true,
            diagnosisRegistry: this.optionalRegistrySelect(),
          },
        },
      },
    });

    return rows.map((row) => ({
      id: `case-differential:${row.id}`,
      type: 'differentials',
      title: row.rawText,
      subtitle: row.case.title,
      status: row.status,
      severity: 'blocker',
      diagnosisRegistryId: row.case.diagnosisRegistryId,
      diagnosisLabel: row.case.diagnosisRegistry?.displayLabel ?? null,
      specialty: row.case.diagnosisRegistry?.specialty ?? null,
      sourceId: row.id,
      sourcePath: row.sourcePath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetUrl: '/editorial/differentials',
      recommendedAction: 'Resolve differential mapping',
      blockerReason: 'Unresolved differential identity',
    }));
  }

  private async collectEducationDifferentials(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.educationDifferentialMapping.findMany({
      where: { status: { in: DIFFERENTIAL_STATUSES } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        rawText: true,
        status: true,
        sourcePath: true,
        diagnosisRegistryId: true,
        createdAt: true,
        updatedAt: true,
        diagnosisRegistry: this.registrySelect(),
      },
    });

    return rows.map((row) => ({
      id: `education-differential:${row.id}`,
      type: 'differentials',
      title: row.rawText,
      subtitle: `Education differential for ${row.diagnosisRegistry.displayLabel}`,
      status: row.status,
      severity: 'blocker',
      diagnosisRegistryId: row.diagnosisRegistryId,
      diagnosisLabel: row.diagnosisRegistry.displayLabel,
      specialty: row.diagnosisRegistry.specialty,
      sourceId: row.id,
      sourcePath: row.sourcePath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetUrl: '/editorial/differentials',
      recommendedAction: 'Resolve education differential mapping',
      blockerReason: 'Unresolved differential identity',
    }));
  }

  private async collectRegistryCandidates(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.diagnosisRegistryCandidate.findMany({
      where: { status: { in: REGISTRY_CANDIDATE_STATUSES } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        proposedCanonicalName: true,
        sourceRawText: true,
        status: true,
        contextDiagnosisRegistryId: true,
        createdAt: true,
        updatedAt: true,
        contextDiagnosisRegistry: this.optionalRegistrySelect(),
      },
    });

    return rows.map((row) => ({
      id: `registry-candidate:${row.id}`,
      type: 'registryCandidates',
      title: row.proposedCanonicalName,
      subtitle: row.sourceRawText,
      status: row.status,
      severity:
        row.status === DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE
          ? 'urgent'
          : row.status === DiagnosisRegistryCandidateStatus.NEEDS_REVIEW
            ? 'urgent'
            : 'normal',
      diagnosisRegistryId: row.contextDiagnosisRegistryId,
      diagnosisLabel: row.contextDiagnosisRegistry?.displayLabel ?? null,
      specialty: row.contextDiagnosisRegistry?.specialty ?? null,
      sourceId: row.id,
      sourcePath: 'registryCandidate',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetUrl: '/editorial/registry-candidates',
      recommendedAction:
        row.status === DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE
          ? 'Create approved registry entry'
          : 'Review registry candidate',
    }));
  }

  private async collectOnboarding(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.diagnosisRegistry.findMany({
      where: { onboardingStatus: { in: ONBOARDING_STATUSES } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        onboardingStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => ({
      id: `onboarding:${row.id}`,
      type: 'onboarding',
      title: row.displayLabel,
      subtitle: row.canonicalName,
      status: row.onboardingStatus ?? 'UNKNOWN',
      severity:
        row.onboardingStatus ===
        DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW
          ? 'urgent'
          : row.onboardingStatus === DiagnosisEditorialOnboardingStatus.NEW
            ? 'low'
            : 'normal',
      diagnosisRegistryId: row.id,
      diagnosisLabel: row.displayLabel,
      specialty: row.specialty,
      sourceId: row.id,
      sourcePath: 'onboarding',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetUrl: `/editorial/diagnoses/${row.id}`,
      recommendedAction:
        row.onboardingStatus ===
        DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW
          ? 'Review onboarding diagnosis'
          : 'Continue onboarding checklist',
    }));
  }

  private async collectMergeRisks(): Promise<EditorialReviewInboxItem[]> {
    const rows = await this.prisma.diagnosisRegistryCandidate.findMany({
      where: {
        status: { in: REGISTRY_CANDIDATE_STATUSES },
        duplicateSuggestions: { not: Prisma.JsonNull },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        proposedCanonicalName: true,
        status: true,
        sourceRawText: true,
        contextDiagnosisRegistryId: true,
        createdAt: true,
        updatedAt: true,
        contextDiagnosisRegistry: this.optionalRegistrySelect(),
      },
    });

    return rows.map((row) => ({
      id: `merge-risk:${row.id}`,
      type: 'mergeRisks',
      title: `Duplicate risk: ${row.proposedCanonicalName}`,
      subtitle: row.sourceRawText,
      status: row.status,
      severity: 'blocker',
      diagnosisRegistryId: row.contextDiagnosisRegistryId,
      diagnosisLabel: row.contextDiagnosisRegistry?.displayLabel ?? null,
      specialty: row.contextDiagnosisRegistry?.specialty ?? null,
      sourceId: row.id,
      sourcePath: 'duplicateSuggestions',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetUrl: row.contextDiagnosisRegistryId
        ? `/editorial/registry-merge?source=${row.contextDiagnosisRegistryId}`
        : '/editorial/registry-candidates',
      recommendedAction: 'Review duplicate/merge risk',
      blockerReason: 'Candidate has duplicate suggestions',
    }));
  }

  private applyFilters(
    items: EditorialReviewInboxItem[],
    query: EditorialInboxQuery,
  ) {
    const type = this.parseType(query.type);
    const severity = this.parseSeverity(query.severity);
    const status = query.status?.trim().toUpperCase();
    const specialty = query.specialty?.trim().toLowerCase();

    return items.filter((item) => {
      if (type && item.type !== type) return false;
      if (severity && item.severity !== severity) return false;
      if (status && item.status.toUpperCase() !== status) return false;
      if (
        specialty &&
        (item.specialty ?? '').trim().toLowerCase() !== specialty
      ) {
        return false;
      }
      return true;
    });
  }

  private buildSummary(items: EditorialReviewInboxItem[]) {
    const byType = Object.fromEntries(
      INBOX_TYPES.map((type) => [type, 0]),
    ) as Record<EditorialInboxItemType, number>;

    for (const item of items) {
      byType[item.type] += 1;
    }

    return {
      total: items.length,
      urgent: items.filter((item) => item.severity === 'urgent').length,
      needsReview: items.filter((item) =>
        ['NEEDS_REVIEW', 'REVIEW', 'READY_FOR_REVIEW'].includes(
          item.status.toUpperCase(),
        ),
      ).length,
      blockers: items.filter((item) => item.severity === 'blocker').length,
      byType,
    };
  }

  private parseType(value?: string): EditorialInboxItemType | undefined {
    if (!value) return undefined;
    return INBOX_TYPES.find((type) => type === value);
  }

  private parseSeverity(value?: string): EditorialInboxSeverity | undefined {
    if (
      value === 'blocker' ||
      value === 'urgent' ||
      value === 'normal' ||
      value === 'low'
    ) {
      return value;
    }
    return undefined;
  }

  private registrySelect() {
    return {
      select: {
        id: true,
        displayLabel: true,
        specialty: true,
      },
    } as const;
  }

  private optionalRegistrySelect() {
    return this.registrySelect();
  }
}

function severityRank(severity: EditorialInboxSeverity): number {
  if (severity === 'blocker') return 4;
  if (severity === 'urgent') return 3;
  if (severity === 'normal') return 2;
  return 1;
}

function dateValue(date: Date | null): number {
  return date?.getTime() ?? 0;
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}
