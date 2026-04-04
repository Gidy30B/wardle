import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createCorsOptions } from './core/config/cors.util';
import { validateEnv } from './core/config/env.validation';

function resolveNetworkHost(networkHost?: string): string | null {
  if (networkHost?.trim()) {
    return networkHost;
  }

  return null;
}

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

  const host = env.HOST;
  const port = env.PORT;

  await app.listen(port, host);

  const networkHost = resolveNetworkHost(env.NETWORK_HOST);
  console.log(`Server listening on http://localhost:${port}`);
  if (networkHost) {
    console.log(`Server listening on http://${networkHost}:${port}`);
  }
}
bootstrap();
