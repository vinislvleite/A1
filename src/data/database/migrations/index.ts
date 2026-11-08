import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { Migration, migration001Initial } from './migration_001_initial';
import { migration002SystemLogs } from './migration_002_system_logs';
import { migration003AddUsername } from './migration_003_add_username';
import { migration004Sprint2BlockA } from './migration_004_sprint2_block_a';
import { migration005Sprint2BlockB } from './migration_005_sprint2_block_b';
import { migration006Sprint2BlockC } from './migration_006_sprint2_block_c';
import { migration007Sprint2BlockD } from './migration_007_sprint2_block_d';

export { Migration };

export const migrations: Migration[] = [
  migration001Initial,
  migration002SystemLogs,
  migration003AddUsername,
  migration004Sprint2BlockA,
  migration005Sprint2BlockB,
  migration006Sprint2BlockC,
  migration007Sprint2BlockD,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  let pragmaVersion = 0;
  try {
    const [pragmaRes] = await db.executeSql('PRAGMA user_version;');
    if (pragmaRes && pragmaRes.rows && pragmaRes.rows.length > 0) {
      const item = pragmaRes.rows.item(0) as { user_version?: number };
      if (typeof item.user_version === 'number') {
        pragmaVersion = item.user_version;
      }
    }
  } catch {
    pragmaVersion = 0;
  }

  const [result] = await db.executeSql('SELECT version FROM schema_migrations ORDER BY version ASC;');
  const appliedVersions = new Set<number>();

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i) as { version: number };
    appliedVersions.add(Number(row.version));
  }

  let latestApplied = pragmaVersion;

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version) || migration.version > pragmaVersion) {
      await migration.up(db);
      if (!appliedVersions.has(migration.version)) {
        await db.executeSql(
          'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?);',
          [migration.version, new Date().toISOString()]
        );
      }
      await db.executeSql(`PRAGMA user_version = ${migration.version};`);
      if (migration.version > latestApplied) {
        latestApplied = migration.version;
      }
    }
  }

  if (latestApplied > pragmaVersion) {
    await db.executeSql(`PRAGMA user_version = ${latestApplied};`);
  }
}
