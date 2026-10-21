import { Module, Inject } from '@nestjs/common';
import type { Env } from './config/env.schema';
import { AppConfigModule, ENV } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { LoggingModule } from './common/logging/logger.module';

@Module({
  imports: [AppConfigModule, LoggingModule.forRoot(), DatabaseModule],
  providers: [],
  exports: [],
})
export class AppModule {
  constructor(@Inject(ENV) private readonly env: Readonly<Env>) {}
}
