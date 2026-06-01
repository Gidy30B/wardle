import {
  canAccessAdminOps,
  canAccessEditorial,
  canPublishEditorial,
  isAdmin,
  isEditorLike,
  isSeniorEditorLike,
  USER_ROLES,
} from './roles';

describe('role helpers', () => {
  it('allows admin through all privileged helpers', () => {
    expect(isAdmin(USER_ROLES.ADMIN)).toBe(true);
    expect(isEditorLike(USER_ROLES.ADMIN)).toBe(true);
    expect(isSeniorEditorLike(USER_ROLES.ADMIN)).toBe(true);
    expect(canAccessEditorial(USER_ROLES.ADMIN)).toBe(true);
    expect(canPublishEditorial(USER_ROLES.ADMIN)).toBe(true);
    expect(canAccessAdminOps(USER_ROLES.ADMIN)).toBe(true);
  });

  it('allows senior editors through editorial and publish helpers only', () => {
    expect(isAdmin(USER_ROLES.SENIOR_EDITOR)).toBe(false);
    expect(isEditorLike(USER_ROLES.SENIOR_EDITOR)).toBe(true);
    expect(isSeniorEditorLike(USER_ROLES.SENIOR_EDITOR)).toBe(true);
    expect(canAccessEditorial(USER_ROLES.SENIOR_EDITOR)).toBe(true);
    expect(canPublishEditorial(USER_ROLES.SENIOR_EDITOR)).toBe(true);
    expect(canAccessAdminOps(USER_ROLES.SENIOR_EDITOR)).toBe(false);
  });

  it('allows editors through editorial helpers only', () => {
    expect(isAdmin(USER_ROLES.EDITOR)).toBe(false);
    expect(isEditorLike(USER_ROLES.EDITOR)).toBe(true);
    expect(isSeniorEditorLike(USER_ROLES.EDITOR)).toBe(false);
    expect(canAccessEditorial(USER_ROLES.EDITOR)).toBe(true);
    expect(canPublishEditorial(USER_ROLES.EDITOR)).toBe(false);
    expect(canAccessAdminOps(USER_ROLES.EDITOR)).toBe(false);
  });

  it('rejects users from privileged helpers', () => {
    expect(isAdmin(USER_ROLES.USER)).toBe(false);
    expect(isEditorLike(USER_ROLES.USER)).toBe(false);
    expect(isSeniorEditorLike(USER_ROLES.USER)).toBe(false);
    expect(canAccessEditorial(USER_ROLES.USER)).toBe(false);
    expect(canPublishEditorial(USER_ROLES.USER)).toBe(false);
    expect(canAccessAdminOps(USER_ROLES.USER)).toBe(false);
  });
});
