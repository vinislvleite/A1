if (typeof (globalThis as { setImmediate?: unknown }).setImmediate === 'undefined') {
  (globalThis as unknown as { setImmediate: (fn: (...args: unknown[]) => void, ...args: unknown[]) => number }).setImmediate = (
    fn: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => setTimeout(fn, 0, ...args) as unknown as number;
}

import { NativeModules, Platform } from 'react-native';
import type { SQLiteDatabase as RNSQLiteDatabase, ResultSet } from 'react-native-sqlite-storage';
import { runMigrations } from './migrations';

const hasNativeSQLite = Boolean(NativeModules && NativeModules.SQLite);

interface SQLiteModule {
  openDatabase: (options: { name: string; location: string }) => Promise<RNSQLiteDatabase>;
  enablePromise: (enable: boolean) => void;
}

let cachedSQLiteModule: SQLiteModule | null = null;

const getNativeSQLiteModule = (): SQLiteModule | null => {
  if (Platform.OS === 'web' || !hasNativeSQLite) {
    return null;
  }
  if (cachedSQLiteModule) {
    return cachedSQLiteModule;
  }
  try {
    const loaded = require('react-native-sqlite-storage') as SQLiteModule;
    loaded.enablePromise(true);
    cachedSQLiteModule = loaded;
    return cachedSQLiteModule;
  } catch {
    return null;
  }
};

class WebSQLiteStore {
  private tables = new Map<string, Record<string, unknown>[]>();

  public execute(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('PRAGMA') || upper.startsWith('CREATE INDEX')) {
      return this.createResultSet([]);
    }

    if (upper.startsWith('CREATE TABLE')) {
      const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const tableName = match[1].toLowerCase();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
      return this.createResultSet([]);
    }

    if (upper.startsWith('DROP TABLE')) {
      const match = trimmed.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        this.tables.delete(match[1].toLowerCase());
      }
      return this.createResultSet([]);
    }

    if (upper.startsWith('INSERT INTO')) {
      return this.handleInsert(trimmed, params);
    }

    if (upper.startsWith('UPDATE')) {
      return this.handleUpdate(trimmed, params);
    }

    if (upper.startsWith('DELETE FROM')) {
      return this.handleDelete(trimmed, params);
    }

    if (upper.startsWith('SELECT')) {
      return this.handleSelect(trimmed, params);
    }

    return this.createResultSet([]);
  }

  private handleInsert(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const match = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
    if (!match || !match[1] || !match[2]) {
      return this.createResultSet([]);
    }

    const tableName = match[1].toLowerCase();
    const columns = match[2].split(',').map((c) => c.trim().toLowerCase());

    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }

    const row: Record<string, unknown> = {};
    columns.forEach((col, index) => {
      row[col] = params[index] !== undefined ? params[index] : null;
    });

    this.tables.get(tableName)!.push(row);
    return this.createResultSet([], 1, 1);
  }

  private handleUpdate(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const tableMatch = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([^W]+)\s+WHERE\s+(.+)/i);
    if (!tableMatch || !tableMatch[1] || !tableMatch[2]) {
      return this.createResultSet([]);
    }

    const tableName = tableMatch[1].toLowerCase();
    const setClause = tableMatch[2];
    const columns = setClause.split(',').map((part) => part.split('=')[0].trim().toLowerCase());

    const rows = this.tables.get(tableName) ?? [];
    const whereId = params[params.length - 1];

    let rowsAffected = 0;
    for (const row of rows) {
      if (row.id === whereId) {
        columns.forEach((col, index) => {
          row[col] = params[index];
        });
        rowsAffected++;
      }
    }

    return this.createResultSet([], rowsAffected);
  }

  private handleDelete(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)\s+WHERE\s+([a-zA-Z0-9_]+)\s*=\s*\?/i);
    if (!match || !match[1] || !match[2]) {
      return this.createResultSet([]);
    }

    const tableName = match[1].toLowerCase();
    const targetCol = match[2].toLowerCase();
    const targetVal = params[0];

    const rows = this.tables.get(tableName) ?? [];
    const initialLen = rows.length;
    const remaining = rows.filter((r) => r[targetCol] !== targetVal);
    this.tables.set(tableName, remaining);

    return this.createResultSet([], initialLen - remaining.length);
  }

  private handleSelect(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const upper = sql.toUpperCase();

    if (upper.includes('FROM SCHEMA_MIGRATIONS')) {
      const rows = this.tables.get('schema_migrations') ?? [];
      const sorted = [...rows].sort((a, b) => Number(a.version) - Number(b.version));
      return this.createResultSet(sorted);
    }

    if (upper.includes('COUNT(*) AS COUNT') && upper.includes('FROM TRANSACTIONS')) {
      const rows = this.filterTransactions(params, sql);
      return this.createResultSet([{ count: rows.length }]);
    }

    if (upper.includes('SUM(CASE WHEN TYPE =') && upper.includes('FROM TRANSACTIONS')) {
      if (upper.includes('GROUP BY ACCOUNT_ID')) {
        const allTx = this.tables.get('transactions') ?? [];
        const grouped = new Map<string, { total_income: number; total_expense: number }>();

        for (const tx of allTx) {
          if (tx.status !== 'confirmada') continue;
          const accId = String(tx.account_id);
          const current = grouped.get(accId) ?? { total_income: 0, total_expense: 0 };
          if (tx.type === 'receita') current.total_income += Number(tx.value);
          if (tx.type === 'despesa') current.total_expense += Number(tx.value);
          grouped.set(accId, current);
        }

        const resultRows = Array.from(grouped.entries()).map(([account_id, totals]) => ({
          account_id,
          total_income: totals.total_income,
          total_expense: totals.total_expense,
        }));

        return this.createResultSet(resultRows);
      }

      const startDate = String(params[0]).split('T')[0];
      const endDate = String(params[1]).split('T')[0];
      const accountId = params.length > 2 ? String(params[2]) : undefined;

      const rows = (this.tables.get('transactions') ?? []).filter((tx) => {
        const txDay = String(tx.date).substring(0, 10);
        const matchDate = txDay >= startDate && txDay <= endDate;
        const matchAccount = accountId ? tx.account_id === accountId : true;
        const isConfirmed = tx.status === 'confirmada';
        return matchDate && matchAccount && isConfirmed;
      });


      let totalIncome = 0;
      let totalExpense = 0;

      for (const tx of rows) {
        if (tx.type === 'receita') totalIncome += Number(tx.value);
        if (tx.type === 'despesa') totalExpense += Number(tx.value);
      }

      return this.createResultSet([{ total_income: totalIncome, total_expense: totalExpense }]);
    }


    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch || !fromMatch[1]) {
      return this.createResultSet([]);
    }

    const tableName = fromMatch[1].toLowerCase();
    let rows = [...(this.tables.get(tableName) ?? [])];

    if (tableName === 'transactions') {
      rows = this.filterTransactions(params, sql);
    } else if (sql.includes('WHERE id = ?')) {
      const targetId = params[0];
      rows = rows.filter((r) => r.id === targetId);
    } else if (sql.includes('WHERE email = ?')) {
      const targetEmail = String(params[0]).toLowerCase();
      rows = rows.filter((r) => String(r.email).toLowerCase() === targetEmail);
    } else if (tableName === 'budgets' && sql.includes('WHERE category_id = ?')) {
      const catId = params[0];
      const month = params[1];
      const year = params[2];
      const periodType = params[3] ?? 'mensal';
      rows = rows.filter(
        (r) =>
          r.category_id === catId &&
          Number(r.month) === Number(month) &&
          Number(r.year) === Number(year) &&
          r.period_type === periodType
      );
    } else if (tableName === 'budgets' && sql.includes('WHERE month = ? AND year = ?')) {
      const month = params[0];
      const year = params[1];
      rows = rows
        .filter((r) => Number(r.month) === Number(month) && Number(r.year) === Number(year))
        .sort((a, b) => Number(b.limit_value) - Number(a.limit_value));
    } else if (tableName === 'accounts') {
      rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } else if (tableName === 'categories') {
      rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } else if (tableName === 'goals') {
      rows.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
    }

    if (upper.includes('LIMIT ? OFFSET ?')) {
      const limitVal = Number(params[params.length - 2]);
      const offsetVal = Number(params[params.length - 1]);
      rows = rows.slice(offsetVal, offsetVal + limitVal);
    }

    return this.createResultSet(rows);
  }

  private filterTransactions(
    params: (string | number | boolean | null)[],
    sql: string
  ): Record<string, unknown>[] {
    let rows = [...(this.tables.get('transactions') ?? [])];
    const upper = sql.toUpperCase();

    if (upper.includes('ACCOUNT_ID = ?')) {
      const accId = params.find((p) => p !== null && !String(p).includes('T') && !String(p).includes('%'));
      if (accId) {
        rows = rows.filter((r) => r.account_id === accId);
      }
    }

    if (upper.includes('CATEGORY_ID = ?')) {
      const catId = params.find((p) => p !== null && !String(p).includes('T') && !String(p).includes('%'));
      if (catId) {
        rows = rows.filter((r) => r.category_id === catId);
      }
    }

    if (upper.includes("TYPE = ?") || upper.includes("TYPE = 'DESPESA'") || upper.includes("TYPE = 'RECEITA'")) {
      if (upper.includes("TYPE = 'DESPESA'")) {
        rows = rows.filter((r) => r.type === 'despesa');
      } else if (upper.includes("TYPE = 'RECEITA'")) {
        rows = rows.filter((r) => r.type === 'receita');
      }
    }

    if (upper.includes("STATUS = 'CONFIRMADA'")) {
      rows = rows.filter((r) => r.status === 'confirmada');
    }

    const dateParams = params.filter((p) => typeof p === 'string' && p.includes('T'));
    if (dateParams.length >= 2) {
      const start = String(dateParams[0]);
      const end = String(dateParams[1]);
      rows = rows.filter((r) => String(r.date) >= start && String(r.date) <= end);
    }

    rows.sort((a, b) => {
      const dateA = String(a.date);
      const dateB = String(b.date);
      return dateB.localeCompare(dateA);
    });

    return rows;
  }

  private createResultSet(items: Record<string, unknown>[], rowsAffected: number = 0, insertId: number = 0): ResultSet {
    return {
      insertId,
      rowsAffected,
      rows: {
        length: items.length,
        item: (index: number) => items[index],
        raw: () => items,
      },
    };
  }
}

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private database: RNSQLiteDatabase | null = null;
  private webStore: WebSQLiteStore | null = null;
  private readonly databaseName: string = 'orcamentofacil.db';

  private constructor() {
    if (Platform.OS === 'web' || !hasNativeSQLite) {
      this.webStore = new WebSQLiteStore();
    }
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async getDatabase(): Promise<RNSQLiteDatabase | null> {
    const sqliteModule = getNativeSQLiteModule();
    if (!sqliteModule) {
      return null;
    }

    if (this.database) {
      return this.database;
    }

    try {
      this.database = await sqliteModule.openDatabase({
        name: this.databaseName,
        location: 'default',
      });

      await this.database.executeSql('PRAGMA foreign_keys = ON;');
      await runMigrations(this.database);

      return this.database;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao inicializar o banco de dados SQLite: ${message}`);
    }
  }

  public async executeQuery(
    sql: string,
    params: (string | number | boolean | null)[] = []
  ): Promise<ResultSet> {
    if (Platform.OS === 'web' || !hasNativeSQLite) {
      if (!this.webStore) {
        this.webStore = new WebSQLiteStore();
      }
      return this.webStore.execute(sql, params);
    }

    const db = await this.getDatabase();
    if (!db) {
      throw new Error('Banco de dados não inicializado.');
    }

    try {
      const [resultSet] = await db.executeSql(sql, params);
      return resultSet;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao executar consulta SQL [${sql}]: ${message}`);
    }
  }

  public async close(): Promise<void> {
    if (Platform.OS === 'web' || !hasNativeSQLite) {
      return;
    }

    if (this.database) {
      try {
        await this.database.close();
        this.database = null;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Erro ao fechar o banco de dados: ${message}`);
      }
    }
  }
}
