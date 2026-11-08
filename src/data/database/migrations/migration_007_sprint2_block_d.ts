import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { Migration } from './migration_001_initial';

export const migration007Sprint2BlockD: Migration = {
  version: 7,
  name: '007_sprint2_block_d',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS recurring_bills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value REAL NOT NULL,
        due_day INTEGER NOT NULL,
        reminder_days_before INTEGER NOT NULL DEFAULT 3,
        category_id TEXT NOT NULL,
        account_id TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS bill_payments (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        paid_at TEXT NOT NULL,
        transaction_id TEXT,
        FOREIGN KEY (bill_id) REFERENCES recurring_bills(id) ON DELETE CASCADE,
        UNIQUE(bill_id, month, year)
      );
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_recurring_bills_due_day ON recurring_bills(due_day ASC);
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_bill_payments_period ON bill_payments(bill_id, year, month);
    `);
  },
  down: async (): Promise<void> => {},
};
