import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { CaseGeneratorService } from '../case-generator/case-generator.service';
import { AdminGuard } from './admin.guard';
import { CaseReviewService } from './case-review.service';
import { CreateAndLinkDiagnosisDto } from './dto/create-and-link-diagnosis.dto';
import { CreateDiagnosisAliasDto } from './dto/create-diagnosis-alias.dto';
import { CreateDiagnosisRegistryDto } from './dto/create-diagnosis-registry.dto';
import { LinkCaseDiagnosisDto } from './dto/link-case-diagnosis.dto';
import { ListEditorialCasesDto } from './dto/list-editorial-cases.dto';
import { SearchDiagnosisRegistryDto } from './dto/search-diagnosis-registry.dto';
import { SubmitCaseReviewDto } from './dto/submit-case-review.dto';

type GenerateCasesBody = {
  count?: number;
  track?: string;
  difficulty?: string;
};

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly caseGenerator: CaseGeneratorService,
    private readonly caseReviewService: CaseReviewService,
  ) {}

  @Get('cases')
  async listEditorialCases(@Query() query: ListEditorialCasesDto) {
    return this.caseReviewService.listEditorialCases(query);
  }

  @Get('summary/editorial-statuses')
  async getEditorialStatusSummary() {
    return this.caseReviewService.getEditorialStatusSummary();
  }

  @Get('summary/validation-outcomes')
  async getValidationOutcomeSummary() {
    return this.caseReviewService.getValidationOutcomeSummary();
  }

  @Get('summary/publish-results')
  async getPublishAssignmentSummary() {
    return this.caseReviewService.getPublishAssignmentSummary();
  }

  @Get('cases/:caseId')
  async getEditorialCaseDetail(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.getCaseDetail(caseId);
  }

  @Get('diagnosis-registry')
  async searchDiagnosisRegistry(@Query() query: SearchDiagnosisRegistryDto) {
    return this.caseReviewService.searchDiagnosisRegistry(query);
  }

  @Post('diagnosis-registry')
  async createDiagnosisRegistry(
    @Body() body: CreateDiagnosisRegistryDto,
  ) {
    return this.caseReviewService.createDiagnosisRegistry(body);
  }

  @Post('diagnosis-registry/:diagnosisRegistryId/aliases')
  async addDiagnosisAlias(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
    @Body() body: CreateDiagnosisAliasDto,
  ) {
    return this.caseReviewService.addDiagnosisAlias(diagnosisRegistryId, body);
  }

  @Post('cases/:caseId/rerun-validation')
  async rerunValidation(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.rerunValidation(caseId, request.user.id);
  }

  @Post('cases/:caseId/start-review')
  async startReview(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.startReview(caseId, request.user.id);
  }

  @Post('cases/:caseId/review')
  async submitReview(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: SubmitCaseReviewDto,
  ) {
    return this.caseReviewService.submitReview(
      caseId,
      request.user.id,
      body,
    );
  }

  @Post('cases/:caseId/diagnosis-link')
  async linkDiagnosisToCase(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: LinkCaseDiagnosisDto,
  ) {
    return this.caseReviewService.linkDiagnosisToCase(
      caseId,
      request.user.id,
      body,
    );
  }

  @Post('cases/:caseId/create-and-link-diagnosis')
  async createAndLinkDiagnosis(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateAndLinkDiagnosisDto,
  ) {
    return this.caseReviewService.createAndLinkDiagnosis(
      caseId,
      request.user.id,
      body,
    );
  }

  @Get('cases/:caseId/revisions')
  async listRevisions(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.listRevisions(caseId);
  }

  @Post('cases/:caseId/revisions/:revisionId/restore')
  async restoreRevision(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.restoreRevision(
      caseId,
      revisionId,
      request.user.id,
    );
  }

  @Post('cases/:caseId/ready-to-publish')
  async markReadyToPublish(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.markReadyToPublish(caseId);
  }

  @Post('generate-cases')
  async generateCases(@Body() body: GenerateCasesBody = {}) {
    const count = body.count ?? 10;
    if (count > 50) {
      throw new BadRequestException('Max 50 per request');
    }

    return this.caseGenerator.generateBatch({
      count,
      track: body.track,
      difficulty: body.difficulty,
    });
  }
}
