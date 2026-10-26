import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema';
import { ENV } from '../../config/app-config.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { PasswordController } from './password.controller';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailConfirmationController } from './email-confirmation.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { UsersRepository } from './users.repository';
import { SessionsRepository } from './sessions.repository';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';
import { CookieService } from './cookie.service';
import { SettingsModule } from '../settings/settings.module';
import { EmailTokensModule } from '../email-tokens/email-tokens.module';
import { AuditModule } from '../audit/audit.module';
import { PeopleModule } from '../people/people.module';

@Module({
  imports: [SettingsModule, EmailTokensModule, AuditModule, PeopleModule, JwtModule.register({})],
  controllers: [
    AuthController,
    PasswordController,
    EmailConfirmationController,
    InvitationsController,
  ],
  providers: [
    AuthService,
    PasswordService,
    EmailConfirmationService,
    InvitationsService,
    UsersRepository,
    SessionsRepository,
    {
      provide: PasswordHasher,
      useFactory: (env: Env) => new PasswordHasher(env.AUTH_BCRYPT_ROUNDS),
      inject: [ENV],
    },
    {
      provide: TokenService,
      useFactory: (env: Env) =>
        new TokenService(
          env.JWT_ACCESS_SECRET,
          env.AUTH_ACCESS_TTL_MINUTES,
          env.AUTH_REFRESH_TTL_DAYS,
          env.AUTH_REFRESH_REUSE_GRACE_SECONDS,
        ),
      inject: [ENV],
    },
    {
      provide: CookieService,
      useFactory: (env: Env) =>
        new CookieService({
          secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
          accessTtlMinutes: env.AUTH_ACCESS_TTL_MINUTES,
          refreshTtlDays: env.AUTH_REFRESH_TTL_DAYS,
        }),
      inject: [ENV],
    },
  ],
  exports: [AuthService, UsersRepository, SessionsRepository, TokenService],
})
export class AuthModule {}
