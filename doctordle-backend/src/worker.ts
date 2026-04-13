import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from './core/config/env.validation';
import { WorkerModule } from './modules/queue/worker.module';

async function bootstrap() {
  validateEnv();
  const logger = new Logger('QueueWorkerBootstrap');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  app.enableShutdownHooks();

  logger.log('Queue worker started');

  const shutdown = async (signal: string) => {
    logger.warn(`Queue worker shutting down on ${signal}`);
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
