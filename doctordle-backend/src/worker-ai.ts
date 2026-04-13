import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from './core/config/env.validation';
import { AiWorkerModule } from './modules/queue/ai-worker.module';

async function bootstrap() {
  validateEnv();
  const logger = new Logger('AiWorkerBootstrap');
  const app = await NestFactory.createApplicationContext(AiWorkerModule);

  app.enableShutdownHooks();

  logger.log('AI queue worker started');

  const shutdown = async (signal: string) => {
    logger.warn(`AI queue worker shutting down on ${signal}`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap();
