import { eq, and, desc, inArray, lt } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { sessions, type Session, type NewSession } from './session.entity';

@Injectable()
export class SessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string, tx?: DatabaseTransaction): Promise<Session | null> {
    const client = tx ?? this.db;
    const result = await client.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0] ?? null;
  }

  async create(data: NewSession, tx?: DatabaseTransaction): Promise<Session> {
    const client = tx ?? this.db;
    const result = await client.insert(sessions).values(data).returning();
    if (!result[0]) throw new Error('Failed to create session');
    return result[0];
  }

  async findByRefreshHash(
    refreshTokenHash: string,
    tx?: DatabaseTransaction,
  ): Promise<Session | null> {
    const client = tx ?? this.db;
    const result = await client
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, refreshTokenHash))
      .limit(1);
    return result[0] ?? null;
  }

  async revoke(id: string, replacedBySessionId?: string, tx?: DatabaseTransaction): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(sessions)
      .set({ revokedAt: new Date(), replacedBySessionId, updatedAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async revokeFamily(familyId: string, tx?: DatabaseTransaction): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.familyId, familyId));
  }

  async revokeAllByUserExcept(
    userId: string,
    exceptSessionId: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.isActive, true),
          eq(sessions.id, exceptSessionId),
        ),
      );
  }

  async revokeAllByUser(userId: string, tx?: DatabaseTransaction): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.userId, userId));
  }

  async deleteExpired(before: Date, tx?: DatabaseTransaction): Promise<number> {
    const client = tx ?? this.db;
    const result = await client.delete(sessions).where(lt(sessions.expiresAt, before));
    return result.rowCount ?? 0;
  }

  async revokeAndCreateNew(
    oldSessionId: string,
    newSessionId: string,
    userId: string,
    familyId: string,
    newRefreshTokenHash: string,
    expiresAt: Date,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), replacedBySessionId: newSessionId, updatedAt: new Date() })
      .where(eq(sessions.id, oldSessionId));

    await tx.insert(sessions).values({
      id: newSessionId,
      userId,
      familyId,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt,
    });
  }
}
