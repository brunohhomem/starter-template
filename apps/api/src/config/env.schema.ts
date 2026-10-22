import { z } from '@starter/shared/zod';

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const nodeEnvSchema = z.enum(['development', 'production', 'test']);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535),
  APP_ORIGIN: z.string().url(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0),
  LOG_LEVEL: logLevelSchema.default('info'),
  SWAGGER_ENABLED: z.coerce.boolean().default(false),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).optional(),

  TEST_DB_NAME: z.string().min(1).optional(),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535),
  REDIS_PASSWORD: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(44),
  JWT_REFRESH_SECRET: z.string().min(44),
  COOKIE_SECRET: z.string().min(44),
  ENCRYPTION_KEY: z.string().length(44),
});

export type Env = z.infer<typeof envSchema>;

import type { ZodIssue } from '@starter/shared/zod';

export function validateEnv(rawEnv: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues.map((issue: ZodIssue) => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    });
    const message = ['Variáveis de ambiente inválidas ou ausentes:', ...issues].join('\n');
    throw new Error(message);
  }
  return result.data;
}

export function buildTestDbName(env: Env): string {
  return env.TEST_DB_NAME ?? `${env.DB_NAME}_test`;
}
