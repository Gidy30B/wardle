import {
  Body,
  Controller,
  Get,
  Header,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { GameSessionService } from './game-session.service';
import { StartGameDto } from './dto/start-game.dto';
import {
  SubmitGameGuessDto,
  type SubmitGameGuessResponseDto,
} from './dto/submit-game-guess.dto';
import { RequestHintDto } from './dto/request-hint.dto';
import { LeaderboardService } from './leaderboard.service';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import type { Response } from 'express';
import type { LeaderboardCacheDiagnostic } from './leaderboard.service';

@Controller('game')
@UseGuards(RateLimitGuard)
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Post('start')
  async startGame(
    @Req() req: AuthenticatedRequest,
    @Body() body?: StartGameDto,
  ) {
    try {
      this.logger.log(
        JSON.stringify({
          event: 'game.start.requested',
          userId: req.user.id,
          devReplay: body?.devReplay ?? false,
          dailyCaseId: body?.dailyCaseId ?? null,
          track: body?.track ?? null,
          sequenceIndex: body?.sequenceIndex ?? null,
        }),
      )

      return await this.gameSessionService.startGame({
        userId: req.user.id,
        dailyCaseId: body?.dailyCaseId,
        devReplay: body?.devReplay,
        track: body?.track,
        sequenceIndex: body?.sequenceIndex,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'game.start.failed',
          userId: req.user.id,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Get('today')
  async getTodayCases(
    @Req() req: AuthenticatedRequest,
    @Query('date') date?: string,
  ) {
    try {
      return await this.gameSessionService.getTodayCasesForUser({
        userId: req.user.id,
        date,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'game.today.failed',
          userId: req.user.id,
          date: date ?? null,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Post('guess')
  async submitGuess(
    @Req() req: AuthenticatedRequest,
    @Body() body: SubmitGameGuessDto,
  ): Promise<SubmitGameGuessResponseDto> {
    try {
      return await this.gameSessionService.submitGuess({
        sessionId: body.sessionId,
        guess: body.guess,
        diagnosisRegistryId: body.diagnosisRegistryId,
        userId: req.user.id,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'game.guess.failed',
          userId: req.user.id,
          sessionId: body.sessionId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Get('diagnoses/autocomplete')
  async autocompleteDiagnoses(
    @Query('query') query?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit ?? 5);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(8, Math.floor(parsedLimit)))
      : 5;

    return this.gameSessionService.autocompleteDiagnoses({
      query: query ?? '',
      limit: safeLimit,
    });
  }

  @Post('hint')
  async requestHint(@Req() req: AuthenticatedRequest, @Body() body: RequestHintDto) {
    try {
      return await this.gameSessionService.requestHint({
        sessionId: body.sessionId,
        userId: req.user.id,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'game.hint.failed',
          userId: req.user.id,
          sessionId: body.sessionId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Get('leaderboard/today')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getTodayLeaderboard(
    @Query('limit') limit?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const parsedLimit = Number(limit ?? 50);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
      : 50;

    try {
      this.setLeaderboardCacheHeaders(
        res,
        await this.leaderboardService.getCacheDiagnostic({
          mode: 'daily',
          limit: safeLimit,
        }),
      );
      return await this.leaderboardService.getToday(safeLimit);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'leaderboard.today.failed',
          limit: safeLimit,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to load daily leaderboard');
    }
  }

  @Get('leaderboard/weekly')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getWeeklyLeaderboard(
    @Query('limit') limit?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const parsedLimit = Number(limit ?? 50);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
      : 50;

    try {
      this.setLeaderboardCacheHeaders(
        res,
        await this.leaderboardService.getCacheDiagnostic({
          mode: 'weekly',
          limit: safeLimit,
        }),
      );
      return await this.leaderboardService.getWeekly(safeLimit);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'leaderboard.weekly.failed',
          limit: safeLimit,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to load weekly leaderboard');
    }
  }

  @Get('leaderboard/me')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getMyLeaderboardPosition(
    @Req() req: AuthenticatedRequest,
    @Query('mode') mode?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const normalizedMode = mode === 'weekly' ? 'weekly' : 'daily';

    try {
      this.setLeaderboardCacheHeaders(res, null);
      const result = await this.leaderboardService.getUserPosition({
        userId: req.user.id,
        mode: normalizedMode,
      });
      return result;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'leaderboard.me.failed',
          userId: req.user.id,
          mode: normalizedMode,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to load user leaderboard position');
    }
  }

  @Get(':sessionId')
  async getSessionState(@Param('sessionId') sessionId: string) {
    try {
      return await this.gameSessionService.getSessionState(sessionId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'game.session-state.failed',
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private setLeaderboardCacheHeaders(
    res: Response | undefined,
    diagnostic: LeaderboardCacheDiagnostic | null,
  ) {
    if (!res) {
      return;
    }

    res.setHeader(
      'X-Leaderboard-Cache',
      diagnostic ? (diagnostic.hit ? 'hit' : 'miss') : 'bypass',
    );
    res.setHeader('X-Cache-Hit', diagnostic?.hit ? 'true' : 'false');

    if (diagnostic?.key) {
      res.setHeader('X-Cache-Key', diagnostic.key);
    }
  }
}
