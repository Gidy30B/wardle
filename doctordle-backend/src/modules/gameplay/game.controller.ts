import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { GameSessionService } from './game-session.service';
import { SubmitGameGuessDto } from './dto/submit-game-guess.dto';
import { LeaderboardService } from './leaderboard.service';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';

@Controller('api/game')
@UseGuards(RateLimitGuard)
export class GameController {
  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Post('start')
  startGame(@Req() req: AuthenticatedRequest) {
    return this.gameSessionService.startGame({ userId: req.user.id });
  }

  @Post('guess')
  submitGuess(@Req() req: AuthenticatedRequest, @Body() body: SubmitGameGuessDto) {
    return this.gameSessionService.submitGuess({
      sessionId: body.sessionId,
      guess: body.guess,
      userId: req.user.id,
    });
  }

  @Get('leaderboard/today')
  getTodayLeaderboard(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit ?? 50);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
      : 50;

    return this.leaderboardService.getToday(safeLimit);
  }

  @Get('leaderboard/weekly')
  getWeeklyLeaderboard(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit ?? 50);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
      : 50;

    return this.leaderboardService.getWeekly(safeLimit);
  }

  @Get('leaderboard/me')
  getMyLeaderboardPosition(
    @Req() req: AuthenticatedRequest,
    @Query('mode') mode?: string,
  ) {
    const normalizedMode = mode === 'weekly' ? 'weekly' : 'daily';
    return this.leaderboardService.getUserPosition({
      userId: req.user.id,
      mode: normalizedMode,
    });
  }

  @Get(':sessionId')
  getSessionState(@Param('sessionId') sessionId: string) {
    return this.gameSessionService.getSessionState(sessionId);
  }
}
