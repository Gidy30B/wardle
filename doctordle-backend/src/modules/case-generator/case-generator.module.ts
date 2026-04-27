import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module.js';
import { CaseValidationModule } from '../case-validation/case-validation.module.js';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import { CaseGeneratorService } from './case-generator.service.js';

@Module({
  imports: [DatabaseModule, CaseValidationModule],
  providers: [CaseGeneratorService, DiagnosisRegistryLinkService],
  exports: [CaseGeneratorService],
})
export class CaseGeneratorModule {}
