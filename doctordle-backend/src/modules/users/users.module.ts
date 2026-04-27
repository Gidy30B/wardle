import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/db/database.module';
import { UserSyncService } from './user-sync.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UserSyncService, UsersService],
  exports: [UserSyncService, UsersService],
})
export class UsersModule {}
