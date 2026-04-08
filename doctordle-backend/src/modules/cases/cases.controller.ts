import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { CasesService } from './cases.service';
import { AssignDailyCaseDto } from './dto/assign-daily-case.dto';
import { CreateCaseDto } from './dto/create-case.dto';

@Controller('cases')
@Public()
@UseGuards(InternalApiGuard)
export class CasesController {
  private readonly logger = new Logger(CasesController.name);

  constructor(private readonly casesService: CasesService) {}

  @Post()
  async createCase(@Body() body: CreateCaseDto) {
    try {
      return await this.casesService.createCase(body);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'cases.api.create.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Post('assign-daily')
  async assignDailyCase(@Body() body: AssignDailyCaseDto) {
    try {
      return await this.casesService.assignDailyCase(body.date, body.caseId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'cases.api.assign_daily.failed',
          date: body.date,
          caseId: body.caseId,
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Get('today')
  async getTodayCase() {
    try {
      const today = await this.casesService.getTodayCase();
      return await this.casesService.getCaseById(today.caseId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'cases.api.today.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
