import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { CasesService } from './cases.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
