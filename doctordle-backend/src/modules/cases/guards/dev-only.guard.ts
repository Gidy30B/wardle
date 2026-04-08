import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { getEnv } from '../../../core/config/env.validation';

@Injectable()
export class DevOnlyGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (getEnv().NODE_ENV === 'production') {
      throw new ForbiddenException('This endpoint is disabled in production');
    }

    return true;
  }
}
