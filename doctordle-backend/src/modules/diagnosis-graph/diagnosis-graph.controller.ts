import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { DiagnosisGraphCandidateType } from '@prisma/client';
import { DiagnosisGraphCandidatesService } from './diagnosis-graph-candidates.service';

@Controller('diagnosis-registry/:id')
export class DiagnosisGraphController {
  constructor(
    private readonly candidatesService: DiagnosisGraphCandidatesService,
  ) {}

  @Get('graph')
  async getGraph(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.candidatesService.getActiveGraph(id);
  }

  @Get('mimics')
  async getMimics(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.candidatesService.getActiveFactsByType(
      id,
      DiagnosisGraphCandidateType.MIMIC,
    );
  }

  @Get('findings')
  async getFindings(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.candidatesService.getActiveFactsByType(
      id,
      DiagnosisGraphCandidateType.FINDING,
    );
  }

  @Get('pitfalls')
  async getPitfalls(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.candidatesService.getActiveFactsByType(
      id,
      DiagnosisGraphCandidateType.PITFALL,
    );
  }
}
