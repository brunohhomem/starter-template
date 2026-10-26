import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  setupTestDatabase,
  teardownTestDatabase,
  getTestDb,
  getTestPool,
} from './integration-setup';

describe('Database integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    const db = getTestDb();
    const pool = db.$client;
    const tablesResult = await pool.query<{ tablename: string }>(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    const tables = tablesResult.rows
      .map((row) => row.tablename)
      .filter((name) => !name.startsWith('_') && name !== 'drizzle_migrations');

    if (tables.length > 0) {
      const tableNames = tables.map((tableName) => `"${tableName}"`).join(', ');
      await db.execute(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
    }
  });

  it('trava truncate — TRUNCATE RESTART IDENTITY CASCADE isola dados entre testes', async () => {
    const db = getTestDb();

    await db.execute(sql`
      INSERT INTO system_settings (key, value)
      VALUES ('trava_truncate_test', '{"ok": true}')
    `);

    const countAfterInsert = await db.execute(sql`
      SELECT count(*) as n FROM system_settings WHERE key = 'trava_truncate_test'
    `);
    expect(Number(countAfterInsert.rows[0].n)).toBe(1);

    const pool = getTestPool();
    await pool.query('TRUNCATE TABLE "system_settings" RESTART IDENTITY CASCADE');

    const countAfterTruncate = await db.execute(sql`
      SELECT count(*) as n FROM system_settings WHERE key = 'trava_truncate_test'
    `);
    expect(Number(countAfterTruncate.rows[0].n)).toBe(0);
  });
});
