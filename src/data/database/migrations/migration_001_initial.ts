import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import {
  CREATE_USERS_TABLE,
  CREATE_ACCOUNTS_TABLE,
  CREATE_CATEGORIES_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_BUDGETS_TABLE,
  CREATE_GOALS_TABLE,
  CREATE_MIGRATIONS_TABLE,
  CREATE_INDEXES,
} from '../schema';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
  down: (db: SQLiteDatabase) => Promise<void>;
}

export const migration001Initial: Migration = {
  version: 1,
  name: 'initial_schema',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.executeSql(CREATE_MIGRATIONS_TABLE);
    await db.executeSql(CREATE_USERS_TABLE);
    await db.executeSql(CREATE_ACCOUNTS_TABLE);
    await db.executeSql(CREATE_CATEGORIES_TABLE);
    await db.executeSql(CREATE_TRANSACTIONS_TABLE);
    await db.executeSql(CREATE_BUDGETS_TABLE);
    await db.executeSql(CREATE_GOALS_TABLE);

    for (const indexSql of CREATE_INDEXES) {
      await db.executeSql(indexSql);
    }
  },
  down: async (db: SQLiteDatabase): Promise<void> => {
    await db.executeSql('DROP TABLE IF EXISTS transactions;');
    await db.executeSql('DROP TABLE IF EXISTS budgets;');
    await db.executeSql('DROP TABLE IF EXISTS goals;');
    await db.executeSql('DROP TABLE IF EXISTS accounts;');
    await db.executeSql('DROP TABLE IF EXISTS categories;');
    await db.executeSql('DROP TABLE IF EXISTS users;');
    await db.executeSql('DROP TABLE IF EXISTS schema_migrations;');
  },
};
