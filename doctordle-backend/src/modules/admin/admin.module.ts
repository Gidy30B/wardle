import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { CaseGeneratorModule } from '../case-generator/case-generator.module';

@Module({
  imports: [CaseGeneratorModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
