import { Controller, Get, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { REDIS } from '../redis/redis.module';
import Redis from 'ioredis';
import { DATABASE, type Database } from '../database/database.module';
import { Public } from '../common/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';

// Versão do package.json da API (lida em tempo de build)
const API_VERSION = require('../../package.json').version as string;

/**
 * Controller de health check.
 * Rota: GET /api/health (pública).
 * Resposta mínima: { status: "ok" | "error", version: "x.y.z" }.
 * Sem detalhes de componentes no corpo da resposta.
 * HTTP 200 quando saudável, 503 quando não.
 */
@ApiTags('health')
@Controller('health')
@Public()
// O probe não entra nos baldes de autenticação. `forgot` e `resend` são 3 por hora,
// e o boot consulta /health até a API responder.
@SkipThrottle({
  default: true,
  login: true,
  register: true,
  refresh: true,
  ['change-password']: true,
  forgot: true,
  ['token-submit']: true,
  resend: true,
  invite: true,
})
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'Health check OK',
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] }, version: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async check() {
    const [dbHealthy, redisHealthy] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const isHealthy = dbHealthy && redisHealthy;

    if (!isHealthy) {
      throw new HttpException(
        { status: 'error', version: API_VERSION },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', version: API_VERSION };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.db.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const result = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
