import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { UsersAdminService } from './users-admin.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  usersQuerySchema,
  updateUserRoleRequestSchema,
  updateUserStatusRequestSchema,
} from '@starter/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UsersQuery, UpdateUserRoleRequest, UpdateUserStatusRequest } from '@starter/shared';

@ApiTags('users')
@Controller('users')
@Roles('admin')
@ApiCookieAuth('access_token')
export class UsersAdminController {
  constructor(private readonly usersAdminService: UsersAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários (admin)' })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  async listUsers(@Query(new ZodValidationPipe(usersQuerySchema)) query: UsersQuery) {
    return this.usersAdminService.listUsers(query);
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alterar role de um usuário (admin)' })
  @ApiResponse({ status: 200, description: 'Role alterado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado (USERS_NOT_FOUND)' })
  @ApiResponse({
    status: 422,
    description: 'Auto-alteração proibida (USERS_SELF_CHANGE_FORBIDDEN)',
  })
  async changeRole(
    @Param('id') targetId: string,
    @Body(new ZodValidationPipe(updateUserRoleRequestSchema)) body: UpdateUserRoleRequest,
    @CurrentUser() currentUser: { userId: string },
    @Ip() ip: string,
  ) {
    await this.usersAdminService.changeRole(targetId, body.role, currentUser.userId, ip);
    return {};
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativar ou desativar um usuário (admin)' })
  @ApiResponse({ status: 200, description: 'Status alterado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado (USERS_NOT_FOUND)' })
  @ApiResponse({
    status: 422,
    description: 'Auto-alteração proibida (USERS_SELF_CHANGE_FORBIDDEN)',
  })
  async changeStatus(
    @Param('id') targetId: string,
    @Body(new ZodValidationPipe(updateUserStatusRequestSchema)) body: UpdateUserStatusRequest,
    @CurrentUser() currentUser: { userId: string },
    @Ip() ip: string,
  ) {
    await this.usersAdminService.changeStatus(targetId, body.isActive, currentUser.userId, ip);
    return {};
  }
}
