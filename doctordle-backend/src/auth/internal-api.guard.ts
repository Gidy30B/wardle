import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { getEnv } from '../core/config/env.validation';

@Injectable()
export class InternalApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configuredKey = getEnv().INTERNAL_API_KEY;

    if (!configuredKey) {
      throw new UnauthorizedException('INTERNAL_API_KEY is not configured');
    }

    const key = request.headers['x-internal-key'];
    const providedKey = Array.isArray(key) ? key[0] : key;

    if (!providedKey || providedKey !== configuredKey) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
