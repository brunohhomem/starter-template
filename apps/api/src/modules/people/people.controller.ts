import { Controller, Get, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { PeopleService } from './people.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { profileResponseSchema, updateProfileRequestSchema } from '@starter/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UpdateProfileRequest } from '@starter/shared';

@ApiTags('me')
@Controller('me')
@ApiCookieAuth('access_token')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil retornado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getProfile(@CurrentUser() currentUser: { userId: string }) {
    return this.peopleService.getProfile(currentUser.userId);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 409, description: 'CPF já cadastrado (PEOPLE_CPF_TAKEN)' })
  async updateProfile(
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) body: UpdateProfileRequest,
    @CurrentUser() currentUser: { userId: string },
  ) {
    return this.peopleService.updateProfile(currentUser.userId, body);
  }
}
