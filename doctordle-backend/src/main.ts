import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { createCorsOptions } from './core/config/cors.util';
import { validateEnv } from './core/config/env.validation';

async function bootstrap() {
  const env = validateEnv();
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log('Incoming request:', req.url);
    next();
  });

  app.enableCors(createCorsOptions());
  app.setGlobalPrefix('api');

  // 🔥 CRITICAL: DO NOT trust env.PORT for Railway
  const port = parseInt(process.env.PORT || '', 10) || 8080;
  const host = '0.0.0.0';

  await app.listen(port, host);

  console.log(`🚀 Server running on ${host}:${port}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`📡 Global prefix: /api`);
  console.log(`📡 Health endpoint: /api/health`);
}

bootstrap();
