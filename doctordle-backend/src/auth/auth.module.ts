import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../core/db/database.module';
import { GameplayModule } from '../modules/gameplay/gameplay.module';
import { UsersModule } from '../modules/users/users.module';
import { AuthController } from './auth.controller';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkJwtService } from './clerk-jwt.service';

@Module({
  imports: [DatabaseModule, UsersModule, GameplayModule],
  controllers: [AuthController],
  providers: [
    ClerkJwtService,
    ClerkAuthGuard,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
  exports: [ClerkAuthGuard, ClerkJwtService],
})
export class AuthModule {}
