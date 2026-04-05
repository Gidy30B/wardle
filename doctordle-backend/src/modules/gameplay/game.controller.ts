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

@Controller('game')
@UseGuards(RateLimitGuard)
export class GameController {
  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Post('start')
  async startGame(@Req() req: AuthenticatedRequest) {
    try {
      return await this.gameSessionService.startGame({ userId: req.user.id });
    } catch (error) {
      console.error('game.start error:', error);
      throw error;
    }
  }

  @Post('guess')
  async submitGuess(@Req() req: AuthenticatedRequest, @Body() body: SubmitGameGuessDto) {
    try {
      return await this.gameSessionService.submitGuess({
        sessionId: body.sessionId,
        guess: body.guess,
        userId: req.user.id,
      });
    } catch (error) {
      console.error('game.guess error:', error);
      throw error;
    }
  }

  @Get('leaderboard/today')
  async getTodayLeaderboard(@Query('limit') limit?: string) {
    try {
      const parsedLimit = Number(limit ?? 50);
      const safeLimit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
        : 50;

      return await this.leaderboardService.getToday(safeLimit);
    } catch (error) {
      console.error('leaderboard.today error:', error);
      return [];
    }
  }

  @Get('leaderboard/weekly')
  async getWeeklyLeaderboard(@Query('limit') limit?: string) {
    try {
      const parsedLimit = Number(limit ?? 50);
      const safeLimit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
        : 50;

      return await this.leaderboardService.getWeekly(safeLimit);
    } catch (error) {
      console.error('leaderboard.weekly error:', error);
      return [];
    }
  }

  @Get('leaderboard/me')
  async getMyLeaderboardPosition(
    @Req() req: AuthenticatedRequest,
    @Query('mode') mode?: string,
  ) {
    try {
      const normalizedMode = mode === 'weekly' ? 'weekly' : 'daily';
      const result = await this.leaderboardService.getUserPosition({
        userId: req.user.id,
        mode: normalizedMode,
      });
      return result || {
        userId: req.user.id,
        rank: 0,
        score: 0,
        mode: normalizedMode,
      };
    } catch (error) {
      console.error('leaderboard.me error:', error);
      return {
        userId: req.user.id,
        rank: 0,
        score: 0,
        mode: mode === 'weekly' ? 'weekly' : 'daily',
      };
    }
  }

  @Get(':sessionId')
  async getSessionState(@Param('sessionId') sessionId: string) {
    try {
      return await this.gameSessionService.getSessionState(sessionId);
    } catch (error) {
      console.error('game.sessionState error:', error);
      throw error;
    }
  }
}
