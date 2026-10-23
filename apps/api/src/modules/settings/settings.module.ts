import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SystemSettingsRepository } from './system-settings.repository';

@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SystemSettingsRepository, SettingsService],
  exports: [SystemSettingsRepository, SettingsService],
})
export class SettingsModule {}
