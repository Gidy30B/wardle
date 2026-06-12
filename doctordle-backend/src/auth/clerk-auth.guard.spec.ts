import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { resetEnvCacheForTests } from '../core/config/env.validation';

const baseEnv = {
  DATABASE_URL: 'postgres://localhost:5432/doctordle',
  REDIS_URL: 'redis://localhost:6379',
  CLERK_JWT_ISSUER: 'https://example.clerk.accounts.dev',
  CLERK_JWT_AUDIENCE: 'wardle',
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  SCORE_WEIGHT_EXACT: '1',
  SCORE_WEIGHT_SYNONYM: '0.9',
  SCORE_WEIGHT_FUZZY: '0.6',
  SCORE_WEIGHT_EMBEDDING: '0.8',
  SCORE_WEIGHT_ONTOLOGY: '0.5',
  EVALUATOR_VERSION: 'test',
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries({ ...baseEnv, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetEnvCacheForTests();
}

function contextForHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ClerkAuthGuard local QA auth', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  afterEach(() => {
    resetEnvCacheForTests();
    jest.clearAllMocks();
  });

  it('falls back to Clerk auth when local QA auth is disabled', async () => {
    setEnv();
    const clerkJwtService = {
      verifyBearerToken: jest.fn().mockResolvedValue({
        clerkId: 'clerk-user',
        email: 'editor@example.test',
      }),
    };
    const userSyncService = {
      syncUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        clerkId: 'clerk-user',
        email: 'editor@example.test',
        username: 'editor',
        role: 'editor',
      }),
      ensureLocalQaUser: jest.fn(),
    };
    const guard = new ClerkAuthGuard(
      reflector,
      clerkJwtService as never,
      userSyncService as never,
    );
    const context = contextForHeaders({ authorization: 'Bearer jwt' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(clerkJwtService.verifyBearerToken).toHaveBeenCalledWith('jwt');
    expect(userSyncService.ensureLocalQaUser).not.toHaveBeenCalled();
  });

  it('accepts the configured local QA header in non-production', async () => {
    setEnv({
      LOCAL_QA_AUTH_ENABLED: 'true',
      LOCAL_QA_AUTH_TOKEN: 'local-qa-token-123',
      LOCAL_QA_AUTH_USER_ID: 'local-qa-user',
      LOCAL_QA_AUTH_EMAIL: 'local-qa@example.test',
      LOCAL_QA_AUTH_ROLE: 'admin',
    });
    const clerkJwtService = { verifyBearerToken: jest.fn() };
    const userSyncService = {
      ensureLocalQaUser: jest.fn().mockResolvedValue({
        id: 'local-qa-user',
        clerkId: 'local_qa_local-qa-user',
        email: 'local-qa@example.test',
        username: 'local-qa',
        role: 'admin',
      }),
    };
    const guard = new ClerkAuthGuard(
      reflector,
      clerkJwtService as never,
      userSyncService as never,
    );
    const context = contextForHeaders({
      'x-wardle-local-qa-token': 'local-qa-token-123',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(clerkJwtService.verifyBearerToken).not.toHaveBeenCalled();
    expect(userSyncService.ensureLocalQaUser).toHaveBeenCalledWith({
      id: 'local-qa-user',
      email: 'local-qa@example.test',
      role: 'admin',
    });
  });

  it('rejects an invalid local QA token', async () => {
    setEnv({
      LOCAL_QA_AUTH_ENABLED: 'true',
      LOCAL_QA_AUTH_TOKEN: 'local-qa-token-123',
    });
    const guard = new ClerkAuthGuard(
      reflector,
      { verifyBearerToken: jest.fn() } as never,
      { ensureLocalQaUser: jest.fn() } as never,
    );

    await expect(
      guard.canActivate(
        contextForHeaders({ 'x-wardle-local-qa-token': 'wrong-token' }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuses local QA auth in production env validation', async () => {
    setEnv({
      NODE_ENV: 'production',
      DEV_BYPASS_DAILY_LIMIT: 'false',
      ENABLE_DEV_REPLAY: 'false',
      LOCAL_QA_AUTH_ENABLED: 'true',
      LOCAL_QA_AUTH_TOKEN: 'local-qa-token-123',
    });
    const guard = new ClerkAuthGuard(
      reflector,
      { verifyBearerToken: jest.fn() } as never,
      { ensureLocalQaUser: jest.fn() } as never,
    );

    await expect(
      guard.canActivate(
        contextForHeaders({
          'x-wardle-local-qa-token': 'local-qa-token-123',
        }),
      ),
    ).rejects.toThrow('LOCAL_QA_AUTH_ENABLED must not be enabled in production');
  });
});
