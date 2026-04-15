import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module.js';
import { CaseValidationModule } from '../case-validation/case-validation.module.js';
import { CaseGeneratorService } from './case-generator.service.js';

@Module({
  imports: [DatabaseModule, CaseValidationModule],
  providers: [CaseGeneratorService],
  exports: [CaseGeneratorService],
})
export class CaseGeneratorModule {}
