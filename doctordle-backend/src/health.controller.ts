import { Controller, Get } from '@nestjs/common';
import { getEnv } from './core/config/env.validation';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('health/env')
  healthEnv() {
    const env = getEnv();
    const frontendAudience = process.env.VITE_CLERK_JWT_AUDIENCE;
    const clerkAligned = frontendAudience
      ? env.CLERK_JWT_AUDIENCE === frontendAudience
      : true;

    return {
      envValid: true,
      clerkAligned,
    };
  }
}
