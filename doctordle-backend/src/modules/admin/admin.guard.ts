import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import {
  EDITORIAL_PERMISSION_KEY,
  type EditorialPermissionLevel,
} from '../../auth/editorial-permission.decorator';
import { canAccessEditorial, canPublishEditorial } from '../../auth/roles';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector?: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Admin access only');
    }

    if (user.role === 'admin') {
      return true;
    }

    const editorialPermission =
      this.reflector?.getAllAndOverride<EditorialPermissionLevel>(
        EDITORIAL_PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (
      editorialPermission === 'editor' &&
      canAccessEditorial(user.role)
    ) {
      return true;
    }

    if (
      editorialPermission === 'senior' &&
      canPublishEditorial(user.role)
    ) {
      return true;
    }

    if (editorialPermission) {
      throw new ForbiddenException(
        editorialPermission === 'senior'
          ? 'Senior editorial permission required'
          : 'Editorial permission required',
      );
    }

    throw new ForbiddenException('Admin access only');
  }
}
