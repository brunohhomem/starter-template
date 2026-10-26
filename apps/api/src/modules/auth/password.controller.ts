import { Controller, Post, Body, Res, HttpCode, HttpStatus, Ip } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { PasswordService } from './password.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { changePasswordRequestSchema } from '@starter/shared/auth';
import { forgotPasswordRequestSchema, resetPasswordRequestSchema } from '@starter/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ERROR_SCHEMA, AUTH_RESPONSE_SCHEMA } from './auth-swagger';

@ApiTags('auth')
@Controller('auth')
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Post('change-password')
  @SkipThrottle({
    default: true,
    login: true,
    register: true,
    refresh: true,
    forgot: true,
    ['token-submit']: true,
    resend: true,
    invite: true,
  })
  @Throttle({ ['change-password']: {} })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trocar senha (revoga outras sessões)' })
  @ApiCookieAuth('access_token')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Senha alterada. Outras sessões revogadas. Novos cookies setados.',
    schema: AUTH_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado (AUTH_UNAUTHORIZED)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 403,
    description: 'Senha deve ser trocada (AUTH_MUST_CHANGE_PASSWORD)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 422,
    description:
      'Senha atual errada (AUTH_CURRENT_PASSWORD_WRONG) ou nova igual à atual (AUTH_PASSWORD_UNCHANGED)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED)',
    schema: ERROR_SCHEMA,
  })
  async changePassword(
    @CurrentUser()
    user: { userId: string; role: string; sessionId: string; mustChangePassword: boolean },
    @Body(new ZodValidationPipe(changePasswordRequestSchema))
    body: { currentPassword: string; newPassword: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.passwordService.changePassword(
      user.userId,
      body.currentPassword,
      body.newPassword,
      res,
    );
  }

  @Post('password/forgot')
  @Public()
  @SkipThrottle({
    default: true,
    login: true,
    register: true,
    refresh: true,
    ['change-password']: true,
    ['token-submit']: true,
    resend: true,
    invite: true,
  })
  @Throttle({ forgot: {} })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar recuperação de senha' })
  @ApiResponse({ status: 202, description: 'Sempre 202 — anti-enumeração' })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED)',
    schema: ERROR_SCHEMA,
  })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema)) body: { email: string },
    @Ip() ip: string,
  ) {
    return this.passwordService.forgotPassword(body.email, ip);
  }

  @Post('password/reset')
  @Public()
  @SkipThrottle({
    default: true,
    login: true,
    register: true,
    refresh: true,
    ['change-password']: true,
    forgot: true,
    resend: true,
    invite: true,
  })
  @Throttle({ ['token-submit']: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Redefinir senha' })
  @ApiResponse({ status: 204, description: 'Senha redefinida' })
  @ApiResponse({ status: 400, description: 'Token inválido ou senha fraca', schema: ERROR_SCHEMA })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED)',
    schema: ERROR_SCHEMA,
  })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema))
    body: { token: string; newPassword: string },
    @Ip() ip: string,
  ) {
    await this.passwordService.resetPassword(body.token, body.newPassword, ip);
  }
}
