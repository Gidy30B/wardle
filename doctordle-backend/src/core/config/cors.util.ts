import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { getEnv } from './env.validation';

function parseAllowedOrigins(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isLanIp(hostname: string): boolean {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isAllowedOrigin(origin: string, configuredAllowedOrigins: ReadonlyArray<string>): boolean {
  if (configuredAllowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return isLocalhost(parsed.hostname) || isLanIp(parsed.hostname);
  } catch {
    return false;
  }
}

export function createCorsOptions(): CorsOptions {
  const env = getEnv();
  const configuredAllowedOrigins = [
    'https://wardle-nu.vercel.app',
    'https://wardle-7xey.vercel.app',
    'http://localhost:5173',
    ...parseAllowedOrigins(env.ALLOWED_ORIGINS),
  ];
  const isProduction = env.NODE_ENV.toLowerCase() === 'production';

  if (isProduction && configuredAllowedOrigins.includes('*')) {
    throw new Error('ALLOWED_ORIGINS cannot contain "*" in production');
  }

  return {
    // Undefined origin is allowed for curl/native apps and server-to-server calls.
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin, configuredAllowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  };
}
