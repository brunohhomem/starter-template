import { Controller, Post, Body, Res, HttpCode, HttpStatus, Ip } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { createInvitationRequestSchema, acceptInvitationRequestSchema } from '@starter/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ERROR_SCHEMA, AUTH_RESPONSE_SCHEMA } from './auth-swagger';

@ApiTags('auth')
@Controller('auth')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('invitations')
  @Roles('admin')
  @SkipThrottle({
    default: true,
    login: true,
    register: true,
    refresh: true,
    ['change-password']: true,
    forgot: true,
    ['token-submit']: true,
    resend: true,
  })
  @Throttle({ invite: {} })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convidar usuário (admin)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Convite enviado' })
  @ApiResponse({ status: 401, description: 'Não autenticado', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 403, description: 'Sem permissão', schema: ERROR_SCHEMA })
  @ApiResponse({
    status: 409,
    description: 'E-mail já possui conta ativa (AUTH_INVITE_EMAIL_TAKEN)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED)',
    schema: ERROR_SCHEMA,
  })
  async inviteUser(
    @Body(new ZodValidationPipe(createInvitationRequestSchema))
    body: { email: string; role: 'admin' | 'user' },
    @CurrentUser() currentUser: { userId: string },
    @Ip() ip: string,
  ) {
    return this.invitationsService.inviteUser(currentUser.userId, body.email, body.role, ip);
  }

  @Post('invitations/accept')
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceitar convite' })
  @ApiResponse({
    status: 200,
    description: 'Convite aceito. Cookies setados.',
    schema: AUTH_RESPONSE_SCHEMA,
  })
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
  async acceptInvitation(
    @Body(new ZodValidationPipe(acceptInvitationRequestSchema))
    body: { token: string; password: string; fullName: string; cpf?: string; phone?: string },
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    return this.invitationsService.acceptInvitation(
      body.token,
      body.password,
      body.fullName,
      body.cpf,
      body.phone,
      res,
      ip,
    );
  }
}
