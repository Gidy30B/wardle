import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { AdminGuard } from '../admin/admin.guard';
import { DiagnosisGraphModule } from '../diagnosis-graph/diagnosis-graph.module';
import { EditorialIntentProjectionService } from '../editorial/editorial-intent-projection.service';
import { GenerationContextBuilder } from '../editorial/generation-context-builder.service';
import { AdminEducationController } from './admin-education.controller';
import { DiagnosisEducationService } from './diagnosis-education.service';
import { EducationDraftQualityValidator } from './education-draft-quality-validator.service';
import { EducationController } from './education.controller';
import { EducationKnowledgeRulesService } from './education-knowledge-rules.service';

@Module({
  imports: [DatabaseModule, DiagnosisGraphModule],
  controllers: [EducationController, AdminEducationController],
  providers: [
    DiagnosisEducationService,
    EditorialIntentProjectionService,
    GenerationContextBuilder,
    EducationKnowledgeRulesService,
    EducationDraftQualityValidator,
    AdminGuard,
  ],
  exports: [DiagnosisEducationService],
})
export class EducationModule {}
