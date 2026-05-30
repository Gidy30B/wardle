import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { AdminGuard } from '../admin/admin.guard';
import { AdminDiagnosisGraphController } from './admin-diagnosis-graph.controller';
import { DiagnosisGraphCandidatesService } from './diagnosis-graph-candidates.service';
import { DiagnosisGraphController } from './diagnosis-graph.controller';
import { DiagnosisGraphExtractionService } from './diagnosis-graph-extraction.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DiagnosisGraphController, AdminDiagnosisGraphController],
  providers: [
    AdminGuard,
    DiagnosisGraphCandidatesService,
    DiagnosisGraphExtractionService,
  ],
  exports: [
    DiagnosisGraphCandidatesService,
    DiagnosisGraphExtractionService,
  ],
})
export class DiagnosisGraphModule {}
