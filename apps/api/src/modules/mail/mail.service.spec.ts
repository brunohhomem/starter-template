import { SmtpTransport } from './transports/smtp.transport';
import { ResendTransport } from './transports/resend.transport';
import { MemoryTransport } from './transports/memory.transport';
import { MailService } from './mail.service';
import { UnrecoverableMailError } from './mail.errors';
import type { MailMessage } from './mail.types';
import type { Env } from '../../config/env.schema';

const createEnv = (overrides: Partial<Env> = {}): Env => ({
  NODE_ENV: 'development',
  MAIL_DRIVER: 'smtp',
  MAIL_FROM: 'Starter <no-reply@localhost>',
  APP_NAME: 'Starter Template',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  RESEND_API_KEY: '',
  EMAIL_CONFIRM_TTL_HOURS: 24,
  PASSWORD_RESET_TTL_MINUTES: 30,
  INVITE_TTL_DAYS: 7,
  API_PORT: 3001,
  APP_ORIGIN: 'http://localhost:3000',
  TRUST_PROXY_HOPS: 0,
  LOG_LEVEL: 'info',
  SWAGGER_ENABLED: false,
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'app',
  DB_PASSWORD: 'password',
  DB_NAME: 'app',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  JWT_ACCESS_SECRET: 'a'.repeat(44),
  JWT_REFRESH_SECRET: 'b'.repeat(44),
  COOKIE_SECRET: 'c'.repeat(44),
  ENCRYPTION_KEY: 'd'.repeat(44),
  BACKUP_ENCRYPTION_KEY: 'e'.repeat(44),
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_INITIAL_PASSWORD: undefined,
  WEB_ORIGIN: 'http://localhost:3000',
  COOKIE_SECURE: false,
  AUTH_ACCESS_TTL_MINUTES: 15,
  AUTH_REFRESH_TTL_DAYS: 7,
  AUTH_REFRESH_REUSE_GRACE_SECONDS: 10,
  AUTH_BCRYPT_ROUNDS: 12,
  ...overrides,
});

describe('MailTransport selection', () => {
  it('selects SmtpTransport when MAIL_DRIVER=smtp', () => {
    const env = createEnv({ MAIL_DRIVER: 'smtp' });
    const smtpTransport = new SmtpTransport(env);
    const resendTransport = new ResendTransport(env);
    const memoryTransport = new MemoryTransport();
    const service = new MailService(env, smtpTransport, resendTransport, memoryTransport);
    expect(service.getTransport()).toBe(smtpTransport);
  });

  it('selects ResendTransport when MAIL_DRIVER=resend', () => {
    const env = createEnv({ MAIL_DRIVER: 'resend', RESEND_API_KEY: 'test-key' });
    const smtpTransport = new SmtpTransport(env);
    const resendTransport = new ResendTransport(env);
    const memoryTransport = new MemoryTransport();
    const service = new MailService(env, smtpTransport, resendTransport, memoryTransport);
    expect(service.getTransport()).toBe(resendTransport);
  });

  it('selects MemoryTransport when MAIL_DRIVER=memory', () => {
    const env = createEnv({ NODE_ENV: 'test', MAIL_DRIVER: 'memory' });
    const smtpTransport = new SmtpTransport(env);
    const resendTransport = new ResendTransport(env);
    const memoryTransport = new MemoryTransport();
    const service = new MailService(env, smtpTransport, resendTransport, memoryTransport);
    expect(service.getTransport()).toBe(memoryTransport);
  });

  it('throws when memory driver used outside test environment', () => {
    const env = createEnv({ NODE_ENV: 'development', MAIL_DRIVER: 'memory' });
    const smtpTransport = new SmtpTransport(env);
    const resendTransport = new ResendTransport(env);
    const memoryTransport = new MemoryTransport();
    expect(() => new MailService(env, smtpTransport, resendTransport, memoryTransport)).toThrow(
      'MAIL_DRIVER: memory driver só permitido em NODE_ENV=test',
    );
  });

  it('throws in production when MAIL_DRIVER is not resend', () => {
    const env = createEnv({ NODE_ENV: 'production', MAIL_DRIVER: 'smtp' });
    const smtpTransport = new SmtpTransport(env);
    const resendTransport = new ResendTransport(env);
    const memoryTransport = new MemoryTransport();
    expect(() => new MailService(env, smtpTransport, resendTransport, memoryTransport)).toThrow(
      'MAIL_DRIVER: deve ser "resend" em produção',
    );
  });

  it('throws in production when RESEND_API_KEY is missing', () => {
    const env = createEnv({ NODE_ENV: 'production', MAIL_DRIVER: 'resend', RESEND_API_KEY: '' });
    const smtpTransport = new SmtpTransport(env);
    const resendTransport = new ResendTransport(env);
    const memoryTransport = new MemoryTransport();
    expect(() => new MailService(env, smtpTransport, resendTransport, memoryTransport)).toThrow(
      'RESEND_API_KEY: obrigatório em produção com driver resend',
    );
  });

  it('throws in production when RESEND_API_KEY is whitespace', () => {
    const env = createEnv({ NODE_ENV: 'production', MAIL_DRIVER: 'resend', RESEND_API_KEY: '   ' });
    const smtpTransport = new SmtpTransport(env);
    const resendTransport = new ResendTransport(env);
    const memoryTransport = new MemoryTransport();
    expect(() => new MailService(env, smtpTransport, resendTransport, memoryTransport)).toThrow(
      'RESEND_API_KEY: obrigatório em produção com driver resend',
    );
  });
});

describe('MemoryTransport', () => {
  it('accumulates messages in sent array', async () => {
    const transport = new MemoryTransport();
    const message: MailMessage = {
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Hello',
    };

    await transport.send(message);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]!).toMatchObject(message);
    expect(transport.sent[0]!.sentAt).toBeInstanceOf(Date);
  });

  it('clears sent array with clear()', async () => {
    const transport = new MemoryTransport();
    const message: MailMessage = {
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Hello',
    };

    await transport.send(message);
    expect(transport.sent).toHaveLength(1);

    transport.clear();
    expect(transport.sent).toHaveLength(0);
  });
});

describe('ResendTransport', () => {
  const mockSend = jest.fn();
  const mockResend = {
    emails: {
      send: mockSend,
    },
  };

  beforeEach(() => {
    mockSend.mockReset();
  });

  const baseEnv = (): Env =>
    createEnv({ NODE_ENV: 'production', MAIL_DRIVER: 'resend', RESEND_API_KEY: 'test-key' });

  it('sends email successfully', async () => {
    mockSend.mockResolvedValue({ data: { id: 'test-id' }, error: null });

    const env = baseEnv();
    const transport = new ResendTransport(env);
    (transport as unknown as { _client: typeof mockResend })._client = mockResend;

    const message: MailMessage = {
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Hello',
    };

    await transport.send(message);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        text: 'Hello',
      }),
    );
  });

  it('throws UnrecoverableMailError on 4xx error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email', statusCode: 400 },
    });

    const env = baseEnv();
    const transport = new ResendTransport(env);
    (transport as unknown as { _client: typeof mockResend })._client = mockResend;

    const message: MailMessage = {
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Hello',
    };

    await expect(transport.send(message)).rejects.toThrow(UnrecoverableMailError);
    await expect(transport.send(message)).rejects.toThrow('Resend error: Invalid email');
  });

  it('throws generic Error on 5xx error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Internal server error', statusCode: 500 },
    });

    const env = baseEnv();
    const transport = new ResendTransport(env);
    (transport as unknown as { _client: typeof mockResend })._client = mockResend;

    const message: MailMessage = {
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Hello',
    };

    await expect(transport.send(message)).rejects.toThrow(Error);
    await expect(transport.send(message)).rejects.toThrow('Resend error: Internal server error');
  });

  it('UnrecoverableMailError has unrecoverable property', () => {
    const error = new UnrecoverableMailError('Test error');
    expect(error.unrecoverable).toBe(true);
    expect(error.name).toBe('UnrecoverableMailError');
  });
});
