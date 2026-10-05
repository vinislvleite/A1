import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { Migration } from './migration_001_initial';

export const migration003AddUsername: Migration = {
  version: 3,
  name: 'add_username_to_users',
  up: async (db: SQLiteDatabase): Promise<void> => {
    try {
      await db.executeSql('ALTER TABLE users ADD COLUMN username TEXT;');
    } catch {
      return;
    }
    await db.executeSql('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);');
  },
  down: async (_db: SQLiteDatabase): Promise<void> => {
  },
};
