import { eq, and, desc, count } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database, DatabaseTransaction } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { auditLogs, type AuditLog, type NewAuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(
    entry: {
      actorUserId?: string | null;
      action: string;
      targetType?: string | null;
      targetId?: string | null;
      metadata?: Record<string, unknown>;
      ip?: string | null;
    },
    tx?: DatabaseTransaction,
  ): Promise<AuditLog> {
    const client = tx ?? this.db;
    const data: NewAuditLog = {
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    };
    const result = await client.insert(auditLogs).values(data).returning();
    if (!result[0]) throw new Error('Failed to create audit log');
    return result[0];
  }

  async list(
    params: { page: number; pageSize: number; action?: string },
    tx?: DatabaseTransaction,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const client = tx ?? this.db;
    const { page, pageSize, action } = params;

    const whereConditions = action ? eq(auditLogs.action, action) : undefined;

    const items = await client
      .select()
      .from(auditLogs)
      .where(whereConditions)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalResult = await client
      .select({ count: count() })
      .from(auditLogs)
      .where(whereConditions);

    const total = totalResult[0]?.count ?? 0;

    return { items, total };
  }
}
