import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { AdminGuard } from '../admin/admin.guard';
import { DiagnosisEducationService } from './diagnosis-education.service';
import { ReviewDiagnosisEducationDto } from './dto/review-diagnosis-education.dto';
import { UpsertDiagnosisEducationDto } from './dto/upsert-diagnosis-education.dto';

@Controller('admin/education')
@UseGuards(AdminGuard)
export class AdminEducationController {
  private readonly logger = new Logger(AdminEducationController.name);

  constructor(
    private readonly diagnosisEducationService: DiagnosisEducationService,
  ) {}

  @Get('diagnoses/:diagnosisRegistryId')
  async getDiagnosisEducation(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisEducationService.getAdminByDiagnosisRegistryId(
      diagnosisRegistryId,
    );
  }

  @Post('diagnoses/:diagnosisRegistryId')
  async upsertDiagnosisEducation(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpsertDiagnosisEducationDto,
  ) {
    return this.diagnosisEducationService.upsertForDiagnosisRegistry(
      diagnosisRegistryId,
      body,
      request.user.id,
    );
  }

  @Post('diagnoses/:diagnosisRegistryId/generate')
  async generateDiagnosisEducationDraft(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'admin_education.generate.entered',
        diagnosisRegistryId,
        userId: request.user.id,
      }),
    );
    return this.diagnosisEducationService.generateDraft(
      diagnosisRegistryId,
      request.user.id,
    );
  }

  @Patch(':educationId')
  async updateDiagnosisEducation(
    @Param('educationId', new ParseUUIDPipe()) educationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpsertDiagnosisEducationDto,
  ) {
    return this.diagnosisEducationService.updateByEducationId(
      educationId,
      body,
      request.user.id,
    );
  }

  @Post(':educationId/review')
  async reviewDiagnosisEducation(
    @Param('educationId', new ParseUUIDPipe()) educationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ReviewDiagnosisEducationDto,
  ) {
    return this.diagnosisEducationService.reviewEducation(
      educationId,
      body,
      request.user.id,
    );
  }
}
