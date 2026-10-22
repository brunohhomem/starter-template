import { Module } from '@nestjs/common';
import { AppModule as BaseAppModule } from '../src/app.module';
import { TestDatabaseModule } from './test-database.module';
import { RedisModule } from '../src/redis/redis.module';
import { HealthModule } from '../src/health/health.module';
import { LoggingModule } from '../src/common/logging/logger.module';
import { SettingsModule } from '../src/modules/settings/settings.module';
import { AppConfigModule } from '../src/config/app-config.module';

/**
 * AppModule de teste que substitui o DatabaseModule pelo TestDatabaseModule.
 * Mantém todos os outros módulos iguais ao AppModule real.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forRoot(),
    TestDatabaseModule.forRoot(),
    RedisModule.forRoot(),
    SettingsModule,
    HealthModule,
  ],
  providers: [],
  exports: [],
})
export class TestAppModule {}
