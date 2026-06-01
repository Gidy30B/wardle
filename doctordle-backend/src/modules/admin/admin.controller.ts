import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { canPublishEditorial } from '../../auth/roles';
import { CaseGeneratorService } from '../case-generator/case-generator.service';
import { AdminGuard } from './admin.guard';
import { CaseReviewService } from './case-review.service';
import { DiagnosisEditorialWorkspaceService } from './diagnosis-editorial-workspace.service';
import { DiagnosisWorkspaceQualityService } from './diagnosis-workspace-quality.service';
import { TeachingUnitCoverageService } from './teaching-unit-coverage.service';
import {
  TargetedCaseGenerationService,
  type TargetedCaseGenerationPayload,
} from './targeted-case-generation.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';
import { DiagnosisEditorialBriefService } from '../education/diagnosis-editorial-brief.service';
import { CreateAndLinkDiagnosisDto } from './dto/create-and-link-diagnosis.dto';
import { CreateDiagnosisAliasDto } from './dto/create-diagnosis-alias.dto';
import { CreateDiagnosisRegistryDto } from './dto/create-diagnosis-registry.dto';
import { LinkCaseDiagnosisDto } from './dto/link-case-diagnosis.dto';
import { ListEditorialCasesDto } from './dto/list-editorial-cases.dto';
import { SearchDiagnosisRegistryDto } from './dto/search-diagnosis-registry.dto';
import { SubmitCaseReviewDto } from './dto/submit-case-review.dto';
import { UpdateCaseDiagnosisDto } from './dto/update-case-diagnosis.dto';

type GenerateCasesBody = {
  count?: number;
  track?: string;
  bodySystem?: string;
  difficulty?: string;
  registryFirst?: boolean;
  diagnosisRegistryIds?: string[];
};

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly caseGenerator: CaseGeneratorService,
    private readonly caseReviewService: CaseReviewService,
    private readonly diagnosisEditorialWorkspaceService: DiagnosisEditorialWorkspaceService,
    private readonly diagnosisWorkspaceQualityService: DiagnosisWorkspaceQualityService,
    private readonly teachingUnitCoverageService: TeachingUnitCoverageService,
    private readonly targetedCaseGenerationService: TargetedCaseGenerationService,
    private readonly teachingRulesAdminService: TeachingRulesAdminService,
    private readonly diagnosisEditorialBriefService: DiagnosisEditorialBriefService,
  ) {}

  @Get('cases')
  @EditorialAccess()
  async listEditorialCases(@Query() query: ListEditorialCasesDto) {
    return this.caseReviewService.listEditorialCases(query);
  }

  @Get('summary/editorial-statuses')
  @EditorialAccess()
  async getEditorialStatusSummary() {
    return this.caseReviewService.getEditorialStatusSummary();
  }

  @Get('summary/validation-outcomes')
  @EditorialAccess()
  async getValidationOutcomeSummary() {
    return this.caseReviewService.getValidationOutcomeSummary();
  }

  @Get('summary/publish-results')
  @EditorialAccess()
  async getPublishAssignmentSummary() {
    return this.caseReviewService.getPublishAssignmentSummary();
  }

  @Get('cases/:caseId')
  @EditorialAccess()
  async getEditorialCaseDetail(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.getCaseDetail(caseId);
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/full')
  @EditorialAccess()
  async getFullDiagnosisEditorialWorkspace(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.diagnosisEditorialWorkspaceService.getFullWorkspace(
      diagnosisRegistryId,
    );
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId')
  @EditorialAccess()
  async getDiagnosisWorkspaceQualitySummary(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.diagnosisWorkspaceQualityService.getSummary(diagnosisRegistryId);
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/teaching-units')
  @EditorialAccess()
  async getDiagnosisTeachingUnitCoverage(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.teachingUnitCoverageService.getCoverage(diagnosisRegistryId);
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/teaching-rules')
  @EditorialAccess()
  async listDiagnosisTeachingRules(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.teachingRulesAdminService.listRules(diagnosisRegistryId);
  }

  @Get('diagnosis-workspace/:diagnosisRegistryId/editorial-brief')
  @EditorialAccess()
  async getDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.diagnosisEditorialBriefService.getBrief(diagnosisRegistryId);
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/editorial-brief/generate')
  @EditorialAccess()
  async generateDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.diagnosisEditorialBriefService.generateBrief(diagnosisRegistryId);
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/editorial-brief')
  @EditorialAccess()
  async createDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
    ]);
    return this.diagnosisEditorialBriefService.createBrief(
      diagnosisRegistryId,
      body,
    );
  }

  @Patch('diagnosis-workspace/:diagnosisRegistryId/editorial-brief')
  @EditorialAccess()
  async updateDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
    ]);
    return this.diagnosisEditorialBriefService.updateBrief(
      diagnosisRegistryId,
      body,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/editorial-brief/review')
  @SeniorEditorialAccess()
  async reviewDiagnosisEditorialBrief(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
    @Body() body: { action?: unknown },
  ) {
    return this.diagnosisEditorialBriefService.reviewBrief(
      diagnosisRegistryId,
      body?.action,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/teaching-rules')
  @EditorialAccess()
  async createDiagnosisTeachingRule(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
      'REJECTED',
    ]);
    return this.teachingRulesAdminService.createRule(diagnosisRegistryId, body);
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/teaching-rules/generate')
  @EditorialAccess()
  async generateDiagnosisTeachingRules(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.teachingRulesAdminService.generateCandidateRules(
      diagnosisRegistryId,
    );
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/teaching-rules/seed-legacy')
  @EditorialAccess()
  async seedLegacyDiagnosisTeachingRules(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
  ) {
    return this.teachingRulesAdminService.seedLegacyRulesForDiagnosis(
      diagnosisRegistryId,
    );
  }

  @Patch('teaching-rules/:ruleId')
  @EditorialAccess()
  async updateTeachingRule(
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertDraftLevelStatus(body, request.user.role, [
      'APPROVED',
      'ACTIVE',
      'DEPRECATED',
      'REJECTED',
    ]);
    return this.teachingRulesAdminService.updateRule(ruleId, body);
  }

  @Post('teaching-rules/:ruleId/review')
  @SeniorEditorialAccess()
  async reviewTeachingRule(
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
    @Body() body: { action?: unknown },
  ) {
    return this.teachingRulesAdminService.reviewRule(ruleId, body?.action);
  }

  @Post('diagnosis-workspace/:diagnosisRegistryId/generate-case')
  @EditorialAccess()
  async generateTargetedCase(
    @Param('diagnosisRegistryId', new ParseUUIDPipe()) diagnosisRegistryId: string,
    @Body() body: TargetedCaseGenerationPayload,
  ) {
    this.validateTargetedCasePayload(body);

    return this.targetedCaseGenerationService.generate({
      diagnosisRegistryId,
      payload: body,
    });
  }

  @Get('diagnosis-registry')
  @EditorialAccess()
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
  @EditorialAccess()
  async rerunValidation(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.rerunValidation(caseId, request.user.id);
  }

  @Post('cases/:caseId/start-review')
  @EditorialAccess()
  async startReview(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.caseReviewService.startReview(caseId, request.user.id);
  }

  @Post('cases/:caseId/review')
  @SeniorEditorialAccess()
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
  @EditorialAccess()
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

  @Patch('cases/:caseId/diagnosis')
  @EditorialAccess()
  async updateCaseDiagnosis(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateCaseDiagnosisDto,
  ) {
    return this.caseReviewService.updateCaseDiagnosis(
      caseId,
      request.user.id,
      body,
    );
  }

  @Post('cases/:caseId/create-and-link-diagnosis')
  @EditorialAccess()
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
  @EditorialAccess()
  async listRevisions(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.listRevisions(caseId);
  }

  @Post('cases/:caseId/revisions/:revisionId/restore')
  @EditorialAccess()
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
  @SeniorEditorialAccess()
  async markReadyToPublish(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.caseReviewService.markReadyToPublish(caseId);
  }

  @Post('generate-cases')
  async generateCases(@Body() body: GenerateCasesBody = {}) {
    const diagnosisRegistryIds = this.validateDiagnosisRegistryIds(
      body.diagnosisRegistryIds,
    );
    const count = body.count ?? diagnosisRegistryIds?.length ?? 10;
    if (count > 50) {
      throw new BadRequestException('Max 50 per request');
    }

    return this.caseGenerator.generateBatch({
      count,
      track: body.track,
      bodySystem: body.bodySystem,
      difficulty: body.difficulty,
      registryFirst: body.registryFirst !== false,
      diagnosisRegistryIds,
    });
  }

  private validateDiagnosisRegistryIds(value: unknown): string[] | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException('diagnosisRegistryIds must be an array');
    }

    if (value.length === 0) {
      return undefined;
    }

    if (value.length > 20) {
      throw new BadRequestException('diagnosisRegistryIds supports at most 20 IDs');
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ids = value.map((item) => {
      if (typeof item !== 'string' || !uuidPattern.test(item)) {
        throw new BadRequestException(
          'diagnosisRegistryIds must contain only UUID strings',
        );
      }

      return item;
    });

    return [...new Set(ids)];
  }

  private validateTargetedCasePayload(
    body: TargetedCaseGenerationPayload,
  ): void {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required');
    }

    if (!['EASY', 'MEDIUM', 'HARD'].includes(body.difficulty)) {
      throw new BadRequestException('difficulty must be EASY, MEDIUM, or HARD');
    }

    if (
      body.clueRevealStrategy !== undefined &&
      ![
        'classic',
        'early_anchor',
        'late_discriminator',
        'progressive_narrowing',
      ].includes(body.clueRevealStrategy)
    ) {
      throw new BadRequestException('Invalid clueRevealStrategy');
    }
  }

  private assertDraftLevelStatus(
    body: Record<string, unknown>,
    role: string | null | undefined,
    seniorOnlyStatuses: string[],
  ) {
    const status = typeof body.status === 'string' ? body.status : null;
    if (status && seniorOnlyStatuses.includes(status) && !canPublishEditorial(role)) {
      throw new ForbiddenException('Requires senior editor');
    }
  }
}
