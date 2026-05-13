import './load-env.js';
import { z } from 'zod';

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const optionalBooleanWithDefault = (defaultValue: boolean) =>
  z
    .preprocess(emptyToUndefined, z.string().optional())
    .transform((value) =>
      value === undefined ? defaultValue : value === 'true',
    );

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  CLERK_JWT_ISSUER: z.string().url(),
  CLERK_JWT_AUDIENCE: z.string().min(1),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  HOST: z
    .preprocess(emptyToUndefined, z.string().min(1).optional())
    .default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  APP_PROCESS_ROLE: z
    .preprocess(emptyToUndefined, z.enum(['api', 'worker']).optional())
    .default('api'),
  DEV_BYPASS_DAILY_LIMIT: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  ENABLE_DEV_REPLAY: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  DIAGNOSIS_REGISTRY_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  STRICT_ALIAS_MATCH_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  DIAGNOSIS_AUTOCOMPLETE_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  SELECTION_FIRST_SUBMISSION_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  DAILY_SCHEDULER_ENABLED: optionalBooleanWithDefault(true),
  DAILY_SCHEDULE_WINDOW_DAYS: z
    .preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(31).optional(),
    )
    .default(7),
  DAILY_SCHEDULE_TIMEZONE: z
    .preprocess(emptyToUndefined, z.string().min(1).optional())
    .default('Africa/Nairobi'),
  DAILY_SCHEDULE_CRON: z
    .preprocess(emptyToUndefined, z.string().min(1).optional())
    .default('5 0 * * *'),
  LOG_LEVEL: z.string().min(1),
  ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  NETWORK_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  CLERK_JWKS_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  INTERNAL_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  EMBEDDING_MODEL: z.string().min(1),
  SCORE_WEIGHT_EXACT: z.coerce.number(),
  SCORE_WEIGHT_SYNONYM: z.coerce.number(),
  SCORE_WEIGHT_FUZZY: z.coerce.number(),
  SCORE_WEIGHT_EMBEDDING: z.coerce.number(),
  SCORE_WEIGHT_ONTOLOGY: z.coerce.number(),
  EVALUATOR_VERSION: z.string().min(1),
});

type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function validateEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  if (
    parsed.data.NODE_ENV === 'production' &&
    parsed.data.DEV_BYPASS_DAILY_LIMIT
  ) {
    throw new Error('DEV_BYPASS_DAILY_LIMIT must not be enabled in production');
  }

  if (parsed.data.NODE_ENV === 'production' && parsed.data.ENABLE_DEV_REPLAY) {
    throw new Error('ENABLE_DEV_REPLAY must not be enabled in production');
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    return validateEnv();
  }

  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
