import { eq, and, desc, lt } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { users, type User, type NewUser } from './user.entity';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string, tx?: DatabaseTransaction): Promise<User | null> {
    const client = tx ?? this.db;
    const result = await client.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByEmail(email: string, tx?: DatabaseTransaction): Promise<User | null> {
    const client = tx ?? this.db;
    const result = await client.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] ?? null;
  }

  async create(data: NewUser, tx?: DatabaseTransaction): Promise<User> {
    const client = tx ?? this.db;
    const result = await client.insert(users).values(data).returning();
    if (!result[0]) throw new Error('Failed to create user');
    return result[0];
  }

  async updatePasswordHash(
    id: string,
    passwordHash: string,
    mustChangePassword: boolean,
    tx?: DatabaseTransaction,
  ): Promise<User> {
    const client = tx ?? this.db;
    const result = await client
      .update(users)
      .set({ passwordHash, mustChangePassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) throw new Error('Failed to update password hash');
    return result[0];
  }

  async touchLastLogin(id: string, tx?: DatabaseTransaction): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async verifyEmail(id: string, tx?: DatabaseTransaction): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async activateFromInvite(
    id: string,
    passwordHash: string,
    tx?: DatabaseTransaction,
  ): Promise<User> {
    const client = tx ?? this.db;
    const result = await client
      .update(users)
      .set({
        passwordHash,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) throw new Error('Failed to activate invited user');
    return result[0];
  }
}
