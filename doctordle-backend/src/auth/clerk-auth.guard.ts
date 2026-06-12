import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkJwtService } from './clerk-jwt.service';
import { UserSyncService } from '../modules/users/user-sync.service';
import { AuthenticatedRequest } from './authenticated-request.interface';
import { IS_PUBLIC_KEY } from './public.decorator';
import { getEnv } from '../core/config/env.validation';

const LOCAL_QA_AUTH_HEADER = 'x-wardle-local-qa-token';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clerkJwtService: ClerkJwtService,
    private readonly userSyncService: UserSyncService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (await this.tryLocalQaAuth(request)) {
      return true;
    }

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing Clerk bearer token');
    }

    const principal = await this.clerkJwtService.verifyBearerToken(token);
    const user = await this.userSyncService.syncUser(principal);

    request.user = {
      id: user.id,
      clerkId: principal.clerkId,
      email: principal.email ?? undefined,
      username: user.username ?? undefined,
      role: user.role,
    };

    return true;
  }

  private async tryLocalQaAuth(request: AuthenticatedRequest): Promise<boolean> {
    const env = getEnv();
    if (!env.LOCAL_QA_AUTH_ENABLED) {
      return false;
    }

    if (env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Local QA auth is not available in production');
    }

    const provided = this.readHeader(request, LOCAL_QA_AUTH_HEADER);
    if (!provided) {
      return false;
    }

    if (!env.LOCAL_QA_AUTH_TOKEN || provided !== env.LOCAL_QA_AUTH_TOKEN) {
      throw new UnauthorizedException('Invalid local QA auth token');
    }

    const user = await this.userSyncService.ensureLocalQaUser({
      id: env.LOCAL_QA_AUTH_USER_ID,
      email: env.LOCAL_QA_AUTH_EMAIL,
      role: env.LOCAL_QA_AUTH_ROLE,
    });

    request.user = {
      id: user.id,
      clerkId: user.clerkId ?? `local_qa_${user.id}`,
      email: user.email ?? undefined,
      username: user.username ?? undefined,
      role: user.role,
    };

    return true;
  }

  private readHeader(
    request: AuthenticatedRequest,
    name: string,
  ): string | null {
    const value = request.headers[name];
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value ?? null;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }
}
