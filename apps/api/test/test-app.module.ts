import { Module } from '@nestjs/common';
import { APP_PIPE, APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TestDatabaseModule } from './test-database.module';
import { RedisModule, REDIS } from '../src/redis/redis.module';
import { HealthModule } from '../src/health/health.module';
import { LoggingModule } from '../src/common/logging/logger.module';
import { SettingsModule } from '../src/modules/settings/settings.module';
import { AppConfigModule } from '../src/config/app-config.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { MailModule } from '../src/modules/mail/mail.module';
import { PeopleModule } from '../src/modules/people/people.module';
import { UsersModule } from '../src/modules/users/users.module';
import { TestThrottlerController } from './test-throttler.controller';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ZodSerializerInterceptor } from 'nestjs-zod';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { MustChangePasswordGuard } from '../src/common/guards/must-change-password.guard';
import { OriginGuard } from '../src/common/guards/origin.guard';
import { AppThrottlerGuard } from '../src/common/guards/throttler.guard';
import { FailOpenRedisThrottlerStorage } from '../src/common/guards/fail-open-redis-throttler-storage';
import Redis from 'ioredis';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forRoot(),
    TestDatabaseModule.forRoot(),
    RedisModule.forRoot(),
    SettingsModule,
    HealthModule,
    AuthModule,
    MailModule,
    PeopleModule,
    UsersModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule.forRoot()],
      inject: [REDIS],
      useFactory: (redis: Redis) => ({
        throttlers: [
          { name: 'default', limit: 120, ttl: 60000 },
          { name: 'login', limit: 5, ttl: 900000, blockDuration: 900000 },
          { name: 'register', limit: 20, ttl: 3600000, blockDuration: 3600000 },
          { name: 'refresh', limit: 30, ttl: 60000 },
          { name: 'change-password', limit: 5, ttl: 900000, blockDuration: 900000 },
          { name: 'forgot', limit: 3, ttl: 3600000, blockDuration: 3600000 },
          { name: 'token-submit', limit: 10, ttl: 900000, blockDuration: 900000 },
          { name: 'resend', limit: 3, ttl: 3600000, blockDuration: 3600000 },
          { name: 'invite', limit: 20, ttl: 3600000 },
        ],
        storage: new FailOpenRedisThrottlerStorage(redis),
        errorMessage: 'Muitas requisições, tente novamente mais tarde',
      }),
    }),
  ],
  controllers: [TestThrottlerController],
  providers: [
    { provide: APP_PIPE, useFactory: () => new ZodValidationPipe() },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
  ],
  exports: [],
})
export class TestAppModule {}
