import { Module, Inject } from '@nestjs/common';
import { APP_PIPE, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { Env } from './config/env.schema';
import { AppConfigModule, ENV } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { LoggingModule } from './common/logging/logger.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ZodSerializerInterceptor } from 'nestjs-zod';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forRoot(),
    DatabaseModule,
    RedisModule.forRoot(),
    SettingsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
  exports: [],
})
export class AppModule {
  constructor(@Inject(ENV) private readonly env: Readonly<Env>) {}
}
