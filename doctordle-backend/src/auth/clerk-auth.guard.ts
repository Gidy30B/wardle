import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClerkJwtService } from './clerk-jwt.service';
import { UserSyncService } from '../modules/users/user-sync.service';
import { AuthenticatedRequest } from './authenticated-request.interface';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly clerkJwtService: ClerkJwtService,
    private readonly userSyncService: UserSyncService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing Clerk bearer token');
    }

    const principal = await this.clerkJwtService.verifyBearerToken(token);
    const user = await this.userSyncService.getOrCreateUser({
      clerkId: principal.clerkId,
      email: principal.email,
    });

    request.user = {
      id: user.id,
      clerkId: principal.clerkId,
      email: principal.email ?? undefined,
    };

    return true;
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
