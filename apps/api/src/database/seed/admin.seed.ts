import { getEnv } from '../../config/load-env';
import { buildDatabaseConfig } from '../database-config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users, userRoleEnum } from '../../modules/auth/user.entity';
import { people } from '../../modules/people/person.entity';
import { systemSettings } from '../../modules/settings/system-setting.entity';
import { eq } from 'drizzle-orm';
import { PasswordHasher } from '../../modules/auth/password-hasher';
import { randomBytes } from 'node:crypto';

interface AdminSeedResult {
  adminCreated: boolean;
  adminEmail: string;
  passwordGenerated?: string;
  registrationEnabledCreated: boolean;
  registrationEnabledValue: boolean;
}

/**
 * Semear admin e configuração inicial.
 * Idempotente: não sobrescreve senha existente nem setting existente.
 * Não roda automaticamente em NODE_ENV=test (testes chamam explicitamente).
 */
export async function seedAdmin(db: NodePgDatabase): Promise<AdminSeedResult> {
  const env = getEnv();
  const adminEmail = env.ADMIN_EMAIL.toLowerCase();
  const isDevelopment = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

  // 1. Verificar se admin já existe
  const existingAdmin = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  let adminCreated = false;
  let passwordGenerated: string | undefined;

  if (existingAdmin.length > 0) {
    console.log('admin já existe');
  } else {
    // 2. Gerar/obter senha
    let initialPassword: string;
    if (isDevelopment) {
      initialPassword = 'Admin@12345';
    } else if (env.ADMIN_INITIAL_PASSWORD) {
      initialPassword = env.ADMIN_INITIAL_PASSWORD;
    } else {
      // Gerar 24 caracteres aleatórios (base64url-safe)
      const bytes = randomBytes(18); // 18 bytes = 24 chars base64url
      initialPassword = bytes
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      passwordGenerated = initialPassword;
    }

    // Hash da senha
    const passwordHasher = new PasswordHasher();
    const passwordHash = await passwordHasher.hash(initialPassword);

    // 3. Criar admin em transação
    await db.transaction(async (tx) => {
      const [newAdmin] = await tx
        .insert(users)
        .values({
          email: adminEmail,
          passwordHash,
          role: 'admin',
          isActive: true,
          mustChangePassword: !isDevelopment,
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });

      if (newAdmin) {
        await tx.insert(people).values({
          userId: newAdmin.id,
          fullName: 'Administrador',
          cpf: null,
          phone: null,
        });
      }

      // 4. Inserir registration_enabled somente se não existir
      const existingSetting = await tx
        .select({ key: systemSettings.key })
        .from(systemSettings)
        .where(eq(systemSettings.key, 'registration_enabled'))
        .limit(1);

      if (existingSetting.length === 0) {
        const registrationEnabledValue = isDevelopment || env.NODE_ENV === 'test';
        await tx.insert(systemSettings).values({
          key: 'registration_enabled',
          value: registrationEnabledValue,
        });
      }
    });

    adminCreated = true;
  }

  // Verificar valor atual do registration_enabled
  const currentSetting = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'registration_enabled'))
    .limit(1);

  const firstSetting = currentSetting[0];
  const registrationEnabledValue = firstSetting ? Boolean(firstSetting.value) : false;

  return {
    adminCreated,
    adminEmail,
    passwordGenerated,
    registrationEnabledCreated: false, // Não rastreamos se foi criado agora
    registrationEnabledValue,
  };
}

/**
 * Função principal para executar via CLI (pnpm db:seed).
 * Não executa em NODE_ENV=test automaticamente.
 */
async function main(): Promise<void> {
  const env = getEnv();

  if (env.NODE_ENV === 'test') {
    console.log('Seed não roda automaticamente em NODE_ENV=test');
    process.exitCode = 0;
    return;
  }

  const config = buildDatabaseConfig(env);
  const pool = new Pool({
    ...config,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = drizzle(pool);

  try {
    const result = await seedAdmin(db);

    if (result.adminCreated) {
      console.log(`Admin criado: ${result.adminEmail}`);
      if (result.passwordGenerated) {
        console.log(`Senha inicial (apenas exibida uma vez): ${result.passwordGenerated}`);
      }
    }
    console.log(`registration_enabled = ${result.registrationEnabledValue}`);
    process.exitCode = 0;
  } catch (error) {
    console.error('Erro no seed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// O CLI `scripts/db-seed.ts` importa este módulo. Sem o guarda, as duas
// execuções correm juntas e a segunda inserção perde a corrida da unique.
function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const normalized = entry.replace(/\\/g, '/');
  return (
    normalized.endsWith('/database/seed/admin.seed.ts') ||
    normalized.endsWith('/database/seed/admin.seed.js')
  );
}

if (isDirectExecution()) {
  void main();
}
