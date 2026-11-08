import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import type { Migration } from './migration_001_initial';
import {
  CREATE_ZERO_BASED_ALLOCATIONS_TABLE,
  CREATE_EVENTS_TABLE,
  CREATE_DAILY_LIMITS_TABLE,
  CREATE_APP_SETTINGS_TABLE,
  CREATE_CATEGORY_SPENDING_GOALS_TABLE,
} from '../schema';

const safeAddColumn = async (db: SQLiteDatabase, sql: string): Promise<void> => {
  try {
    await db.executeSql(sql);
  } catch {
    return;
  }
};

export const migration006Sprint2BlockC: Migration = {
  version: 6,
  name: 'sprint2_block_c_budgets_limits_goals',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await safeAddColumn(db, "ALTER TABLE budgets ADD COLUMN budget_mode TEXT NOT NULL DEFAULT 'fixo';");
    await safeAddColumn(db, 'ALTER TABLE budgets ADD COLUMN percentage_value REAL;');
    await safeAddColumn(db, 'ALTER TABLE transactions ADD COLUMN event_id TEXT;');

    await db.executeSql(CREATE_ZERO_BASED_ALLOCATIONS_TABLE);
    await db.executeSql(CREATE_EVENTS_TABLE);
    await db.executeSql(CREATE_DAILY_LIMITS_TABLE);
    await db.executeSql(CREATE_APP_SETTINGS_TABLE);
    await db.executeSql(CREATE_CATEGORY_SPENDING_GOALS_TABLE);

    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_event ON transactions(event_id);');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_zero_based_period ON zero_based_allocations(year, month);');
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_spending_goals_cat ON category_spending_goals(category_id);');
  },
  down: async (_db: SQLiteDatabase): Promise<void> => {},
};
