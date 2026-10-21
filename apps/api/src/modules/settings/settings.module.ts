import { Module } from '@nestjs/common';
import { SystemSettingsRepository } from './system-settings.repository';

@Module({
  providers: [SystemSettingsRepository],
  exports: [SystemSettingsRepository],
})
export class SettingsModule {}
