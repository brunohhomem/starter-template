import { eq, and, desc, lt } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { users, type User, type NewUser } from './user.entity';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] ?? null;
  }

  async create(data: NewUser): Promise<User> {
    const result = await this.db.insert(users).values(data).returning();
    if (!result[0]) throw new Error('Failed to create user');
    return result[0];
  }

  async updatePasswordHash(
    id: string,
    passwordHash: string,
    mustChangePassword: boolean,
  ): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ passwordHash, mustChangePassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) throw new Error('Failed to update password hash');
    return result[0];
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}
