import { Module, Inject } from '@nestjs/common';
import { APP_PIPE, APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from './config/env.schema';
import { AppConfigModule, ENV } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { LoggingModule } from './common/logging/logger.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { PeopleModule } from './modules/people/people.module';
import { UsersModule } from './modules/users/users.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ZodSerializerInterceptor } from 'nestjs-zod';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { OriginGuard } from './common/guards/origin.guard';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { FailOpenRedisThrottlerStorage } from './common/guards/fail-open-redis-throttler-storage';
import { REDIS } from './redis/redis.module';
import Redis from 'ioredis';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forRoot(),
    DatabaseModule,
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
          {
            name: 'default',
            limit: 120,
            ttl: 60000, // 60 seconds in ms
          },
          {
            name: 'login',
            limit: 5,
            ttl: 900000, // 15 minutes in ms
            blockDuration: 900000, // 15 minutes in ms
          },
          {
            name: 'register',
            limit: 20,
            ttl: 3600000, // 60 minutes in ms
            blockDuration: 3600000, // 60 minutes in ms
          },
          {
            name: 'refresh',
            limit: 30,
            ttl: 60000, // 60 seconds in ms
          },
          {
            name: 'change-password',
            limit: 5,
            ttl: 900000, // 15 minutes in ms
            blockDuration: 900000, // 15 minutes in ms
          },
          {
            name: 'forgot',
            limit: 3,
            ttl: 3600000, // 60 minutes in ms
            blockDuration: 3600000,
          },
          {
            name: 'token-submit',
            limit: 10,
            ttl: 900000, // 15 minutes in ms
            blockDuration: 900000,
          },
          {
            name: 'resend',
            limit: 3,
            ttl: 3600000, // 60 minutes in ms
            blockDuration: 3600000,
          },
          {
            name: 'invite',
            limit: 20,
            ttl: 3600000, // 60 minutes in ms
          },
        ],
        storage: new FailOpenRedisThrottlerStorage(redis),
        errorMessage: 'Muitas requisições, tente novamente mais tarde',
      }),
    }),
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    // JwtAuth antes do throttler para o tracker default usar o mesmo request.user,
    // sem verificar o access token uma segunda vez.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
  ],
  exports: [],
})
export class AppModule {
  constructor(@Inject(ENV) private readonly env: Readonly<Env>) {}
}
