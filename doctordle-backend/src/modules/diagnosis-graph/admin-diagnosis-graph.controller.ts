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
import { AdminGuard } from '../admin/admin.guard';
import { DiagnosisGraphCandidatesService } from './diagnosis-graph-candidates.service';
import { DiagnosisGraphExtractionService } from './diagnosis-graph-extraction.service';
import { ListGraphCandidatesDto } from './dto/list-graph-candidates.dto';
import {
  MergeGraphCandidateDto,
  RejectGraphCandidateDto,
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
  async listCandidates(@Query() query: ListGraphCandidatesDto) {
    return this.candidatesService.listCandidates(query);
  }

  @Get('candidates/:id')
  async getCandidate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.candidatesService.getCandidate(id);
  }

  @Post('candidates/:id/approve')
  async approveCandidate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidatesService.approveCandidate(id, request.user.id);
  }

  @Post('candidates/:id/reject')
  async rejectCandidate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: RejectGraphCandidateDto,
  ) {
    return this.candidatesService.rejectCandidate(id, request.user.id, body);
  }

  @Post('candidates/:id/merge')
  async mergeCandidate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: MergeGraphCandidateDto,
  ) {
    return this.candidatesService.mergeCandidate(id, request.user.id, body);
  }

  @Post('extract/smoke')
  async runSmokeExtraction(@Body() body: SmokeExtractGraphDto) {
    return this.extractionService.runSmokeExtraction(body);
  }
}
