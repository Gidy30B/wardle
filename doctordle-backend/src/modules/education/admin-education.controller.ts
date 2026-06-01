import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import {
  EditorialAccess,
  SeniorEditorialAccess,
} from '../../auth/editorial-permission.decorator';
import { AdminGuard } from '../admin/admin.guard';
import { WorkspaceProjectionService } from '../editorial/workspace-projection.service';
import { DiagnosisEducationService } from './diagnosis-education.service';
import { RegenerateEducationSectionDto } from './dto/regenerate-education-section.dto';
import { ReviewDiagnosisEducationDto } from './dto/review-diagnosis-education.dto';
import { UpsertDiagnosisEducationDto } from './dto/upsert-diagnosis-education.dto';
import { EducationRevisionQualityAnalyzer } from './education-revision-quality-analyzer.service';
import { EducationSectionRegenerationService } from './education-section-regeneration.service';
import { EditorialLearningEngineService } from './editorial-learning-engine.service';

@Controller('admin/education')
@UseGuards(AdminGuard)
export class AdminEducationController {
  private readonly logger = new Logger(AdminEducationController.name);

  constructor(
    private readonly diagnosisEducationService: DiagnosisEducationService,
    private readonly workspaceProjectionService: WorkspaceProjectionService,
    private readonly educationSectionRegenerationService: EducationSectionRegenerationService,
    private readonly educationRevisionQualityAnalyzer: EducationRevisionQualityAnalyzer,
    private readonly editorialLearningEngineService: EditorialLearningEngineService,
  ) {}

  @Get('diagnoses/:diagnosisRegistryId')
  @EditorialAccess()
  async getDiagnosisEducation(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisEducationService.getAdminByDiagnosisRegistryId(
      diagnosisRegistryId,
    );
  }

  @Get('diagnoses/:diagnosisRegistryId/workspace')
  @EditorialAccess()
  async getDiagnosisWorkspaceProjection(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.workspaceProjectionService.getProjection(diagnosisRegistryId);
  }

  @Get('diagnoses/:diagnosisRegistryId/revisions')
  @EditorialAccess()
  async listDiagnosisEducationRevisions(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.educationRevisionQualityAnalyzer.listRevisions(
      diagnosisRegistryId,
    );
  }

  @Get('diagnoses/:diagnosisRegistryId/revisions/compare')
  @EditorialAccess()
  async compareDiagnosisEducationRevisions(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Query('v1', ParseIntPipe) v1: number,
    @Query('v2', ParseIntPipe) v2: number,
  ) {
    return this.educationRevisionQualityAnalyzer.compareRevisions(
      diagnosisRegistryId,
      v1,
      v2,
    );
  }

  @Post('diagnoses/:diagnosisRegistryId/revisions/learn-from-edit')
  @EditorialAccess()
  async learnFromDiagnosisEducationEdit(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Body() body: { fromVersion: number; toVersion: number },
  ) {
    if (
      !Number.isInteger(body.fromVersion) ||
      !Number.isInteger(body.toVersion)
    ) {
      throw new BadRequestException('fromVersion and toVersion are required');
    }

    return this.editorialLearningEngineService.learnFromEdit({
      diagnosisRegistryId,
      fromVersion: body.fromVersion,
      toVersion: body.toVersion,
    });
  }

  @Get('diagnoses/:diagnosisRegistryId/revisions/:version')
  @EditorialAccess()
  async getDiagnosisEducationRevision(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.educationRevisionQualityAnalyzer.getRevision(
      diagnosisRegistryId,
      version,
    );
  }

  @Post('diagnoses/:diagnosisRegistryId')
  @EditorialAccess()
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
  @EditorialAccess()
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

  @Post('diagnoses/:diagnosisRegistryId/regenerate-section')
  @EditorialAccess()
  async regenerateDiagnosisEducationSection(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: RegenerateEducationSectionDto,
  ) {
    return this.educationSectionRegenerationService.regenerateSection({
      diagnosisRegistryId,
      section: body.section,
      userId: request.user.id,
    });
  }

  @Patch(':educationId')
  @EditorialAccess()
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
  @SeniorEditorialAccess()
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
