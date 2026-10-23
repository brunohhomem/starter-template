import { z } from '@starter/shared/zod';

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const nodeEnvSchema = z.enum(['development', 'production', 'test']);
const mailDriverSchema = z.enum(['smtp', 'resend', 'memory']);

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
  BACKUP_ENCRYPTION_KEY: z.string().length(44),

  // Auth (F2)
  ADMIN_EMAIL: z.string().email(),
  ADMIN_INITIAL_PASSWORD: z.string().optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  COOKIE_SECURE: z.coerce.boolean().optional(),
  AUTH_ACCESS_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  AUTH_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  AUTH_REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(60).default(10),
  AUTH_BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  // Mail (F3)
  MAIL_DRIVER: mailDriverSchema.default('smtp'),
  MAIL_FROM: z.string().min(1).default('Starter <no-reply@localhost>'),
  APP_NAME: z.string().min(1).max(60).default('Starter Template'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_CONFIRM_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  INVITE_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
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
  const env = result.data;

  // TRUST_PROXY_HOPS é obrigatório em produção (sem padrão)
  if (env.NODE_ENV === 'production' && rawEnv.TRUST_PROXY_HOPS === undefined) {
    throw new Error(
      'Variáveis de ambiente inválidas ou ausentes:\n  - TRUST_PROXY_HOPS: obrigatório em produção',
    );
  }

  // COOKIE_SECURE padrão: true em produção, false caso contrário
  if (env.COOKIE_SECURE === undefined) {
    env.COOKIE_SECURE = env.NODE_ENV === 'production';
  }

  // Mail driver validações
  if (env.MAIL_DRIVER === 'memory' && env.NODE_ENV !== 'test') {
    throw new Error(
      'Variáveis de ambiente inválidas ou ausentes:\n  - MAIL_DRIVER: memory driver só permitido em NODE_ENV=test',
    );
  }

  if (env.NODE_ENV === 'production') {
    if (env.MAIL_DRIVER !== 'resend') {
      throw new Error(
        'Variáveis de ambiente inválidas ou ausentes:\n  - MAIL_DRIVER: deve ser "resend" em produção',
      );
    }
    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.trim() === '') {
      throw new Error(
        'Variáveis de ambiente inválidas ou ausentes:\n  - RESEND_API_KEY: obrigatório em produção com driver resend',
      );
    }
  }

  return env;
}

export function buildTestDbName(env: Env): string {
  return env.TEST_DB_NAME ?? `${env.DB_NAME}_test`;
}
