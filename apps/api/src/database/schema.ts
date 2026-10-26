/**
 * Agrega as entities de cada módulo. Cada feature declara sua tabela no
 * próprio `*.entity.ts`; este arquivo é o único que o Drizzle e as
 * migrations conhecem, para que `drizzle(pool, { schema })` carregue todas
 * as relações.
 */
export { systemSettings } from '../modules/settings/system-setting.entity';
export type { SystemSetting, NewSystemSetting } from '../modules/settings/system-setting.entity';

export { users, userRoleEnum } from '../modules/auth/user.entity';
export type { User, NewUser } from '../modules/auth/user.entity';

export { sessions } from '../modules/auth/session.entity';
export type { Session, NewSession } from '../modules/auth/session.entity';

export { emailTokens, emailTokenTypeEnum } from '../modules/email-tokens/email-token.entity';
export type { EmailToken, NewEmailToken } from '../modules/email-tokens/email-token.entity';

export { auditLogs } from '../modules/audit/audit-log.entity';
export type { AuditLog, NewAuditLog } from '../modules/audit/audit-log.entity';

export { people } from '../modules/people/person.entity';
export type { Person, NewPerson } from '../modules/people/person.entity';
