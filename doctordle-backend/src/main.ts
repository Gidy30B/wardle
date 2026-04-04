import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

  app.enableCors(createCorsOptions());

  // 🔥 CRITICAL: DO NOT trust env.PORT for Railway
  const port = parseInt(process.env.PORT || '', 10) || 8080;
  const host = '0.0.0.0';

  await app.listen(port, host);

  console.log(`🚀 Server running on ${host}:${port}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`📡 Health endpoint: /health`);
}

bootstrap();
