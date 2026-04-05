import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { UserProgressService } from './user-progress.service';

@Controller('user')
@UseGuards(RateLimitGuard)
export class UserProgressController {
  constructor(private readonly userProgressService: UserProgressService) {}

  @Get('progress')
  getUserProgress(@Req() req: AuthenticatedRequest) {
    return this.userProgressService.getProgress(req.user.id);
  }
}
