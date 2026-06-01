import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { EDITORIAL_PERMISSION_KEY } from '../../auth/editorial-permission.decorator';
import { USER_ROLES } from '../../auth/roles';
import { AdminGuard } from './admin.guard';

function contextForRole(role: string | null): ExecutionContext {
  return {
    getHandler: () => contextForRole,
    getClass: () => AdminGuard,
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { role } : null,
      }),
    }),
  } as unknown as ExecutionContext;
}

function guardForEditorialPermission(permission: 'editor' | 'senior' | undefined) {
  return new AdminGuard({
    getAllAndOverride: jest.fn((key: string) =>
      key === EDITORIAL_PERMISSION_KEY ? permission : undefined,
    ),
  } as never);
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows admin users', () => {
    expect(guard.canActivate(contextForRole(USER_ROLES.ADMIN))).toBe(true);
  });

  it.each([USER_ROLES.SENIOR_EDITOR, USER_ROLES.EDITOR, USER_ROLES.USER, null])(
    'continues to reject %s',
    (role) => {
      expect(() => guard.canActivate(contextForRole(role))).toThrow(
        ForbiddenException,
      );
    },
  );

  it.each([USER_ROLES.EDITOR, USER_ROLES.SENIOR_EDITOR, USER_ROLES.ADMIN])(
    'allows %s through editor-marked routes',
    (role) => {
      expect(
        guardForEditorialPermission('editor').canActivate(contextForRole(role)),
      ).toBe(true);
    },
  );

  it('rejects ordinary users from editor-marked routes', () => {
    expect(() =>
      guardForEditorialPermission('editor').canActivate(
        contextForRole(USER_ROLES.USER),
      ),
    ).toThrow(ForbiddenException);
  });

  it.each([USER_ROLES.SENIOR_EDITOR, USER_ROLES.ADMIN])(
    'allows %s through senior-editor-marked routes',
    (role) => {
      expect(
        guardForEditorialPermission('senior').canActivate(contextForRole(role)),
      ).toBe(true);
    },
  );

  it('rejects editors from senior-editor-marked routes', () => {
    expect(() =>
      guardForEditorialPermission('senior').canActivate(
        contextForRole(USER_ROLES.EDITOR),
      ),
    ).toThrow(ForbiddenException);
  });
});
