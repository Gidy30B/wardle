import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { DiagnosisEducationService } from './diagnosis-education.service';

@Controller('education')
export class EducationController {
  constructor(
    private readonly diagnosisEducationService: DiagnosisEducationService,
  ) {}

  @Get('diagnoses/:diagnosisRegistryId')
  async getDiagnosisEducation(
    @Param('diagnosisRegistryId', new ParseUUIDPipe())
    diagnosisRegistryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.diagnosisEducationService.getPublishedForUser({
      userId: request.user.id,
      diagnosisRegistryId,
    });
  }
}
