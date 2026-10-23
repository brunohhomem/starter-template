import { Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '../../database/database.module';
import { AuditLogsRepository } from './audit-logs.repository';

const ALLOWED_METADATA_KEYS: ReadonlySet<string> = new Set(['from', 'to', 'role', 'email']);

@Injectable()
export class AuditService {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async record(
    entry: {
      actorUserId?: string | null;
      action: string;
      targetType?: string | null;
      targetId?: string | null;
      metadata?: Record<string, unknown>;
      ip?: string | null;
    },
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const metadata: Record<string, unknown> = {};
    if (entry.metadata) {
      for (const key of ALLOWED_METADATA_KEYS) {
        if (Object.prototype.hasOwnProperty.call(entry.metadata, key)) {
          metadata[key] = entry.metadata[key];
        }
      }
    }
    await this.auditLogsRepository.create({ ...entry, metadata }, tx);
  }
}
