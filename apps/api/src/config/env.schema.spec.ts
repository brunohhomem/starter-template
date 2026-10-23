import { validateEnv, buildTestDbName, type Env } from './env.schema';

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

const validParsedEnv: Env = {
  NODE_ENV: 'development',
  API_PORT: 3001,
  APP_ORIGIN: 'http://localhost:3000',
  TRUST_PROXY_HOPS: 0,
  LOG_LEVEL: 'info',
  SWAGGER_ENABLED: true,
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'app',
  DB_PASSWORD: 'validpassword12345678901234567890',
  DB_NAME: 'app',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: 'validredispass12345678901234567890',
  JWT_ACCESS_SECRET: 'validaccesssecret12345678901234567890123456789012345678901234',
  JWT_REFRESH_SECRET: 'validrefreshsecret12345678901234567890123456789012345678901234',
  COOKIE_SECRET: 'validcookiesecret123456789012345678901234567890123456789012345678',
  ENCRYPTION_KEY: 'ZGV2ZW5jcnlwdGlvbmtleTEyMzQ1Njc4OTAxMjM0NQ==',
  BACKUP_ENCRYPTION_KEY: 'h7SHRT35wbCIUtIQXapP/n4B/Rga8hsnU3+00wUm3pI=',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_INITIAL_PASSWORD: undefined,
  WEB_ORIGIN: 'http://localhost:3000',
  COOKIE_SECURE: false,
  AUTH_ACCESS_TTL_MINUTES: 15,
  AUTH_REFRESH_TTL_DAYS: 7,
  AUTH_REFRESH_REUSE_GRACE_SECONDS: 10,
  AUTH_BCRYPT_ROUNDS: 12,
  MAIL_DRIVER: 'smtp',
  MAIL_FROM: 'Starter <no-reply@localhost>',
  APP_NAME: 'Starter Template',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  RESEND_API_KEY: '',
  EMAIL_CONFIRM_TTL_HOURS: 24,
  PASSWORD_RESET_TTL_MINUTES: 30,
  INVITE_TTL_DAYS: 7,
};

describe('env.schema', () => {
  it('valida ambiente válido', () => {
    const env = validateEnv(validRawEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3001);
    expect(env.APP_ORIGIN).toBe('http://localhost:3000');
  });

  it('falha com todas as chaves ausentes listadas', () => {
    expect(() => validateEnv({})).toThrow(/Variáveis de ambiente inválidas ou ausentes/);
    expect(() => validateEnv({})).toThrow(/API_PORT/);
    expect(() => validateEnv({})).toThrow(/APP_ORIGIN/);
    expect(() => validateEnv({})).toThrow(/DB_HOST/);
  });

  it('falha com valores inválidos', () => {
    const invalid = { ...validRawEnv, API_PORT: 'invalid' };
    expect(() => validateEnv(invalid)).toThrow(/API_PORT/);
  });

  it('não expõe valores na mensagem de erro', () => {
    const invalid = { ...validRawEnv, DB_PASSWORD: 'short' };
    try {
      validateEnv(invalid);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('short');
      expect(message).not.toContain('validpassword');
    }
  });

  it('buildTestDbName usa TEST_DB_NAME se presente', () => {
    const env: Env = { ...validParsedEnv, TEST_DB_NAME: 'custom_test' };
    expect(buildTestDbName(env)).toBe('custom_test');
  });

  it('buildTestDbName usa DB_NAME_test como padrão', () => {
    expect(buildTestDbName(validParsedEnv)).toBe('app_test');
  });

  it('exige TRUST_PROXY_HOPS em produção', () => {
    const prodRawEnv = {
      ...validRawEnv,
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: '1',
      MAIL_DRIVER: 'resend',
      RESEND_API_KEY: 'test-key',
    };
    const env = validateEnv(prodRawEnv);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('COOKIE_SECURE default false em development', () => {
    const env = validateEnv(validRawEnv);
    expect(env.COOKIE_SECURE).toBe(false);
  });
});
