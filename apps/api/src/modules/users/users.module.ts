import { Module } from '@nestjs/common';
import { UsersAdminService } from './users-admin.service';
import { UsersAdminController } from './users-admin.controller';
import { UsersRepository } from './users.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [UsersAdminController],
  providers: [UsersAdminService, UsersRepository],
})
export class UsersModule {}
