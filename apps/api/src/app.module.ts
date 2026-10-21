import { Module, Inject } from '@nestjs/common';
import type { Env } from './config/env.schema';
import { AppConfigModule, ENV } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { LoggingModule } from './common/logging/logger.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [AppConfigModule, LoggingModule.forRoot(), DatabaseModule, SettingsModule],
  providers: [],
  exports: [],
})
export class AppModule {
  constructor(@Inject(ENV) private readonly env: Readonly<Env>) {}
}
