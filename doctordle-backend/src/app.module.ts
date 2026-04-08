import { Module, OnModuleInit } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './core/db/database.module';
import { SeedService } from './core/db/seed.service';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { CasesModule } from './modules/cases/cases.module.js';
import { CasesService } from './modules/cases/cases.service';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { GameplayModule } from './modules/gameplay/gameplay.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    CasesModule,
    KnowledgeModule,
    DiagnosticsModule,
    AuthModule,
    GameplayModule,
    QueueModule,
    AnalyticsModule,
    AiModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly seedService: SeedService,
    private readonly casesService: CasesService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedService.seedCases(this.casesService);
  }
}
