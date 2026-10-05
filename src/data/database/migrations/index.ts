import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { Migration, migration001Initial } from './migration_001_initial';
import { migration002SystemLogs } from './migration_002_system_logs';
import { migration003AddUsername } from './migration_003_add_username';

export { Migration };

export const migrations: Migration[] = [
  migration001Initial,
  migration002SystemLogs,
  migration003AddUsername,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const [result] = await db.executeSql('SELECT version FROM schema_migrations ORDER BY version ASC;');
  const appliedVersions = new Set<number>();

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i) as { version: number };
    appliedVersions.add(row.version);
  }

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      await migration.up(db);
      await db.executeSql(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);',
        [migration.version, new Date().toISOString()]
      );
    }
  }
}
