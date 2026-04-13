import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module.js';
import { CaseGeneratorService } from './case-generator.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [CaseGeneratorService],
  exports: [CaseGeneratorService],
})
export class CaseGeneratorModule {}
