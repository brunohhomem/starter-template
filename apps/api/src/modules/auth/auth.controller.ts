import { Controller, Post, Get, Body, Res, Req, HttpCode, HttpStatus, Ip } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  registerRequestSchema,
  loginRequestSchema,
  changePasswordRequestSchema,
} from '@starter/shared/auth';
import {
  confirmEmailRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  createInvitationRequestSchema,
  acceptInvitationRequestSchema,
} from '@starter/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const ERROR_SCHEMA = {
  type: 'object' as const,
  properties: {
    statusCode: { type: 'number' as const },
    error: { type: 'string' as const },
    message: { type: 'string' as const },
    code: { type: 'string' as const },
    requestId: { type: 'string' as const },
    path: { type: 'string' as const },
    timestamp: { type: 'string' as const },
  },
};

const AUTH_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    user: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        email: { type: 'string' as const },
        role: { type: 'string' as const, enum: ['admin', 'user'] },
        mustChangePassword: { type: 'boolean' as const },
        emailVerified: { type: 'boolean' as const },
      },
    },
  },
};

function getRefreshCookie(req: Request): string {
  const cookieJar = req.cookies as Record<string, string> | undefined;
  return cookieJar?.['refresh_token'] ?? '';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @SkipThrottle({
    default: true,
    login: true,
    refresh: true,
    ['change-password']: true,
    forgot: true,
    ['token-submit']: true,
    resend: true,
    invite: true,
  })
  @Throttle({ register: {} })
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { email: { type: 'string' }, password: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado e autenticado. Cookies access_token e refresh_token setados.',
    schema: AUTH_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos (VALIDATION_ERROR)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 403,
    description:
      'Cadastro desativado (AUTH_REGISTRATION_DISABLED) ou CSRF bloqueado (AUTH_CSRF_BLOCKED)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 409,
    description: 'E-mail já cadastrado (AUTH_EMAIL_TAKEN)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED). Header Retry-After em segundos.',
    schema: ERROR_SCHEMA,
  })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(body.email, body.password, res);
  }

  @Post('login')
  @Public()
  @SkipThrottle({
    default: true,
    register: true,
    refresh: true,
    ['change-password']: true,
    forgot: true,
    ['token-submit']: true,
    resend: true,
    invite: true,
  })
  @Throttle({ login: {} })
  @ApiOperation({ summary: 'Login de usuário' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { email: { type: 'string' }, password: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado. Cookies setados.',
    schema: AUTH_RESPONSE_SCHEMA,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos', schema: ERROR_SCHEMA })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas (AUTH_INVALID_CREDENTIALS)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF bloqueado (AUTH_CSRF_BLOCKED)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas (RATE_LIMITED)',
    schema: ERROR_SCHEMA,
  })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body.email, body.password, res);
  }

  @Post('refresh')
  @Public()
  @SkipThrottle({
    default: true,
    login: true,
    register: true,
    ['change-password']: true,
    forgot: true,
    ['token-submit']: true,
    resend: true,
    invite: true,
  })
  @Throttle({ refresh: {} })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiCookieAuth('refresh_token')
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados. Novos cookies setados.',
    schema: AUTH_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description:
      'Refresh inválido/expirado (AUTH_REFRESH_INVALID) ou reuso detectado (AUTH_REFRESH_REUSED)',
    schema: ERROR_SCHEMA,
  })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(getRefreshCookie(req), res);
  }

  @Post('logout')
  @Public()
  @SkipThrottle({
    login: true,
    register: true,
    refresh: true,
    ['change-password']: true,
    forgot: true,
    ['token-submit']: true,
    resend: true,
    invite: true,
  })
  @ApiOperation({ summary: 'Logout (revoga sessão atual)' })
  @ApiCookieAuth('refresh_token')
  @ApiResponse({
    status: 204,
    description: 'Logout realizado. Cookies limpos. Sempre 204 mesmo sem cookie.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(getRefreshCookie(req), res);
  }

  @Get('me')
  @SkipThrottle({
    login: true,
    register: true,
    refresh: true,
    ['change-password']: true,
    forgot: true,
    ['token-submit']: true,
    resend: true,
    invite: true,
  })
  @ApiOperation({ summary: 'Obter usuário autenticado' })
  @ApiCookieAuth('access_token')
  @ApiResponse({
    status: 200,
    description: 'Dados do usuário autenticado',
    schema: AUTH_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado (AUTH_UNAUTHORIZED) ou token expirado (AUTH_TOKEN_EXPIRED)',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 403,
    description: 'Senha deve ser trocada (AUTH_MUST_CHANGE_PASSWORD)',
    schema: ERROR_SCHEMA,
  })
  async me(
    @CurrentUser()
    user: {
      userId: string;
      role: string;
      sessionId: string;
      mustChangePassword: boolean;
    },
  ) {
    return this.authService.me(user.userId);
  }

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
    return this.authService.changePassword(
      user.userId,
      body.currentPassword,
      body.newPassword,
      res,
    );
  }

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
    await this.authService.confirmEmail(body.token, ip);
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
    await this.authService.resendEmailConfirmation(user.userId);
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
    return this.authService.forgotPassword(body.email, ip);
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
    await this.authService.resetPassword(body.token, body.newPassword, ip);
  }

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
    return this.authService.inviteUser(currentUser.userId, body.email, body.role, ip);
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
    body: { token: string; password: string },
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    return this.authService.acceptInvitation(body.token, body.password, res, ip);
  }
}
