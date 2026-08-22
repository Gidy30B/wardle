import type { WorkspaceClinicalCaseDraft } from '../../../../api/admin.types.ts';
import type { WorkspaceActionId } from '../actions/workspaceActionTypes.ts';

export type ClinicalCaseDraftReviewPacketViewModel = {
  id: string;
  title: string;
  diagnosisName: string;
  status: string;
  statusLabel: string;
  intent: {
    purpose: string;
    source: string;
    requiredDecision: string;
  };
  generatedCase: {
    title: string;
    finalDiagnosis: string;
    difficulty?: string | null;
    clueCount: number;
    clues: string[];
    differentials: string[];
    explanation: string;
    summary: string | null;
  };
  validation: {
    status: string;
    summary: string;
    blockers: string[];
    warnings: string[];
    passed: boolean;
    disclaimer: string;
  };
  provenance: {
    generationMethod: string;
    generationContextHash: string | null;
    generatedAt: string | null;
    generatorVersion: string | null;
    isSecondaryEvidence: boolean;
  };
  history: WorkspaceClinicalCaseDraft['governanceHistory'];
  actionIds: WorkspaceActionId[];
  applicationHandoff: {
    resultingCaseId: string | null;
    resultingCaseRevisionId: string | null;
  };
  raw: WorkspaceClinicalCaseDraft;
};

export function buildClinicalCaseDraftReviewPacket(
  draft: WorkspaceClinicalCaseDraft,
): ClinicalCaseDraftReviewPacketViewModel {
  return {
    id: draft.id,
    title:
      draft.generatedCase.title ??
      draft.generatedCase.finalDiagnosis ??
      'Generated Clinical Case Draft',
    diagnosisName: draft.diagnosisDisplayName,
    status: draft.reviewStatus,
    statusLabel: formatStatus(draft.reviewStatus),
    intent: {
      purpose: draft.generationPurposeLabel,
      source: draft.sourceIssueSummary ?? draft.selectionSource ?? 'Registry-targeted generation',
      requiredDecision: draft.currentRequiredDecision,
    },
    generatedCase: {
      title: draft.generatedCase.title,
      finalDiagnosis: draft.generatedCase.finalDiagnosis,
      difficulty: draft.generatedCase.difficulty,
      clueCount: draft.generatedCase.clueCount,
      clues: draft.generatedCase.clues.map(formatClue),
      differentials: draft.generatedCase.differentials,
      explanation: stringifyValue(draft.generatedCase.explanation),
      summary: draft.generatedCase.summary ?? null,
    },
    validation: {
      status: draft.validation.status,
      summary: stringifyValue(
        draft.validation.summary ?? 'No validation summary returned.',
      ),
      blockers: draft.validation.blockers.map(stringifyValue),
      warnings: draft.validation.warnings.map(stringifyValue),
      passed: draft.validation.passed,
      disclaimer:
        'Validation summarizes generated content only; it is not APP-006 approval, publication readiness, scheduling, or learner exposure.',
    },
    provenance: {
      generationMethod: draft.generationMethod,
      generationContextHash: draft.provenance.generationContextHash ?? null,
      generatedAt: draft.provenance.generatedAt ?? null,
      generatorVersion: draft.provenance.generatorVersion ?? null,
      isSecondaryEvidence: true,
    },
    history: draft.governanceHistory,
    actionIds: actionIdsForDraft(draft),
    applicationHandoff: {
      resultingCaseId: draft.resultingCaseId ?? null,
      resultingCaseRevisionId: draft.resultingCaseRevisionId ?? null,
    },
    raw: draft,
  };
}

export function actionIdsForDraft(
  draft: Pick<WorkspaceClinicalCaseDraft, 'reviewStatus' | 'applicationAllowed'>,
): WorkspaceActionId[] {
  if (draft.reviewStatus === 'PENDING_REVIEW') {
    return [
      'caseDraft.accept',
      'caseDraft.requestChanges',
      'caseDraft.reject',
    ];
  }
  if (draft.reviewStatus === 'ACCEPTED' && draft.applicationAllowed) {
    return ['caseDraft.apply'];
  }
  return [];
}

function formatStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatClue(clue: Record<string, unknown>) {
  return stringifyValue(
    clue.text ??
      clue.clue ??
      clue.description ??
      clue.content ??
      clue.value ??
      clue,
  );
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return 'None recorded.';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'Structured value unavailable.';
  }
}
