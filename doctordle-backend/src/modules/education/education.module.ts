import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { AdminGuard } from '../admin/admin.guard';
import { DiagnosisGraphModule } from '../diagnosis-graph/diagnosis-graph.module';
import { AdminEducationController } from './admin-education.controller';
import { DiagnosisEducationService } from './diagnosis-education.service';
import { EducationController } from './education.controller';

@Module({
  imports: [DatabaseModule, DiagnosisGraphModule],
  controllers: [EducationController, AdminEducationController],
  providers: [DiagnosisEducationService, AdminGuard],
  exports: [DiagnosisEducationService],
})
export class EducationModule {}
