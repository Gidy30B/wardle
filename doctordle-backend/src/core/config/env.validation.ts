import { z } from 'zod';

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CLERK_JWT_ISSUER: z.string().url(),
  CLERK_JWT_AUDIENCE: z.string().min(1),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  HOST: z.string().min(1),
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DEV_BYPASS_DAILY_LIMIT: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  LOG_LEVEL: z.string().min(1),
  ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  NETWORK_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  CLERK_JWKS_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
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

  if (parsed.data.NODE_ENV === 'production' && parsed.data.DEV_BYPASS_DAILY_LIMIT) {
    throw new Error('DEV_BYPASS_DAILY_LIMIT must not be enabled in production');
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
