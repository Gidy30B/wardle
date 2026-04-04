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

  const port = env.PORT;
  const host = env.HOST?.trim() || '0.0.0.0';

  await app.listen(port, host);

  const publicUrl = await app.getUrl();
  console.log(`✅ Server listening on ${publicUrl}`);
  console.log(`✅ Environment: ${env.NODE_ENV}`);
  console.log(`✅ API available at http://localhost:${port} (from container)`);
  if (env.NETWORK_HOST?.trim()) {
    const networkHost = env.NETWORK_HOST.trim();
    console.log(`✅ Network accessible at http://${networkHost}:${port}`);
  }
}
bootstrap();
