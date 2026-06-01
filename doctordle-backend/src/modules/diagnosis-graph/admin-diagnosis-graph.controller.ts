import {
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
import {
  EditorialAccess,
  SeniorEditorialAccess,
} from '../../auth/editorial-permission.decorator';
import { AdminGuard } from '../admin/admin.guard';
import { DiagnosisGraphCandidatesService } from './diagnosis-graph-candidates.service';
import { DiagnosisGraphExtractionService } from './diagnosis-graph-extraction.service';
import { ListGraphCandidatesDto } from './dto/list-graph-candidates.dto';
import {
  MergeGraphCandidateDto,
  RejectGraphCandidateDto,
  ResolveMimicCandidateDto,
} from './dto/review-graph-candidate.dto';
import { SmokeExtractGraphDto } from './dto/smoke-extract-graph.dto';

@Controller('admin/diagnosis-graph')
@UseGuards(AdminGuard)
export class AdminDiagnosisGraphController {
  constructor(
    private readonly candidatesService: DiagnosisGraphCandidatesService,
    private readonly extractionService: DiagnosisGraphExtractionService,
  ) {}

  @Get('candidates')
  @EditorialAccess()
  async listCandidates(@Query() query: ListGraphCandidatesDto) {
    return this.candidatesService.listCandidates(query);
  }

  @Get('candidates/unresolved-mimics')
  @EditorialAccess()
  async listUnresolvedMimicCandidates() {
    return this.candidatesService.listUnresolvedMimicCandidates();
  }

  @Get('candidates/:id')
  @EditorialAccess()
  async getCandidate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.candidatesService.getCandidate(id);
  }

  @Post('candidates/:id/approve')
  @SeniorEditorialAccess()
  async approveCandidate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidatesService.approveCandidate(id, request.user.id);
  }

  @Post('candidates/:id/reject')
  @SeniorEditorialAccess()
  async rejectCandidate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: RejectGraphCandidateDto,
  ) {
    return this.candidatesService.rejectCandidate(id, request.user.id, body);
  }

  @Post('candidates/:id/merge')
  @SeniorEditorialAccess()
  async mergeCandidate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: MergeGraphCandidateDto,
  ) {
    return this.candidatesService.mergeCandidate(id, request.user.id, body);
  }

  @Post('candidates/:id/resolve-mimic')
  @SeniorEditorialAccess()
  async resolveMimicCandidate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ResolveMimicCandidateDto,
  ) {
    return this.candidatesService.resolveMimicCandidate(
      id,
      request.user.id,
      body,
    );
  }

  @Post('extract/smoke')
  async runSmokeExtraction(@Body() body: SmokeExtractGraphDto) {
    return this.extractionService.runSmokeExtraction(body);
  }
}
