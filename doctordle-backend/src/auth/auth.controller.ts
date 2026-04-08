import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { UserProgressService } from '../modules/gameplay/user-progress.service';
import { UserSyncService } from '../modules/users/user-sync.service';
import type { AuthenticatedRequest } from './authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userProgressService: UserProgressService,
    private readonly userSyncService: UserSyncService,
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

  @Post('sync')
  @UseGuards(ClerkAuthGuard)
  async sync(@Req() req: AuthenticatedRequest) {
    const user = await this.userSyncService.syncUser({
      clerkId: req.user.clerkId,
      email: req.user.email,
    });

    const progress = await this.userProgressService.syncProgress(user.id);

    return {
      clerkId: user.clerkId,
      email: user.email ?? undefined,
      userId: user.id,
      progress,
    };
  }
}
