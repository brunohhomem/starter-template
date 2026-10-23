import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AUDIT_ACTIONS, updateSettingsRequestSchema } from '@starter/shared';
import type { UpdateSettingsRequest } from '@starter/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
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
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Configurações públicas' })
  @ApiResponse({ status: 200, description: 'Configurações públicas' })
  async getPublic(): Promise<{ registrationEnabled: boolean }> {
    return this.settingsService.getAll();
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Configurações (admin)' })
  @ApiResponse({ status: 200, description: 'Configurações completas' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  async getAll(): Promise<{ registrationEnabled: boolean }> {
    return this.settingsService.getAll();
  }

  @Patch()
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar configurações (admin)' })
  @ApiResponse({ status: 200, description: 'Configurações atualizadas' })
  @ApiResponse({ status: 400, description: 'Nenhum campo fornecido' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  async update(
    @Body(new ZodValidationPipe(updateSettingsRequestSchema)) body: UpdateSettingsRequest,
    @CurrentUser() currentUser: { userId: string },
  ): Promise<{ registrationEnabled: boolean }> {
    const current = await this.settingsService.getAll();

    if (body.registrationEnabled !== undefined) {
      await this.settingsService.updateRegistrationEnabled(body.registrationEnabled);
      void this.auditService.record({
        actorUserId: currentUser.userId,
        action: AUDIT_ACTIONS.SETTINGS_REGISTRATION_CHANGED,
        metadata: { from: current.registrationEnabled, to: body.registrationEnabled },
      });
    }

    return this.settingsService.getAll();
  }
}
