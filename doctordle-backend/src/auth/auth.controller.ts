import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { UserProgressService } from '../modules/gameplay/user-progress.service';
import type { AuthenticatedRequest } from './authenticated-request.interface';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly userProgressService: UserProgressService,
  ) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    const progress = await this.userProgressService.getProgress(req.user.id);

    return {
      clerkId: req.user.clerkId,
      email: req.user.email,
      userId: req.user.id,
      progress,
    };
  }
}
