import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { DatabaseModule } from './core/db/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { CaseGeneratorModule } from './modules/case-generator/case-generator.module.js';
import { CasesModule } from './modules/cases/cases.module.js';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { GameplayModule } from './modules/gameplay/gameplay.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './modules/queue/queue.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  controllers: [HealthController],
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    CasesModule,
    KnowledgeModule,
    DiagnosticsModule,
    AuthModule,
    GameplayModule,
    QueueModule,
    AdminModule,
    AnalyticsModule,
    AiModule,
    CaseGeneratorModule,
    RealtimeModule,
    OrganizationsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
