import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { UserSyncService } from './user-sync.service';

@Module({
  imports: [DatabaseModule],
  providers: [UserSyncService],
  exports: [UserSyncService],
})
export class UsersModule {}
