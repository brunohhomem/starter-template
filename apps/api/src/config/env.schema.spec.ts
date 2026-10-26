import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.schema';

const validRawEnv: Record<string, string | undefined> = {
  NODE_ENV: 'development',
  API_PORT: '3001',
  APP_ORIGIN: 'http://localhost:3000',
  TRUST_PROXY_HOPS: '0',
  LOG_LEVEL: 'info',
  SWAGGER_ENABLED: 'true',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'app',
  DB_PASSWORD: 'validpassword12345678901234567890',
  DB_NAME: 'app',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'validredispass12345678901234567890',
  JWT_ACCESS_SECRET: 'validaccesssecret12345678901234567890123456789012345678901234',
  JWT_REFRESH_SECRET: 'validrefreshsecret12345678901234567890123456789012345678901234',
  COOKIE_SECRET: 'validcookiesecret123456789012345678901234567890123456789012345678',
  ENCRYPTION_KEY: 'ZGV2ZW5jcnlwdGlvbmtleTEyMzQ1Njc4OTAxMjM0NQ==',
  BACKUP_ENCRYPTION_KEY: 'h7SHRT35wbCIUtIQXapP/n4B/Rga8hsnU3+00wUm3pI=',
  ADMIN_EMAIL: 'admin@example.com',
  WEB_ORIGIN: 'http://localhost:3000',
  AUTH_ACCESS_TTL_MINUTES: '15',
  AUTH_REFRESH_TTL_DAYS: '7',
  AUTH_REFRESH_REUSE_GRACE_SECONDS: '10',
  AUTH_BCRYPT_ROUNDS: '12',
  MAIL_DRIVER: 'smtp',
  MAIL_FROM: 'Starter <no-reply@localhost>',
  APP_NAME: 'Starter Template',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  RESEND_API_KEY: '',
  EMAIL_CONFIRM_TTL_HOURS: '24',
  PASSWORD_RESET_TTL_MINUTES: '30',
  INVITE_TTL_DAYS: '7',
};

describe('env.schema', () => {
  it('env ausente impede a subida e lista as chaves', () => {
    expect(() => validateEnv({})).toThrow(/Variáveis de ambiente inválidas ou ausentes/);
    expect(() => validateEnv({})).toThrow(/API_PORT/);
    expect(() => validateEnv({})).toThrow(/APP_ORIGIN/);
    expect(() => validateEnv({})).toThrow(/DB_HOST/);
  });

  it('produção exige Resend', () => {
    const prodRawEnv = {
      ...validRawEnv,
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: '1',
      MAIL_DRIVER: 'resend',
      RESEND_API_KEY: 'test-key',
    };
    const env = validateEnv(prodRawEnv);
    expect(env.NODE_ENV).toBe('production');
    expect(env.COOKIE_SECURE).toBe(true);
  });
});
