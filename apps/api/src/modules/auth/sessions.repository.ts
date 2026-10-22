import { eq, and, desc, inArray, lt } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { sessions, type Session, type NewSession } from './session.entity';

@Injectable()
export class SessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(data: NewSession): Promise<Session> {
    const result = await this.db.insert(sessions).values(data).returning();
    if (!result[0]) throw new Error('Failed to create session');
    return result[0];
  }

  async findByRefreshHash(refreshTokenHash: string): Promise<Session | null> {
    const result = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, refreshTokenHash))
      .limit(1);
    return result[0] ?? null;
  }

  async revoke(id: string, replacedBySessionId?: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), replacedBySessionId, updatedAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.familyId, familyId));
  }

  async revokeAllByUserExcept(userId: string, exceptSessionId: string): Promise<void> {
    await this.db
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

  async revokeAllByUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.userId, userId));
  }

  async deleteExpired(before: Date): Promise<number> {
    const result = await this.db.delete(sessions).where(lt(sessions.expiresAt, before));
    return result.rowCount ?? 0;
  }
}
