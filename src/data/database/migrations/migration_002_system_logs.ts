import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { CREATE_SYSTEM_LOGS_TABLE } from '../schema';
import { Migration } from './migration_001_initial';

export const migration002SystemLogs: Migration = {
  version: 2,
  name: 'system_logs_schema',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.executeSql(CREATE_SYSTEM_LOGS_TABLE);
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);');
  },
  down: async (db: SQLiteDatabase): Promise<void> => {
    await db.executeSql('DROP TABLE IF EXISTS system_logs;');
  },
};
