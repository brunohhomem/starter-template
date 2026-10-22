import { eq } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../../database/database.module';
import { DATABASE } from '../../database/database.module';
import { systemSettings, type SystemSetting, type NewSystemSetting } from './system-setting.entity';

@Injectable()
export class SystemSettingsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByKey(key: string): Promise<SystemSetting | null> {
    const result = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return result[0] ?? null;
  }

  async findAll(): Promise<SystemSetting[]> {
    return this.db.select().from(systemSettings);
  }

  async upsert(key: string, value: NewSystemSetting['value']): Promise<SystemSetting> {
    const existing = await this.findByKey(key);
    if (existing) {
      const result = await this.db
        .update(systemSettings)
        .set({ value })
        .where(eq(systemSettings.key, key))
        .returning();
      if (!result[0]) throw new Error('Failed to update system setting');
      return result[0];
    }
    const result = await this.db.insert(systemSettings).values({ key, value }).returning();
    if (!result[0]) throw new Error('Failed to create system setting');
    return result[0];
  }
}
