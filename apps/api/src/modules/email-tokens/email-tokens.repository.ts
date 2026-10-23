import { eq, and, isNull, gt, lt } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { emailTokens, type EmailToken, type NewEmailToken } from './email-token.entity';

@Injectable()
export class EmailTokensRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(
    userId: string,
    type: 'email_confirmation' | 'password_reset' | 'invite',
    tokenHash: string,
    expiresAt: Date,
    tx?: DatabaseTransaction,
  ): Promise<EmailToken> {
    const client = tx ?? this.db;
    const data: NewEmailToken = {
      userId,
      type,
      tokenHash,
      expiresAt,
    };
    const result = await client.insert(emailTokens).values(data).returning();
    if (!result[0]) throw new Error('Failed to create email token');
    return result[0];
  }

  async consume(
    tokenHash: string,
    type: 'email_confirmation' | 'password_reset' | 'invite',
    tx?: DatabaseTransaction,
  ): Promise<EmailToken | null> {
    const client = tx ?? this.db;
    const now = new Date();
    const result = await client
      .update(emailTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(
        and(
          eq(emailTokens.tokenHash, tokenHash),
          eq(emailTokens.type, type),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, now),
        ),
      )
      .returning();
    return result[0] ?? null;
  }

  async invalidateByUserAndType(
    userId: string,
    type: 'email_confirmation' | 'password_reset' | 'invite',
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const client = tx ?? this.db;
    const now = new Date();
    await client
      .update(emailTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(
        and(eq(emailTokens.userId, userId), eq(emailTokens.type, type), isNull(emailTokens.usedAt)),
      );
  }

  async deleteExpiredBefore(date: Date, tx?: DatabaseTransaction): Promise<number> {
    const client = tx ?? this.db;
    const result = await client.delete(emailTokens).where(lt(emailTokens.expiresAt, date));
    return result.rowCount ?? 0;
  }
}
