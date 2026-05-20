import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { StatsEngineService } from './stats-engine.service';

@Controller('users')
export class StatsController {
  constructor(private readonly statsEngineService: StatsEngineService) {}

  @Get('me/stats')
  getMyStats(@Req() req: AuthenticatedRequest) {
    return this.statsEngineService.getUserStats(req.user.id);
  }
}
