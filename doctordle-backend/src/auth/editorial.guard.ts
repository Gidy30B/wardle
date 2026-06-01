import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request.interface';
import { canAccessEditorial, canPublishEditorial } from './roles';

@Injectable()
export class EditorialGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!canAccessEditorial(request.user?.role)) {
      throw new ForbiddenException('Editorial access only');
    }

    return true;
  }
}

@Injectable()
export class SeniorEditorialGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!canPublishEditorial(request.user?.role)) {
      throw new ForbiddenException('Senior editorial access only');
    }

    return true;
  }
}
