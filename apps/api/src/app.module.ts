import { Module, Inject } from '@nestjs/common';
import { AppConfigModule, ENV } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [],
  exports: [],
})
export class AppModule {
  constructor(
    @Inject(ENV)
    private readonly env: Readonly<ReturnType<typeof import('./config/load-env').getEnv>>,
  ) {}
}
