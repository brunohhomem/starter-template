import { eq, and, ne } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { people, type Person, type NewPerson } from './person.entity';
import { users } from '../auth/user.entity';

@Injectable()
export class PeopleRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(data: NewPerson, tx?: DatabaseTransaction): Promise<Person> {
    const client = tx ?? this.db;
    const result = await client.insert(people).values(data).returning();
    if (!result[0]) throw new Error('Failed to create person');
    return result[0];
  }

  async findByUserId(userId: string, tx?: DatabaseTransaction): Promise<Person | null> {
    const client = tx ?? this.db;
    const result = await client.select().from(people).where(eq(people.userId, userId)).limit(1);
    return result[0] ?? null;
  }

  async findByCpf(cpf: string, tx?: DatabaseTransaction): Promise<Person | null> {
    const client = tx ?? this.db;
    const result = await client.select().from(people).where(eq(people.cpf, cpf)).limit(1);
    return result[0] ?? null;
  }

  async findByCpfExcludingUser(
    cpf: string,
    userId: string,
    tx?: DatabaseTransaction,
  ): Promise<Person | null> {
    const client = tx ?? this.db;
    const result = await client
      .select()
      .from(people)
      .where(and(eq(people.cpf, cpf), ne(people.userId, userId)))
      .limit(1);
    return result[0] ?? null;
  }

  async update(
    userId: string,
    data: Partial<Pick<NewPerson, 'fullName' | 'cpf' | 'phone'>>,
    tx?: DatabaseTransaction,
  ): Promise<Person> {
    const client = tx ?? this.db;
    const result = await client
      .update(people)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(people.userId, userId))
      .returning();
    if (!result[0]) throw new Error('Person not found');
    return result[0];
  }

  async findProfileByUserId(userId: string): Promise<{
    email: string;
    role: 'admin' | 'user';
    emailVerifiedAt: Date | null;
    fullName: string | null;
    cpf: string | null;
    phone: string | null;
  } | null> {
    const result = await this.db
      .select({
        email: users.email,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        fullName: people.fullName,
        cpf: people.cpf,
        phone: people.phone,
      })
      .from(users)
      .leftJoin(people, eq(people.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    return result[0] ?? null;
  }
}
