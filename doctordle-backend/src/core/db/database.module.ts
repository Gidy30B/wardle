import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SeedService } from './seed.service';

@Module({
  providers: [PrismaService, SeedService],
  exports: [PrismaService, SeedService],
})
export class DatabaseModule {}
