import { Module } from '@nestjs/common';
import { EditorialGuard, SeniorEditorialGuard } from '../../auth/editorial.guard';
import { DatabaseModule } from '../../core/db/database.module';
import { AdminGuard } from '../admin/admin.guard';
import { AdminDiagnosisGraphController } from './admin-diagnosis-graph.controller';
import { DiagnosisGraphCandidatesService } from './diagnosis-graph-candidates.service';
import { DiagnosisGraphController } from './diagnosis-graph.controller';
import { DiagnosisGraphExtractionService } from './diagnosis-graph-extraction.service';
import { DifferentialLinkService } from './differential-link.service';
import { DifferentialMappingService } from './differential-mapping.service';
import { DifferentialRegistryResolutionService } from './differential-registry-resolution.service';
import { AliasValidationService } from '../diagnosis-registry/alias-validation.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DiagnosisGraphController, AdminDiagnosisGraphController],
  providers: [
    AdminGuard,
    EditorialGuard,
    SeniorEditorialGuard,
    DiagnosisGraphCandidatesService,
    DiagnosisGraphExtractionService,
    DifferentialLinkService,
    DifferentialMappingService,
    DifferentialRegistryResolutionService,
    AliasValidationService,
  ],
  exports: [
    DiagnosisGraphCandidatesService,
    DiagnosisGraphExtractionService,
    DifferentialLinkService,
    DifferentialMappingService,
    DifferentialRegistryResolutionService,
    AliasValidationService,
  ],
})
export class DiagnosisGraphModule {}
