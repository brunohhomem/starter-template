import { Module } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditLogsRepository, AuditService],
  exports: [AuditLogsRepository, AuditService],
})
export class AuditModule {}
