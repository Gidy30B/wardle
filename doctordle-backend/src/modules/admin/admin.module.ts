import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { CaseGeneratorModule } from '../case-generator/case-generator.module';
import { DatabaseModule } from '../../core/db/database.module';
import { CaseValidationModule } from '../case-validation/case-validation.module';
import { EditorialObservabilityModule } from '../editorial/editorial-observability.module.js';
import { CaseReviewService } from './case-review.service';

@Module({
  imports: [
    CaseGeneratorModule,
    DatabaseModule,
    CaseValidationModule,
    EditorialObservabilityModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard, CaseReviewService],
})
export class AdminModule {}
