import { Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { Public } from '../../auth/public.decorator';
import { CasesService } from './cases.service';
import { DevOnlyGuard } from './guards/dev-only.guard';

@Controller('dev')
@Public()
@UseGuards(InternalApiGuard, DevOnlyGuard)
export class DevController {
  private readonly logger = new Logger(DevController.name);

  constructor(private readonly casesService: CasesService) {}

  @Post('reset-today')
  async resetTodayCase() {
    try {
      const result = await this.casesService.resetTodayCase();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'dev.reset_today.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Post('rebuild-today')
  async rebuildTodayCase() {
    try {
      const context = await this.casesService.rebuildTodayCase();
      return {
        success: true,
        dailyCaseId: context.dailyCaseId,
        displayLabel: context.displayLabel,
        trackDisplayLabel: context.trackDisplayLabel,
        caseId: context.caseId,
        date: context.date.toISOString().slice(0, 10),
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'dev.rebuild_today.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
