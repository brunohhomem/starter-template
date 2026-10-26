import { Controller, Post, Get, Body, Res, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { registerRequestSchema, loginRequestSchema } from '@starter/shared/auth';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ERROR_SCHEMA, AUTH_RESPONSE_SCHEMA, getRefreshCookie } from './auth-swagger';

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
    @Body(new ZodValidationPipe(registerRequestSchema))
    body: { email: string; password: string; fullName: string; cpf?: string; phone?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(
      body.email,
      body.password,
      body.fullName,
      body.cpf,
      body.phone,
      res,
    );
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
}
