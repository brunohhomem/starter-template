import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { AuditService } from '../audit/audit.service';
import type { UsersQuery, UserListItem, PaginatedResponse } from '@starter/shared';
import { PEOPLE_ERROR_CODES, AUDIT_ACTIONS, buildPageMeta } from '@starter/shared';

@Injectable()
export class UsersAdminService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(query: UsersQuery): Promise<PaginatedResponse<UserListItem>> {
    const { page, pageSize, search } = query;
    const { total, items } = await this.usersRepository.list(page, pageSize, search);

    return {
      items: items.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.fullName ?? null,
        role: row.role,
        isActive: row.isActive,
        emailVerified: !!row.emailVerifiedAt,
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      })),
      meta: buildPageMeta(page, pageSize, total),
    };
  }

  async changeRole(
    targetUserId: string,
    newRole: 'admin' | 'user',
    actorUserId: string,
    ip?: string,
  ): Promise<void> {
    if (targetUserId === actorUserId) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Não é permitido alterar o próprio role',
        code: PEOPLE_ERROR_CODES.USERS_SELF_CHANGE_FORBIDDEN,
        requestId: '',
        path: `/api/users/${targetUserId}/role`,
        timestamp: new Date().toISOString(),
      });
    }

    const user = await this.usersRepository.findById(targetUserId);

    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Usuário não encontrado',
        code: PEOPLE_ERROR_CODES.USERS_NOT_FOUND,
        requestId: '',
        path: `/api/users/${targetUserId}/role`,
        timestamp: new Date().toISOString(),
      });
    }

    const oldRole = await this.usersRepository.updateRole(targetUserId, newRole);

    void this.auditService
      .record({
        actorUserId,
        action: AUDIT_ACTIONS.USERS_ROLE_CHANGED,
        targetType: 'user',
        targetId: targetUserId,
        metadata: { from: oldRole, to: newRole },
        ip: ip ?? null,
      })
      .catch(() => undefined);
  }

  async changeStatus(
    targetUserId: string,
    isActive: boolean,
    actorUserId: string,
    ip?: string,
  ): Promise<void> {
    if (targetUserId === actorUserId) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Não é permitido alterar o próprio status',
        code: PEOPLE_ERROR_CODES.USERS_SELF_CHANGE_FORBIDDEN,
        requestId: '',
        path: `/api/users/${targetUserId}/status`,
        timestamp: new Date().toISOString(),
      });
    }

    const user = await this.usersRepository.findById(targetUserId);

    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Usuário não encontrado',
        code: PEOPLE_ERROR_CODES.USERS_NOT_FOUND,
        requestId: '',
        path: `/api/users/${targetUserId}/status`,
        timestamp: new Date().toISOString(),
      });
    }

    await this.usersRepository.updateStatus(targetUserId, isActive);

    if (!isActive) {
      await this.usersRepository.revokeSessions(targetUserId);
    }

    void this.auditService
      .record({
        actorUserId,
        action: AUDIT_ACTIONS.USERS_STATUS_CHANGED,
        targetType: 'user',
        targetId: targetUserId,
        metadata: { isActive },
        ip: ip ?? null,
      })
      .catch(() => undefined);
  }
}
