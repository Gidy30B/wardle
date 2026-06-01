import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { EditorialGuard, SeniorEditorialGuard } from './editorial.guard';
import { USER_ROLES } from './roles';

function contextForRole(role: string | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { role } : null,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('EditorialGuard', () => {
  const guard = new EditorialGuard();

  it.each([
    USER_ROLES.EDITOR,
    USER_ROLES.SENIOR_EDITOR,
    USER_ROLES.ADMIN,
  ])('allows %s', (role) => {
    expect(guard.canActivate(contextForRole(role))).toBe(true);
  });

  it.each([USER_ROLES.USER, null])('rejects %s', (role) => {
    expect(() => guard.canActivate(contextForRole(role))).toThrow(
      ForbiddenException,
    );
  });
});

describe('SeniorEditorialGuard', () => {
  const guard = new SeniorEditorialGuard();

  it.each([USER_ROLES.SENIOR_EDITOR, USER_ROLES.ADMIN])('allows %s', (role) => {
    expect(guard.canActivate(contextForRole(role))).toBe(true);
  });

  it.each([USER_ROLES.EDITOR, USER_ROLES.USER, null])('rejects %s', (role) => {
    expect(() => guard.canActivate(contextForRole(role))).toThrow(
      ForbiddenException,
    );
  });
});
