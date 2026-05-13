import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Public } from '../../auth/public.decorator';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { PrismaService } from '../../core/db/prisma.service';
import { DevOnlyGuard } from '../cases/guards/dev-only.guard';
import { DailyCaseSchedulerService } from './daily-case-scheduler.service';

class EnsureDailyCaseWindowDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;
}

class CleanupDailyCaseAssignmentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  caseIds!: string[];
}

@Controller('internal/daily-cases')
@Public()
@UseGuards(InternalApiGuard)
export class InternalDailyCasesController {
  private readonly logger = new Logger(InternalDailyCasesController.name);

  constructor(
    private readonly dailyCaseSchedulerService: DailyCaseSchedulerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('scheduler/status')
  getSchedulerStatus() {
    return this.dailyCaseSchedulerService.getStatus();
  }

  @Post('ensure-window')
  async ensureWindow(@Body() body: EnsureDailyCaseWindowDto = {}) {
    try {
      const outcome =
        await this.dailyCaseSchedulerService.runManualEnsureWindow({
          startDate: body.startDate,
          days: body.days,
        });
      return outcome.status === 'completed' ? outcome.result : outcome;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'daily_case.schedule.api.ensure_window.failed',
          startDate: body.startDate ?? null,
          days: body.days ?? 7,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Post('dev/cleanup-assignments')
  @UseGuards(InternalApiGuard, DevOnlyGuard)
  async cleanupAssignments(@Body() body: CleanupDailyCaseAssignmentsDto) {
    const caseIds = Array.from(
      new Set((body.caseIds ?? []).map((caseId) => caseId.trim())),
    ).filter((caseId) => caseId.length > 0);

    if (caseIds.length === 0) {
      throw new BadRequestException('caseIds must contain at least one id');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const dailyCases = await tx.dailyCase.findMany({
          where: {
            caseId: {
              in: caseIds,
            },
          },
          select: {
            id: true,
            caseId: true,
            date: true,
            track: true,
            sequenceIndex: true,
          },
          orderBy: [{ date: 'asc' }, { track: 'asc' }, { sequenceIndex: 'asc' }],
        });

        const dailyCaseIds = dailyCases.map((dailyCase) => dailyCase.id);
        const [caseCount, sessionCount, attemptCount, leaderboardEntryCount] =
          await Promise.all([
            tx.case.count({
              where: {
                id: {
                  in: caseIds,
                },
              },
            }),
            tx.gameSession.count({
              where: {
                dailyCaseId: {
                  in: dailyCaseIds,
                },
              },
            }),
            tx.attempt.count({
              where: {
                session: {
                  dailyCaseId: {
                    in: dailyCaseIds,
                  },
                },
              },
            }),
            tx.leaderboardEntry.count({
              where: {
                dailyCaseId: {
                  in: dailyCaseIds,
                },
              },
            }),
          ]);

        const planned = {
          dailyCases: dailyCases.length,
          gameSessions: sessionCount,
          attempts: attemptCount,
          leaderboardEntries: leaderboardEntryCount,
        };

        this.logger.warn(
          JSON.stringify({
            event: 'daily_case.dev.cleanup_assignments.planned',
            requestedCaseIds: caseIds,
            preserved: {
              cases: caseCount,
            },
            willDelete: planned,
          }),
        );

        const deleted = await tx.dailyCase.deleteMany({
          where: {
            id: {
              in: dailyCaseIds,
            },
          },
        });

        const response = {
          success: true,
          requestedCaseIds: caseIds,
          preserved: {
            cases: caseCount,
          },
          deleted: {
            dailyCases: deleted.count,
            gameSessions: sessionCount,
            attempts: attemptCount,
            leaderboardEntries: leaderboardEntryCount,
          },
          affectedDailyCases: dailyCases.map((dailyCase) => ({
            id: dailyCase.id,
            caseId: dailyCase.caseId,
            date: dailyCase.date.toISOString().slice(0, 10),
            track: dailyCase.track,
            sequenceIndex: dailyCase.sequenceIndex,
          })),
        };

        this.logger.warn(
          JSON.stringify({
            event: 'daily_case.dev.cleanup_assignments.completed',
            requestedCaseIds: response.requestedCaseIds,
            preserved: response.preserved,
            deleted: response.deleted,
          }),
        );

        return response;
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'daily_case.dev.cleanup_assignments.failed',
          caseIds,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
