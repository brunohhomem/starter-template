import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PeopleRepository } from './people.repository';
import type { ProfileResponse, UpdateProfileRequest } from '@starter/shared';
import { PEOPLE_ERROR_CODES } from '@starter/shared';

@Injectable()
export class PeopleService {
  constructor(private readonly peopleRepository: PeopleRepository) {}

  async getProfile(userId: string): Promise<ProfileResponse> {
    const row = await this.peopleRepository.findProfileByUserId(userId);

    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Usuário não encontrado',
        code: PEOPLE_ERROR_CODES.USERS_NOT_FOUND,
        requestId: '',
        path: '/api/me/profile',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      email: row.email,
      role: row.role,
      emailVerified: !!row.emailVerifiedAt,
      fullName: row.fullName ?? '',
      cpf: row.cpf ?? null,
      phone: row.phone ?? null,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<ProfileResponse> {
    if (data.cpf !== undefined) {
      const existing = await this.peopleRepository.findByCpfExcludingUser(data.cpf, userId);
      if (existing) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'CPF já cadastrado',
          code: PEOPLE_ERROR_CODES.PEOPLE_CPF_TAKEN,
          requestId: '',
          path: '/api/me/profile',
          timestamp: new Date().toISOString(),
        });
      }
    }

    const updates: Partial<{ fullName: string; cpf: string; phone: string }> = {};
    if (data.fullName !== undefined) updates.fullName = data.fullName;
    if (data.cpf !== undefined) updates.cpf = data.cpf;
    if (data.phone !== undefined) updates.phone = data.phone;

    await this.peopleRepository.update(userId, updates);

    return this.getProfile(userId);
  }
}
