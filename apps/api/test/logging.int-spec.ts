import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from './integration-setup';
import { redactPaths, REDACTED_FIELDS } from '../src/common/logging/logger-options';

describe('Logging', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('campos sensíveis são redigidos no log — password, token e cookie', () => {
    expect(redactPaths).toContain('req.headers.authorization');
    expect(redactPaths).toContain('req.headers.cookie');
    expect(redactPaths).toContain('res.headers["set-cookie"]');
    expect(redactPaths).toContain('req.body.password');
    expect(redactPaths).toContain('req.body.token');
    expect(redactPaths).toContain('req.body.refreshToken');
    expect(redactPaths).toContain('req.body.secret');
    expect(REDACTED_FIELDS).toBeDefined();
  });
});
