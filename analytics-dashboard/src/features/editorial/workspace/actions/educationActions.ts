import {
  regenerateDiagnosisEducationSection,
  repairUnsupportedClaimDraft,
  reviewDiagnosisEducationForAdmin,
} from '../../../../api/admin.ts';
import type {
  DiagnosisEducationStatus,
  RegenerateEducationSectionPayload,
} from '../../../../api/admin.types.ts';
import type {
  ClaimRepairActionPayload,
  EducationActionPayload,
  WorkspaceActionExecutor,
} from './workspaceActionTypes.ts';

export const runEducationAction: WorkspaceActionExecutor = (
  actionId,
  payload,
  context,
) => {
  switch (actionId) {
    case 'education.repairUnsupportedClaim': {
      const actionPayload = payload as ClaimRepairActionPayload;
      return repairUnsupportedClaimDraft(context.client, context.diagnosisRegistryId, {
        claimId: requireClaimId(actionPayload),
      });
    }
    case 'education.regenerateSection': {
      const actionPayload = payload as EducationActionPayload;
      return regenerateDiagnosisEducationSection(
        context.client,
        context.diagnosisRegistryId,
        requireRegeneratePayload(actionPayload),
      );
    }
    case 'education.review': {
      const actionPayload = payload as EducationActionPayload;
      return reviewDiagnosisEducationForAdmin(
        context.client,
        requireEducationId(actionPayload),
        {
          status: requireEducationStatus(actionPayload),
        },
      );
    }
    default:
      throw new Error(`Unsupported education action: ${actionId}`);
  }
};

function requireClaimId(payload: ClaimRepairActionPayload): string {
  if (!payload.claimId) {
    throw new Error('Claim repair action requires claimId.');
  }
  return payload.claimId;
}

function requireEducationId(payload: EducationActionPayload): string {
  if (!payload.educationId) {
    throw new Error('Education review action requires educationId.');
  }
  return payload.educationId;
}

function requireEducationStatus(
  payload: EducationActionPayload,
): DiagnosisEducationStatus {
  if (!payload.status) {
    throw new Error('Education review action requires status.');
  }
  return payload.status as DiagnosisEducationStatus;
}

function requireRegeneratePayload(
  payload: EducationActionPayload,
): RegenerateEducationSectionPayload {
  if (!payload.section) {
    throw new Error('Education regeneration action requires section.');
  }
  return { section: payload.section };
}
