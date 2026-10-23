import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

@ApiTags('test')
@Controller('test')
export class TestThrottlerController {
  @Get('throttle')
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
  @ApiResponse({ status: 200, description: 'Endpoint para testar throttler default' })
  async testThrottle() {
    return { ok: true };
  }
}
