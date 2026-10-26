import type { INestApplication } from '@nestjs/common';
import type { MemoryTransport } from '../../src/modules/mail/transports/memory.transport';
import request from 'supertest';
import { getTestPool } from '../integration-setup';

type UserRole = 'user' | 'admin';

type CreateUserOpts = {
  email: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
};

type UserCredentials = {
  email: string;
  password: string;
};

type LoginResult = {
  accessCookie: string;
  refreshCookie: string;
  userId: string;
};

type SentEmail = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export function makeScenario(app: INestApplication, transport?: MemoryTransport) {
  async function createUser(opts: CreateUserOpts): Promise<UserCredentials> {
    const password = opts.password ?? 'SenhaForte123';
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: opts.email, password })
      .expect(201);

    const pool = getTestPool();

    if (opts.role === 'admin') {
      await pool.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [opts.email]);
    }

    if (opts.isActive === false) {
      await pool.query(`UPDATE users SET is_active = false WHERE email = $1`, [opts.email]);
    }

    return { email: opts.email, password };
  }

  async function loginAs(user: UserCredentials): Promise<LoginResult> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    const cookies = res.headers['set-cookie'] as string[];
    const accessCookie = cookies
      .find((cookie) => cookie.startsWith('access_token='))!
      .split(';')[0];
    const refreshCookie = cookies
      .find((cookie) => cookie.startsWith('refresh_token='))!
      .split(';')[0];

    return { accessCookie, refreshCookie, userId: res.body.user.id as string };
  }

  async function lastEmailTo(email: string, maxWaitMs = 3000): Promise<SentEmail | undefined> {
    if (!transport) throw new Error('transport not provided to makeScenario');
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const found = transport.sent.filter((msg) => msg.to === email).at(-1);
      if (found) return found as SentEmail;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return undefined;
  }

  function extractLinkToken(email: SentEmail, param = 'token'): string {
    const text = email.text ?? email.html ?? '';
    const match = new RegExp(`[?&]${param}=([^&\\s"'<]+)`).exec(text);
    if (!match) throw new Error(`param '${param}' not found in email`);
    return match[1];
  }

  return { createUser, loginAs, lastEmailTo, extractLinkToken };
}
