export const MIGRATION_NAME_PATTERN =
  /^(create|add|remove|rename|alter|drop|backfill)_[a-z0-9]+(_[a-z0-9]+)*$/;

const MIGRATION_VERBS = ['create', 'add', 'remove', 'rename', 'alter', 'drop', 'backfill'];

export function isValidMigrationName(name: string): boolean {
  return MIGRATION_NAME_PATTERN.test(name);
}

/**
 * Mensagem única de ajuda, usada tanto na ausência quanto na invalidez do
 * nome: lista os verbos aceitos e exemplos no formato exigido.
 */
export function printMigrationNameHelp(): void {
  console.error('O nome segue o padrão <verbo>_<objeto>[_<detalhe>].');
  console.error(`Verbos: ${MIGRATION_VERBS.join(', ')}.`);
  console.error('Exemplos: create_users, add_avatar_to_people, drop_legacy_table.');
}
