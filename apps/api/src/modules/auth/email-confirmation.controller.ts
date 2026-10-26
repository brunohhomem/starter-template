import { Controller, Post, Body, HttpCode, HttpStatus, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { EmailConfirmationService } from './email-confirmation.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { confirmEmailRequestSchema } from '@starter/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ERROR_SCHEMA } from './auth-swagger';

@ApiTags('auth')
@Controller('auth')
export class EmailConfirmationController {
  constructor(private readonly emailConfirmationService: EmailConfirmationService) {}

  @Post('email/confirm')
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
  @ApiOperation({ summary: 'Confirmar e-mail' })
  @ApiResponse({ status: 204, description: 'E-mail confirmado' })
  @ApiResponse({
    status: 400,
    description: 'Token inválido (AUTH_EMAIL_TOKEN_INVALID)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED)',
    schema: ERROR_SCHEMA,
  })
  async confirmEmail(
    @Body(new ZodValidationPipe(confirmEmailRequestSchema)) body: { token: string },
    @Ip() ip: string,
  ) {
    await this.emailConfirmationService.confirmEmail(body.token, ip);
  }

  @Post('email/resend')
  @SkipThrottle({
    default: true,
    login: true,
    register: true,
    refresh: true,
    ['change-password']: true,
    forgot: true,
    ['token-submit']: true,
    invite: true,
  })
  @Throttle({ resend: {} })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reenviar e-mail de confirmação' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 202, description: 'E-mail de confirmação reenviado' })
  @ApiResponse({ status: 401, description: 'Não autenticado', schema: ERROR_SCHEMA })
  @ApiResponse({
    status: 409,
    description: 'E-mail já confirmado (AUTH_EMAIL_ALREADY_CONFIRMED)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED)',
    schema: ERROR_SCHEMA,
  })
  async resendEmailConfirmation(@CurrentUser() user: { userId: string }) {
    await this.emailConfirmationService.resendEmailConfirmation(user.userId);
  }
}
