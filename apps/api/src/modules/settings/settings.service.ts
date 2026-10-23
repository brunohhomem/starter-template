import { Injectable } from '@nestjs/common';
import { SystemSettingsRepository } from './system-settings.repository';

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SystemSettingsRepository) {}

  async getRegistrationEnabled(): Promise<boolean> {
    const setting = await this.settingsRepository.findByKey('registration_enabled');
    return setting?.value === true;
  }

  async updateRegistrationEnabled(value: boolean): Promise<void> {
    await this.settingsRepository.upsert('registration_enabled', value);
  }

  async getAll(): Promise<{ registrationEnabled: boolean }> {
    return { registrationEnabled: await this.getRegistrationEnabled() };
  }
}
