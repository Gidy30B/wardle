export const USER_ROLES = {
  USER: 'user',
  EDITOR: 'editor',
  SENIOR_EDITOR: 'senior_editor',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function isAdmin(role: string | null | undefined): boolean {
  return role === USER_ROLES.ADMIN;
}

export function isEditorLike(role: string | null | undefined): boolean {
  return (
    role === USER_ROLES.EDITOR ||
    role === USER_ROLES.SENIOR_EDITOR ||
    isAdmin(role)
  );
}

export function isSeniorEditorLike(role: string | null | undefined): boolean {
  return role === USER_ROLES.SENIOR_EDITOR || isAdmin(role);
}

export function canAccessEditorial(role: string | null | undefined): boolean {
  return isEditorLike(role);
}

export function canPublishEditorial(role: string | null | undefined): boolean {
  return isSeniorEditorLike(role);
}

export function canAccessAdminOps(role: string | null | undefined): boolean {
  return isAdmin(role);
}
