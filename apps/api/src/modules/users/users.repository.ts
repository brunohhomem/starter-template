import { eq, ilike, or, and, isNull, asc, count } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { users } from '../auth/user.entity';
import { sessions } from '../auth/session.entity';
import { people } from '../people/person.entity';

export type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: 'admin' | 'user';
  isActive: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
};

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<{ total: number; items: UserRow[] }> {
    const whereCondition = search
      ? or(ilike(users.email, `%${search}%`), ilike(people.fullName, `%${search}%`))
      : undefined;

    const [totalResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(users)
        .leftJoin(people, eq(people.userId, users.id))
        .where(whereCondition),
      this.db
        .select({
          id: users.id,
          email: users.email,
          fullName: people.fullName,
          role: users.role,
          isActive: users.isActive,
          emailVerifiedAt: users.emailVerifiedAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .leftJoin(people, eq(people.userId, users.id))
        .where(whereCondition)
        .orderBy(asc(people.fullName))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return { total: Number(totalResult[0]?.count ?? 0), items };
  }

  async findById(userId: string): Promise<{ id: string; role: 'admin' | 'user' } | null> {
    const result = await this.db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return result[0] ?? null;
  }

  async updateRole(userId: string, role: 'admin' | 'user'): Promise<string> {
    const current = await this.findById(userId);
    const oldRole = current?.role ?? 'user';
    await this.db.update(users).set({ role }).where(eq(users.id, userId));
    return oldRole;
  }

  async updateStatus(userId: string, isActive: boolean): Promise<void> {
    await this.db.update(users).set({ isActive }).where(eq(users.id, userId));
  }

  async revokeSessions(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}
