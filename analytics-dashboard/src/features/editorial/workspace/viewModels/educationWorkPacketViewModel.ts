import type {
  DiagnosisEditorialWorkspace,
  DiagnosisEducationCandidate,
  DiagnosisEducationRevisionAnalysis,
  EducationPublicationReadiness,
  JsonValue,
} from '../../../../api/admin.types.ts';
import type { WorkspaceActionId } from '../actions/workspaceActionTypes.ts';

export type EducationWorkPacketTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export type EducationPacketFact = {
  label: string;
  value: string;
  tone?: EducationWorkPacketTone;
};

export type EducationGovernanceHistoryEntry = {
  id: string;
  event: string;
  actorUserId: string | null;
  at: string | null;
  rationale?: string | null;
  target?: string | null;
};

export type EducationCandidatePacketViewModel = {
  type: 'educationCandidate';
  id: string;
  title: string;
  statusLabel: string;
  tone: EducationWorkPacketTone;
  scopeLabel: string;
  sectionLabel: string | null;
  identity: EducationPacketFact[];
  purpose: {
    generationPurpose: string;
    sourceIssue: string | null;
    nextStep: string;
  };
  currentMaterial: {
    title: string;
    content: JsonValue | null;
  };
  proposedMaterial: {
    title: string;
    content: JsonValue | null;
    references: JsonValue | null;
  };
  validation: {
    status: string;
    passed: boolean;
    blockers: string[];
    warnings: string[];
    metadata: JsonValue | null;
  };
  provenance: EducationPacketFact[];
  history: EducationGovernanceHistoryEntry[];
  actionIds: WorkspaceActionId[];
  application: {
    allowed: boolean;
    stale: boolean;
    status: string;
    failureReason: string | null;
    resultingEducationId: string | null;
    resultingVersion: number | null;
    resultingRevisionId: string | null;
    confirmationMessage: string;
  };
};

export type EducationRevisionPacketViewModel = {
  type: 'educationRevision';
  id: string;
  title: string;
  tone: EducationWorkPacketTone;
  question: string;
  identity: EducationPacketFact[];
  standing: EducationPacketFact[];
  origin: EducationPacketFact[];
  content: JsonValue | null;
  validation: {
    blockers: string[];
    warnings: string[];
  };
  history: EducationGovernanceHistoryEntry[];
  actionIds: WorkspaceActionId[];
  actionTarget: {
    educationId: string;
    revisionId: string;
    expectedVersion: number;
  };
  confirmationMessage: string;
};

export type EducationPublicationPacketViewModel = {
  type: 'educationPublication';
  id: string;
  title: string;
  tone: EducationWorkPacketTone;
  question: string;
  readiness: EducationPublicationReadiness;
  identity: EducationPacketFact[];
  standing: EducationPacketFact[];
  blockers: string[];
  warnings: string[];
  actionIds: WorkspaceActionId[];
  actionTarget: {
    educationId: string;
    revisionId: string;
    expectedVersion: number;
    expectedApprovalDecisionId: string | null;
    expectedActivePublicationDecisionId: string | null;
  };
  confirmationMessage: string;
};

export type EducationWorkPacketsViewModel = {
  candidates: EducationCandidatePacketViewModel[];
  revision: EducationRevisionPacketViewModel | null;
  publication: EducationPublicationPacketViewModel | null;
};

export function buildEducationWorkPackets(
  workspace: DiagnosisEditorialWorkspace,
): EducationWorkPacketsViewModel {
  const candidates = (workspace.educationCandidates?.items ?? []).map(
    (candidate) => buildEducationCandidatePacket(workspace, candidate),
  );
  const latestRevision = workspace.revisions.latest;
  const revision = latestRevision
    ? buildEducationRevisionPacket(workspace, latestRevision, candidates)
    : null;
  const publication =
    workspace.educationGovernance?.publicationReadiness && latestRevision
      ? buildEducationPublicationPacket(
          workspace,
          latestRevision,
          workspace.educationGovernance.publicationReadiness,
        )
      : null;

  return { candidates, revision, publication };
}

function buildEducationCandidatePacket(
  workspace: DiagnosisEditorialWorkspace,
  candidate: DiagnosisEducationCandidate,
): EducationCandidatePacketViewModel {
  const sectionLabel = candidate.section ? labelize(candidate.section) : null;
  const isSection = candidate.scope === 'SECTION';
  const validationBlockers = stringList(
    candidate.validation?.blockers ?? candidate.validationBlockers,
  );
  const validationWarnings = stringList(
    candidate.validation?.warnings ?? candidate.validationWarnings,
  );
  const stale = Boolean(candidate.stale);
  const applicationAllowed = Boolean(candidate.applicationAllowed);
  const currentSnapshot = latestSnapshot(workspace);
  const currentSection =
    isSection && candidate.section
      ? valueForSection(currentSnapshot, candidate.section)
      : currentSnapshot;
  const actionIds = candidateActions(candidate);

  return {
    type: 'educationCandidate',
    id: candidate.id,
    title: isSection && sectionLabel
      ? `${sectionLabel} Education candidate`
      : 'Whole Education candidate',
    statusLabel: candidate.reviewStatus,
    tone: stale
      ? 'danger'
      : validationBlockers.length
        ? 'danger'
        : candidate.reviewStatus === 'APPLIED'
          ? 'success'
          : candidate.reviewStatus === 'REJECTED' ||
              candidate.reviewStatus === 'NEEDS_CHANGES'
            ? 'warning'
            : 'info',
    scopeLabel: candidate.scope,
    sectionLabel,
    identity: [
      fact('Diagnosis', workspace.diagnosis.displayLabel),
      fact('Candidate', candidate.id),
      fact('Education', candidate.educationId ?? 'Initial Education candidate'),
      fact('Base version', versionLabel(candidate.baseEducationVersion)),
      fact('Base revision', candidate.baseEducationRevisionId ?? 'None'),
      fact('Current version', versionLabel(candidate.currentEducationVersion)),
    ],
    purpose: {
      generationPurpose: candidate.generationPurpose,
      sourceIssue: stringifyShort(candidate.sourceArtifactIds),
      nextStep: candidateNextStep(candidate),
    },
    currentMaterial: {
      title: isSection && sectionLabel
        ? `Current ${sectionLabel}`
        : 'Current Education summary',
      content:
        candidate.originalSection ??
        currentSection ??
        (workspace.education.id ? null : 'No governed Education exists yet.'),
    },
    proposedMaterial: {
      title: isSection && sectionLabel
        ? `Proposed ${sectionLabel}`
        : 'Proposed Education',
      content: isSection ? candidate.proposedSection : candidate.proposedEducation,
      references: candidate.proposedReferences,
    },
    validation: {
      status: candidate.validation?.status ?? candidate.validationStatus,
      passed: Boolean(candidate.validation?.passed) && !validationBlockers.length,
      blockers: validationBlockers,
      warnings: validationWarnings,
      metadata: candidate.validation?.metadata ?? candidate.validationMetadata,
    },
    provenance: [
      fact('Provider', candidate.generationProvider),
      fact('Model', candidate.generationModel),
      fact('Generator', candidate.generatorVersion ?? 'Not recorded'),
      fact('Prompt', candidate.promptVersion ?? 'Not recorded'),
      fact('Generated', candidate.generatedAt),
      fact('Context hash', candidate.contextHash),
    ],
    history: [
      {
        id: `${candidate.id}:generated`,
        event: 'Candidate generated',
        actorUserId: null,
        at: candidate.generatedAt,
        target: candidate.id,
      },
      ...(candidate.reviewDecisions ?? []).map((decision) => ({
        id: decision.id,
        event: `Candidate ${decision.decision}`,
        actorUserId: decision.reviewerUserId,
        at: decision.decidedAt,
        rationale: decision.rationale,
        target: candidate.id,
      })),
      ...(candidate.applicationCommands ?? []).map((command) => ({
        id: command.id,
        event: `Application ${command.status}`,
        actorUserId: command.actorUserId,
        at: command.completedAt ?? command.createdAt,
        rationale: command.conflictReason,
        target: command.resultRevisionId ?? candidate.id,
      })),
    ],
    actionIds,
    application: {
      allowed: applicationAllowed,
      stale,
      status: candidate.applicationStatus,
      failureReason: candidate.applicationFailureReason,
      resultingEducationId: candidate.resultingEducationId,
      resultingVersion: candidate.resultingEducationVersion,
      resultingRevisionId: candidate.resultingRevisionId,
      confirmationMessage:
        'Apply this accepted Education candidate? This creates or updates Diagnosis Education, creates an exact new Education revision, marks the artifact NEEDS_REVIEW, and does not approve or publish it.',
    },
  };
}

function buildEducationRevisionPacket(
  workspace: DiagnosisEditorialWorkspace,
  revision: DiagnosisEducationRevisionAnalysis,
  candidates: EducationCandidatePacketViewModel[],
): EducationRevisionPacketViewModel {
  const sourceCandidate = candidates.find(
    (candidate) => candidate.application.resultingRevisionId === revision.id,
  );
  const governance = workspace.educationGovernance;
  const actionIds: WorkspaceActionId[] = governance?.reviewAction
    ? [
        'educationRevision.approve',
        'educationRevision.requestChanges',
        'educationRevision.reject',
      ]
    : [];

  return {
    type: 'educationRevision',
    id: revision.id,
    title: `Education revision v${revision.version}`,
    tone: actionIds.length ? 'warning' : 'info',
    question: 'Should this exact Education revision be approved?',
    identity: [
      fact('Diagnosis', workspace.diagnosis.displayLabel),
      fact('Education', revision.educationId),
      fact('Revision', revision.id),
      fact('Version', `v${revision.version}`),
      fact('Status', revision.editorialStatus),
      fact('Source', String(revision.source)),
      fact('Created', revision.createdAt),
    ],
    standing: [
      fact('Current editable', versionLabel(workspace.education.version)),
      fact('Revision under review', `v${revision.version}`),
      fact(
        'Publication readiness',
        governance?.publicationReadiness?.result ?? 'Not evaluated',
        readinessTone(governance?.publicationReadiness?.result),
      ),
      fact(
        'Standing publication',
        governance?.publicationReadiness?.activePublicationDecisionId
          ? governance.publicationReadiness.activePublicationDecisionId
          : 'No canonical standing publication projected',
      ),
    ],
    origin: sourceCandidate
      ? [
          fact('Source candidate', sourceCandidate.id),
          fact('Candidate scope', sourceCandidate.scopeLabel),
          fact('Candidate section', sourceCandidate.sectionLabel ?? 'Whole'),
          fact('Application status', sourceCandidate.application.status),
        ]
      : [fact('Source candidate', 'No candidate application linked in packet')],
    content: latestSnapshot(workspace),
    validation: {
      blockers: revision.quality.blockers,
      warnings: revision.quality.warnings,
    },
    history: sourceCandidate?.history ?? [],
    actionIds,
    actionTarget: {
      educationId: revision.educationId,
      revisionId: revision.id,
      expectedVersion: revision.version,
    },
    confirmationMessage:
      'Submit a decision for this exact Education revision? Approval records revision authority only and does not publish learner-facing Education.',
  };
}

function buildEducationPublicationPacket(
  workspace: DiagnosisEditorialWorkspace,
  revision: DiagnosisEducationRevisionAnalysis,
  readiness: EducationPublicationReadiness,
): EducationPublicationPacketViewModel {
  const actionIds: WorkspaceActionId[] =
    readiness.result === 'READY' && Boolean(readiness.approvalDecisionId)
      ? ['educationPublication.authorizeRevision']
      : [];

  return {
    type: 'educationPublication',
    id: revision.id,
    title: `Publish Education revision v${readiness.version}`,
    tone: readinessTone(readiness.result),
    question:
      'Should this exact approved Education revision become standing published Education?',
    readiness,
    identity: [
      fact('Diagnosis', workspace.diagnosis.displayLabel),
      fact('Education', readiness.educationId),
      fact('Revision', readiness.educationRevisionId),
      fact('Version', `v${readiness.version}`),
      fact('Approval decision', readiness.approvalDecisionId ?? 'Missing'),
      fact('Material hash', readiness.materialContextHash),
    ],
    standing: [
      fact('Current editable', versionLabel(readiness.currentEducationVersion)),
      fact(
        'Current standing publication',
        readiness.activePublicationDecisionId ?? 'None',
      ),
      fact(
        'Publication effect',
        readiness.activePublicationDecisionId
          ? 'Authorize this revision and supersede current standing publication'
          : 'Authorize this revision as the standing learner publication',
      ),
    ],
    blockers: readiness.blockers.map((blocker) => blocker.message),
    warnings: readiness.warnings.map((warning) => warning.message),
    actionIds,
    actionTarget: {
      educationId: readiness.educationId,
      revisionId: readiness.educationRevisionId,
      expectedVersion: readiness.version,
      expectedApprovalDecisionId: readiness.approvalDecisionId,
      expectedActivePublicationDecisionId:
        readiness.activePublicationDecisionId,
    },
    confirmationMessage:
      'Authorize learner publication for this exact approved Education revision? This is separate from approval and may supersede the current standing publication.',
  };
}

function candidateActions(
  candidate: DiagnosisEducationCandidate,
): WorkspaceActionId[] {
  if (candidate.reviewStatus === 'PENDING_REVIEW') {
    return [
      'educationCandidate.accept',
      'educationCandidate.requestChanges',
      'educationCandidate.reject',
    ];
  }
  if (candidate.reviewStatus === 'ACCEPTED' && candidate.applicationAllowed) {
    return ['educationCandidate.apply'];
  }
  return [];
}

function candidateNextStep(candidate: DiagnosisEducationCandidate): string {
  if (candidate.reviewStatus === 'PENDING_REVIEW') {
    return 'Human review must accept, request changes, or reject the candidate before application.';
  }
  if (candidate.reviewStatus === 'ACCEPTED') {
    return candidate.applicationAllowed
      ? 'Candidate review is complete and awaits separate controlled application.'
      : 'Candidate is accepted but cannot be applied against the current Education state.';
  }
  if (candidate.reviewStatus === 'APPLIED') {
    return 'Candidate has been applied; review the resulting exact Education revision.';
  }
  return 'Candidate is no longer eligible for controlled application.';
}

function latestSnapshot(workspace: DiagnosisEditorialWorkspace): JsonValue | null {
  const revision = workspace.revisions.latest as
    | (DiagnosisEducationRevisionAnalysis & { snapshot?: JsonValue })
    | null;
  return revision?.snapshot ?? null;
}

function valueForSection(
  snapshot: JsonValue | null,
  section: string,
): JsonValue | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }
  return (snapshot as Record<string, JsonValue>)[section] ?? null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === 'string'
        ? item
        : item && typeof item === 'object'
          ? JSON.stringify(item)
          : String(item),
    )
    .filter(Boolean);
}

function stringifyShort(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    const text = JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  } catch {
    return String(value);
  }
}

function versionLabel(version: number | null | undefined): string {
  return version === null || version === undefined ? 'None' : `v${version}`;
}

function fact(
  label: string,
  value: string | number | null | undefined,
  tone?: EducationWorkPacketTone,
): EducationPacketFact {
  return {
    label,
    value: value === null || value === undefined || value === '' ? 'Unknown' : String(value),
    tone,
  };
}

function readinessTone(
  readiness: EducationPublicationReadiness['result'] | null | undefined,
): EducationWorkPacketTone {
  if (readiness === 'READY') return 'success';
  if (readiness === 'BLOCKED' || readiness === 'STALE') return 'danger';
  return 'neutral';
}

function labelize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
