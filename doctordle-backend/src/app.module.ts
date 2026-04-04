import { Module, OnModuleInit } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './core/db/database.module';
import { SeedService } from './core/db/seed.service';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CasesModule } from './modules/cases/cases.module.js';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { GameplayModule } from './modules/gameplay/gameplay.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AuthModule } from './auth/auth.module';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    CasesModule,
    KnowledgeModule,
    DiagnosticsModule,
    AuthModule,
    GameplayModule,
    AnalyticsModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly seedService: SeedService) {}

  async onModuleInit(): Promise<void> {
    await this.seedService.seedCases();
  }
}
