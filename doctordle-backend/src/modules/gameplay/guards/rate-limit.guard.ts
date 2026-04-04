import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisCacheService } from '../../../core/cache/redis-cache.service';

type RequestWithUser = Request & {
  user?: {
    id?: string;
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windowSeconds = 60;
  private readonly maxRequests = 60;

  constructor(private readonly cacheService: RedisCacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const ip = request.ip ?? 'unknown';
    const userId = request.user?.id ?? 'anonymous';
    const routePath =
      typeof request.route?.path === 'string' ? request.route.path : request.path;
    const method = request.method ?? 'UNKNOWN';
    const key = `rate:${userId}:${ip}:${method}:${routePath}`;
    const requests = await this.cacheService.increment(key, this.windowSeconds);

    if (requests > this.maxRequests) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
