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
import {
  DiagnosisEducationRevisionApprovalOutcome,
  DiagnosisEducationStatus,
} from '@prisma/client';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { EditorialAccess, SeniorEditorialAccess } from '../../auth/editorial-permission.decorator';
import { AdminGuard } from '../admin/admin.guard';
import { WorkspaceProjectionService } from '../editorial/workspace-projection.service';
import { DiagnosisEducationService } from './diagnosis-education.service';
import { GenerateDiagnosisEducationDto } from './dto/generate-diagnosis-education.dto';
import { ApplyDiagnosisEducationCandidateDto } from './dto/apply-diagnosis-education-candidate.dto';
import { AuthorizeDiagnosisEducationPublicationDto } from './dto/authorize-diagnosis-education-publication.dto';
import { DecideDiagnosisEducationRevisionDto } from './dto/decide-diagnosis-education-revision.dto';
import { RegenerateEducationSectionDto } from './dto/regenerate-education-section.dto';
import { ReviewDiagnosisEducationCandidateDto } from './dto/review-diagnosis-education-candidate.dto';
import { ReviewDiagnosisEducationDto } from './dto/review-diagnosis-education.dto';
import { UpsertDiagnosisEducationDto } from './dto/upsert-diagnosis-education.dto';
import { WithdrawDiagnosisEducationPublicationDto } from './dto/withdraw-diagnosis-education-publication.dto';
import { DiagnosisEducationCandidateService } from './diagnosis-education-candidate.service';
import { DiagnosisEducationGovernanceService } from './diagnosis-education-governance.service';
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
    private readonly diagnosisEducationCandidateService: DiagnosisEducationCandidateService,
    private readonly diagnosisEducationGovernanceService: DiagnosisEducationGovernanceService,
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

  @Get(':educationId/revisions/:revisionId/publication-readiness')
  @EditorialAccess()
  async getDiagnosisEducationPublicationReadiness(
    @Param('educationId', new ParseUUIDPipe()) educationId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
  ) {
    return this.diagnosisEducationGovernanceService.getPublicationReadiness(
      educationId,
      revisionId,
    );
  }

  @Post(':educationId/revisions/:revisionId/decision')
  @SeniorEditorialAccess()
  async decideDiagnosisEducationRevision(
    @Param('educationId', new ParseUUIDPipe()) educationId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: DecideDiagnosisEducationRevisionDto,
  ) {
    return this.diagnosisEducationGovernanceService.decideRevision({
      educationId,
      revisionId,
      expectedVersion: body.expectedVersion,
      outcome: body.outcome,
      idempotencyKey: body.idempotencyKey,
      rationale: body.rationale,
      authorityReferences: body.authorityReferences,
      actorUserId: request.user.id,
    });
  }

  @Post(':educationId/revisions/:revisionId/publication')
  @SeniorEditorialAccess()
  async authorizeDiagnosisEducationPublication(
    @Param('educationId', new ParseUUIDPipe()) educationId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AuthorizeDiagnosisEducationPublicationDto,
  ) {
    return this.diagnosisEducationGovernanceService.authorizePublication({
      educationId,
      revisionId,
      expectedVersion: body.expectedVersion,
      expectedApprovalDecisionId: body.expectedApprovalDecisionId,
      expectedActivePublicationDecisionId:
        body.expectedActivePublicationDecisionId ?? null,
      idempotencyKey: body.idempotencyKey,
      rationale: body.rationale,
      authorityReferences: body.authorityReferences,
      actorUserId: request.user.id,
    });
  }

  @Post('publications/:publicationDecisionId/withdraw')
  @SeniorEditorialAccess()
  async withdrawDiagnosisEducationPublication(
    @Param('publicationDecisionId', new ParseUUIDPipe())
    publicationDecisionId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: WithdrawDiagnosisEducationPublicationDto,
  ) {
    return this.diagnosisEducationGovernanceService.withdrawPublication({
      publicationDecisionId,
      rationale: body.rationale,
      actorUserId: request.user.id,
    });
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
    @Body() body: GenerateDiagnosisEducationDto = {},
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
      body.expectedVersion,
    );
  }

  @Get('diagnoses/:diagnosisRegistryId/candidates')
  @EditorialAccess()
  async listDiagnosisEducationCandidates(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
  ) {
    return this.diagnosisEducationCandidateService.listForDiagnosis(
      diagnosisRegistryId,
    );
  }

  @Get('candidates/:candidateId')
  @EditorialAccess()
  async getDiagnosisEducationCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
  ) {
    return this.diagnosisEducationCandidateService.getCandidate(candidateId);
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
      expectedVersion: body.expectedVersion,
      userId: request.user.id,
    });
  }

  @Post('candidates/:candidateId/review')
  @EditorialAccess()
  async reviewDiagnosisEducationCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ReviewDiagnosisEducationCandidateDto,
  ) {
    return this.diagnosisEducationCandidateService.reviewCandidate({
      candidateId,
      decision: body.decision,
      rationale: body.rationale,
      reviewerUserId: request.user.id,
    });
  }

  @Post('candidates/:candidateId/apply')
  @EditorialAccess()
  async applyDiagnosisEducationCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ApplyDiagnosisEducationCandidateDto,
  ) {
    return this.diagnosisEducationCandidateService.applyCandidate({
      candidateId,
      idempotencyKey: body.idempotencyKey,
      rationale: body.rationale,
      authorityReferences: body.authorityReferences,
      actorUserId: request.user.id,
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
    const target =
      await this.diagnosisEducationGovernanceService.getCurrentRevisionTarget(
        educationId,
        body.expectedVersion,
      );
    const rationale =
      body.note?.trim() ||
      `Legacy Education review endpoint requested ${body.status}.`;

    if (body.status === DiagnosisEducationStatus.APPROVED) {
      return this.diagnosisEducationGovernanceService.decideRevision({
        educationId,
        revisionId: target.revisionId,
        expectedVersion: body.expectedVersion,
        outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
        idempotencyKey: `legacy-education-review:${educationId}:${target.revisionId}:approve:${body.expectedVersion}:${request.user.id}`,
        rationale,
        actorUserId: request.user.id,
      });
    }

    if (body.status === DiagnosisEducationStatus.NEEDS_EDIT) {
      return this.diagnosisEducationGovernanceService.decideRevision({
        educationId,
        revisionId: target.revisionId,
        expectedVersion: body.expectedVersion,
        outcome: DiagnosisEducationRevisionApprovalOutcome.CHANGES_REQUIRED,
        idempotencyKey: `legacy-education-review:${educationId}:${target.revisionId}:changes-required:${body.expectedVersion}:${request.user.id}`,
        rationale,
        actorUserId: request.user.id,
      });
    }

    if (body.status === DiagnosisEducationStatus.REJECTED) {
      return this.diagnosisEducationGovernanceService.decideRevision({
        educationId,
        revisionId: target.revisionId,
        expectedVersion: body.expectedVersion,
        outcome: DiagnosisEducationRevisionApprovalOutcome.REJECTED,
        idempotencyKey: `legacy-education-review:${educationId}:${target.revisionId}:reject:${body.expectedVersion}:${request.user.id}`,
        rationale,
        actorUserId: request.user.id,
      });
    }

    if (body.status === DiagnosisEducationStatus.PUBLISHED) {
      const approval =
        await this.diagnosisEducationGovernanceService.decideRevision({
          educationId,
          revisionId: target.revisionId,
          expectedVersion: body.expectedVersion,
          outcome: DiagnosisEducationRevisionApprovalOutcome.APPROVED,
          idempotencyKey: `legacy-education-review:${educationId}:${target.revisionId}:approve-before-publish:${body.expectedVersion}:${request.user.id}`,
          rationale: `${rationale} Approval recorded before separate publication authorization.`,
          actorUserId: request.user.id,
        });
      const readiness =
        await this.diagnosisEducationGovernanceService.getPublicationReadiness(
          educationId,
          target.revisionId,
        );
      return this.diagnosisEducationGovernanceService.authorizePublication({
        educationId,
        revisionId: target.revisionId,
        expectedVersion: body.expectedVersion,
        expectedApprovalDecisionId: approval.id,
        expectedActivePublicationDecisionId:
          readiness.activePublicationDecisionId,
        idempotencyKey: `legacy-education-review:${educationId}:${target.revisionId}:publish:${body.expectedVersion}:${request.user.id}`,
        rationale: `${rationale} Publication authorized as a separate canonical decision.`,
        actorUserId: request.user.id,
      });
    }

    throw new BadRequestException(
      'Use exact Education revision governance for approval, rejection, changes required, and publication',
    );
  }
}
