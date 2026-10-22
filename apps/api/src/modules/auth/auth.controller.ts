import { Controller, Post, Get, Body, Res, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  registerRequestSchema,
  loginRequestSchema,
  changePasswordRequestSchema,
} from '@starter/shared/auth';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @SkipThrottle({ default: true, login: true, refresh: true, ['change-password']: true })
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
  @SkipThrottle({ default: true, register: true, refresh: true, ['change-password']: true })
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
  @SkipThrottle({ default: true, login: true, register: true, ['change-password']: true })
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
    const refreshToken = req.cookies?.refresh_token;
    return this.authService.refresh(refreshToken, res);
  }

  @Post('logout')
  @Public()
  @SkipThrottle({ login: true, register: true, refresh: true, ['change-password']: true })
  @ApiOperation({ summary: 'Logout (revoga sessão atual)' })
  @ApiCookieAuth('refresh_token')
  @ApiResponse({
    status: 204,
    description: 'Logout realizado. Cookies limpos. Sempre 204 mesmo sem cookie.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    await this.authService.logout(refreshToken, res);
  }

  @Get('me')
  @SkipThrottle({ login: true, register: true, refresh: true, ['change-password']: true })
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
  @SkipThrottle({ default: true, login: true, register: true, refresh: true })
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
}
