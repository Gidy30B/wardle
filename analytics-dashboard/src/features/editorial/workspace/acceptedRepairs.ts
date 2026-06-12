import type { DiagnosisEditorialWorkspace } from '../../../api/admin';

export type AcceptedEducationRepair = NonNullable<
  DiagnosisEditorialWorkspace['education']['acceptedRepairs']
>[number];

export function repairsBySection(repairs: AcceptedEducationRepair[] = []) {
  return repairs.reduce<Record<string, AcceptedEducationRepair[]>>((groups, repair) => {
    groups[repair.section] = [...(groups[repair.section] ?? []), repair];
    return groups;
  }, {});
}

export function visibleAcceptedRepairs(
  workspace: DiagnosisEditorialWorkspace,
  section?: string,
) {
  const repairs = workspace.education.acceptedRepairs ?? [];
  return section ? repairs.filter((repair) => repair.section === section) : repairs;
}
