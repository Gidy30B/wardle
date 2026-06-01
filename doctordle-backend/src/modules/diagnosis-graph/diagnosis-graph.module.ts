import { Module } from '@nestjs/common';
import { EditorialGuard, SeniorEditorialGuard } from '../../auth/editorial.guard';
import { DatabaseModule } from '../../core/db/database.module';
import { AdminGuard } from '../admin/admin.guard';
import { AdminDiagnosisGraphController } from './admin-diagnosis-graph.controller';
import { DiagnosisGraphCandidatesService } from './diagnosis-graph-candidates.service';
import { DiagnosisGraphController } from './diagnosis-graph.controller';
import { DiagnosisGraphExtractionService } from './diagnosis-graph-extraction.service';
import { DifferentialRegistryResolutionService } from './differential-registry-resolution.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DiagnosisGraphController, AdminDiagnosisGraphController],
  providers: [
    AdminGuard,
    EditorialGuard,
    SeniorEditorialGuard,
    DiagnosisGraphCandidatesService,
    DiagnosisGraphExtractionService,
    DifferentialRegistryResolutionService,
  ],
  exports: [
    DiagnosisGraphCandidatesService,
    DiagnosisGraphExtractionService,
    DifferentialRegistryResolutionService,
  ],
})
export class DiagnosisGraphModule {}
