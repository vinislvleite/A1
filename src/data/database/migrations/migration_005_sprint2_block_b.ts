import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import type { Migration } from './migration_001_initial';

const safeAddColumn = async (db: SQLiteDatabase, sql: string): Promise<void> => {
  try {
    await db.executeSql(sql);
  } catch {
    return;
  }
};

export const migration005Sprint2BlockB: Migration = {
  version: 5,
  name: 'sprint2_block_b_cards_and_statements',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await safeAddColumn(db, 'ALTER TABLE accounts ADD COLUMN credit_limit REAL DEFAULT 0.0;');
    await safeAddColumn(db, 'ALTER TABLE accounts ADD COLUMN closing_day INTEGER;');
    await safeAddColumn(db, 'ALTER TABLE accounts ADD COLUMN due_day INTEGER;');

    await db.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date ASC, created_at ASC);'
    );
  },
  down: async (_db: SQLiteDatabase): Promise<void> => {},
};
