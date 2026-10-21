import { eq } from 'drizzle-orm';
import { Injectable, Inject } from '@nestjs/common';
import type { Database } from '../database.module';
import { DRIZZLE } from '../database.module';
import * as schema from '../schema';

export type UserRepository = ReturnType<typeof createUserRepository>;
export type SessionRepository = ReturnType<typeof createSessionRepository>;

export function createUserRepository(db: Database) {
  return {
    async findById(id: string): Promise<schema.User | null> {
      const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
      return result[0] ?? null;
    },

    async findByEmail(email: string): Promise<schema.User | null> {
      const result = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      return result[0] ?? null;
    },

    async findAll(): Promise<schema.User[]> {
      return db.select().from(schema.users);
    },

    async create(data: schema.NewUser): Promise<schema.User> {
      const result = await db.insert(schema.users).values(data).returning();
      if (!result[0]) throw new Error('Failed to create user');
      return result[0];
    },

    async update(id: string, data: Partial<schema.NewUser>): Promise<schema.User | null> {
      const result = await db
        .update(schema.users)
        .set(data)
        .where(eq(schema.users.id, id))
        .returning();
      return result[0] ?? null;
    },

    async delete(id: string): Promise<boolean> {
      const result = await db
        .delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning({ id: schema.users.id });
      return result.length > 0;
    },
  };
}

export function createSessionRepository(db: Database) {
  return {
    async findById(id: string): Promise<schema.Session | null> {
      const result = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async findByRefreshTokenHash(hash: string): Promise<schema.Session | null> {
      const result = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.refreshTokenHash, hash))
        .limit(1);
      return result[0] ?? null;
    },

    async findByUserId(userId: string): Promise<schema.Session[]> {
      return db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId));
    },

    async create(data: schema.NewSession): Promise<schema.Session> {
      const result = await db.insert(schema.sessions).values(data).returning();
      if (!result[0]) throw new Error('Failed to create session');
      return result[0];
    },

    async update(id: string, data: Partial<schema.NewSession>): Promise<schema.Session | null> {
      const result = await db
        .update(schema.sessions)
        .set(data)
        .where(eq(schema.sessions.id, id))
        .returning();
      return result[0] ?? null;
    },

    async delete(id: string): Promise<boolean> {
      const result = await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, id))
        .returning({ id: schema.sessions.id });
      return result.length > 0;
    },

    async deleteByUserId(userId: string): Promise<number> {
      const result = await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.userId, userId))
        .returning({ id: schema.sessions.id });
      return result.length;
    },

    async deleteExpired(): Promise<number> {
      const now = new Date();
      const result = await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.expiresAt, now))
        .returning({ id: schema.sessions.id });
      return result.length;
    },
  };
}

@Injectable()
export class RepositoryProvider {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;

  constructor(@Inject(DRIZZLE) db: Database) {
    this.users = createUserRepository(db);
    this.sessions = createSessionRepository(db);
  }
}
