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

const formatSqliteErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string' && errorObj.message.trim().length > 0) {
      return errorObj.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

class WebSQLiteStore {
  private authTables = new Map<string, Record<string, unknown>[]>();
  private userStores = new Map<string, Map<string, Record<string, unknown>[]>>();
  private activeUserId: string | null = null;

  public setActiveUser(userId: string | null): void {
    this.activeUserId = userId;
  }

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  private getTable(tableName: string): Record<string, unknown>[] {
    const isAuth = tableName.toLowerCase() === 'users' || tableName.toLowerCase() === 'system_logs';
    if (isAuth) {
      return this.authTables.get(tableName.toLowerCase()) ?? [];
    }
    const key = this.activeUserId || 'default';
    let userStore = this.userStores.get(key);
    if (!userStore) {
      userStore = new Map<string, Record<string, unknown>[]>();
      this.userStores.set(key, userStore);
    }
    if (tableName.toLowerCase() === 'categories' && !userStore.has('categories')) {
      this.seedDefaultCategoriesForStore(userStore);
    }
    return userStore.get(tableName.toLowerCase()) ?? [];
  }

  private setTable(tableName: string, rows: Record<string, unknown>[]): void {
    const isAuth = tableName.toLowerCase() === 'users' || tableName.toLowerCase() === 'system_logs';
    if (isAuth) {
      this.authTables.set(tableName.toLowerCase(), rows);
      return;
    }
    const key = this.activeUserId || 'default';
    let userStore = this.userStores.get(key);
    if (!userStore) {
      userStore = new Map<string, Record<string, unknown>[]>();
      this.userStores.set(key, userStore);
    }
    userStore.set(tableName.toLowerCase(), rows);
  }

  private createTable(tableName: string): void {
    const isAuth = tableName.toLowerCase() === 'users' || tableName.toLowerCase() === 'system_logs';
    if (isAuth) {
      if (!this.authTables.has(tableName.toLowerCase())) {
        this.authTables.set(tableName.toLowerCase(), []);
      }
      return;
    }
    const key = this.activeUserId || 'default';
    let userStore = this.userStores.get(key);
    if (!userStore) {
      userStore = new Map<string, Record<string, unknown>[]>();
      this.userStores.set(key, userStore);
    }
    if (!userStore.has(tableName.toLowerCase())) {
      userStore.set(tableName.toLowerCase(), []);
    }
  }

  private deleteTable(tableName: string): void {
    const isAuth = tableName.toLowerCase() === 'users' || tableName.toLowerCase() === 'system_logs';
    if (isAuth) {
      this.authTables.delete(tableName.toLowerCase());
      return;
    }
    const key = this.activeUserId || 'default';
    const userStore = this.userStores.get(key);
    if (userStore) {
      userStore.delete(tableName.toLowerCase());
    }
  }

  private seedDefaultCategoriesForStore(store: Map<string, Record<string, unknown>[]>): void {
    const defaultCategories: Record<string, unknown>[] = [
      { id: 'cat-alim', name: 'Alimentação', description: 'Supermercado, restaurantes, delivery', color: '#F59E0B', icon: 'coffee', is_custom: 0 },
      { id: 'cat-transp', name: 'Transporte', description: 'Combustível, transporte público, aplicativo', color: '#3B82F6', icon: 'navigation', is_custom: 0 },
      { id: 'cat-lazer', name: 'Lazer', description: 'Cinema, passeios, viagens, entretenimento', color: '#EC4899', icon: 'smile', is_custom: 0 },
      { id: 'cat-saude', name: 'Saúde', description: 'Farmácia, consultas, plano de saúde', color: '#EF4444', icon: 'activity', is_custom: 0 },
      { id: 'cat-educ', name: 'Educação', description: 'Cursos, livros, faculdade', color: '#8B5CF6', icon: 'book', is_custom: 0 },
      { id: 'cat-morad', name: 'Moradia', description: 'Aluguel, condomínio, luz, água, internet', color: '#10B981', icon: 'home', is_custom: 0 },
      { id: 'cat-sal', name: 'Salário', description: 'Remuneração principal, benefícios', color: '#22C55E', icon: 'dollar-sign', is_custom: 0 },
      { id: 'cat-serv', name: 'Serviços', description: 'Freelas, trabalhos extras, consultoria', color: '#6366F1', icon: 'briefcase', is_custom: 0 },
      { id: 'cat-outr', name: 'Outros', description: 'Despesas e receitas diversas', color: '#6B7280', icon: 'grid', is_custom: 0 },
    ];
    store.set('categories', defaultCategories);
  }

  public execute(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('PRAGMA') || upper.startsWith('CREATE INDEX')) {
      return this.createResultSet([]);
    }

    if (upper.startsWith('CREATE TABLE')) {
      const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        this.createTable(match[1].toLowerCase());
      }
      return this.createResultSet([]);
    }

    if (upper.startsWith('DROP TABLE')) {
      const match = trimmed.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        this.deleteTable(match[1].toLowerCase());
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

    this.createTable(tableName);

    const row: Record<string, unknown> = {};
    columns.forEach((col, index) => {
      row[col] = params[index] !== undefined ? params[index] : null;
    });

    const currentRows = this.getTable(tableName);
    currentRows.push(row);
    this.setTable(tableName, currentRows);
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

    const rows = this.getTable(tableName);
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
    this.setTable(tableName, rows);
    return this.createResultSet([], rowsAffected);
  }

  private handleDelete(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([a-zA-Z0-9_]+)\s*([<>=!]+)\s*\?)?/i);
    if (!match || !match[1]) {
      return this.createResultSet([]);
    }

    const tableName = match[1].toLowerCase();
    const rows = this.getTable(tableName);
    const initialLen = rows.length;

    if (!match[2]) {
      this.setTable(tableName, []);
      return this.createResultSet([], initialLen);
    }

    const targetCol = match[2].toLowerCase();
    const operator = match[3] || '=';
    const targetVal = params[0];

    let remaining: Record<string, unknown>[] = [];
    if (operator === '<') {
      remaining = rows.filter((r) => !(String(r[targetCol]) < String(targetVal)));
    } else if (operator === '<=') {
      remaining = rows.filter((r) => !(String(r[targetCol]) <= String(targetVal)));
    } else if (operator === '>') {
      remaining = rows.filter((r) => !(String(r[targetCol]) > String(targetVal)));
    } else if (operator === '>=') {
      remaining = rows.filter((r) => !(String(r[targetCol]) >= String(targetVal)));
    } else {
      remaining = rows.filter((r) => r[targetCol] !== targetVal);
    }

    this.setTable(tableName, remaining);
    return this.createResultSet([], initialLen - remaining.length);
  }

  private handleSelect(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const upper = sql.toUpperCase();

    if (upper.includes('FROM SCHEMA_MIGRATIONS')) {
      const rows = this.getTable('schema_migrations');
      const sorted = [...rows].sort((a, b) => Number(a.version) - Number(b.version));
      return this.createResultSet(sorted);
    }

    if (upper.includes('COUNT(*) AS COUNT') && upper.includes('FROM TRANSACTIONS')) {
      const rows = this.filterTransactions(params, sql);
      return this.createResultSet([{ count: rows.length }]);
    }

    if (upper.includes('SUM(CASE WHEN TYPE =') && upper.includes('FROM TRANSACTIONS')) {
      if (upper.includes('GROUP BY ACCOUNT_ID')) {
        const allTx = this.getTable('transactions');
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

      const rows = this.getTable('transactions').filter((tx) => {
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
    let rows = [...this.getTable(tableName)];

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
    } else if (tableName === 'system_logs') {
      rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }

    if (upper.includes('LIMIT ? OFFSET ?')) {
      const limitVal = Number(params[params.length - 2]);
      const offsetVal = Number(params[params.length - 1]);
      rows = rows.slice(offsetVal, offsetVal + limitVal);
    } else if (upper.includes('LIMIT ?')) {
      const limitVal = Number(params[params.length - 1]);
      rows = rows.slice(0, limitVal);
    }

    return this.createResultSet(rows);
  }

  private filterTransactions(
    params: (string | number | boolean | null)[],
    sql: string
  ): Record<string, unknown>[] {
    let rows = [...this.getTable('transactions')];
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
  private authDatabase: RNSQLiteDatabase | null = null;
  private userDatabase: RNSQLiteDatabase | null = null;
  private webStore: WebSQLiteStore | null = null;
  private activeUserId: string | null = null;
  private readonly authDatabaseName: string = 'orcamentofacil.db';

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

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  public async setActiveUser(userId: string | null): Promise<void> {
    if (this.activeUserId === userId && (userId === null || this.userDatabase !== null || this.webStore !== null)) {
      return;
    }

    if (this.userDatabase) {
      try {
        await this.userDatabase.close();
      } catch {}
      this.userDatabase = null;
    }

    this.activeUserId = userId;

    if (this.webStore) {
      this.webStore.setActiveUser(userId);
    }

    if (userId && (Platform.OS !== 'web' && hasNativeSQLite)) {
      await this.getUserDatabase();
    }
  }

  public async getAuthDatabase(): Promise<RNSQLiteDatabase | null> {
    const sqliteModule = getNativeSQLiteModule();
    if (!sqliteModule) {
      return null;
    }

    if (this.authDatabase) {
      return this.authDatabase;
    }

    try {
      this.authDatabase = await sqliteModule.openDatabase({
        name: this.authDatabaseName,
        location: 'default',
      });

      await this.authDatabase.executeSql('PRAGMA foreign_keys = ON;');
      await runMigrations(this.authDatabase);

      return this.authDatabase;
    } catch (error: unknown) {
      if (this.authDatabase) {
        try {
          await this.authDatabase.close();
        } catch {}
        this.authDatabase = null;
      }
      const message = formatSqliteErrorMessage(error);
      throw new Error(`Falha ao inicializar o banco de dados de autenticação SQLite: ${message}`);
    }
  }

  public async getUserDatabase(): Promise<RNSQLiteDatabase | null> {
    const sqliteModule = getNativeSQLiteModule();
    if (!sqliteModule) {
      return null;
    }

    if (this.userDatabase) {
      return this.userDatabase;
    }

    if (!this.activeUserId) {
      return this.getAuthDatabase();
    }

    const sanitizedId = this.activeUserId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const userDbName = `orcamentofacil_usr_${sanitizedId}.db`;

    try {
      this.userDatabase = await sqliteModule.openDatabase({
        name: userDbName,
        location: 'default',
      });

      await this.userDatabase.executeSql('PRAGMA foreign_keys = ON;');
      await runMigrations(this.userDatabase);
      await this.ensureDefaultCategories(this.userDatabase);

      return this.userDatabase;
    } catch (error: unknown) {
      if (this.userDatabase) {
        try {
          await this.userDatabase.close();
        } catch {}
        this.userDatabase = null;
      }
      const message = formatSqliteErrorMessage(error);
      throw new Error(`Falha ao inicializar o banco do usuário SQLite: ${message}`);
    }
  }

  private async ensureDefaultCategories(db: RNSQLiteDatabase): Promise<void> {
    try {
      const [res] = await db.executeSql('SELECT COUNT(*) as count FROM categories;');
      const count = res?.rows?.item(0)?.count ?? 0;
      if (count > 0) return;

      const defaults = [
        ['cat-alim', 'Alimentação', 'Supermercado, restaurantes, delivery', '#F59E0B', 'coffee', 0],
        ['cat-transp', 'Transporte', 'Combustível, transporte público, aplicativo', '#3B82F6', 'navigation', 0],
        ['cat-lazer', 'Lazer', 'Cinema, passeios, viagens, entretenimento', '#EC4899', 'smile', 0],
        ['cat-saude', 'Saúde', 'Farmácia, consultas, plano de saúde', '#EF4444', 'activity', 0],
        ['cat-educ', 'Educação', 'Cursos, livros, faculdade', '#8B5CF6', 'book', 0],
        ['cat-morad', 'Moradia', 'Aluguel, condomínio, luz, água, internet', '#10B981', 'home', 0],
        ['cat-sal', 'Salário', 'Remuneração principal, benefícios', '#22C55E', 'dollar-sign', 0],
        ['cat-serv', 'Serviços', 'Freelas, trabalhos extras, consultoria', '#6366F1', 'briefcase', 0],
        ['cat-outr', 'Outros', 'Despesas e receitas diversas', '#6B7280', 'grid', 0],
      ];

      for (const item of defaults) {
        await db.executeSql(
          'INSERT OR IGNORE INTO categories (id, name, description, color, icon, is_custom) VALUES (?, ?, ?, ?, ?, ?);',
          item
        );
      }
    } catch {}
  }

  public async getDatabase(): Promise<RNSQLiteDatabase | null> {
    if (this.activeUserId) {
      return this.getUserDatabase();
    }
    return this.getAuthDatabase();
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

    const trimmed = sql.trim();
    const isAuthQuery = /\b(users|system_logs)\b/i.test(trimmed);

    const db = isAuthQuery
      ? await this.getAuthDatabase()
      : await this.getUserDatabase();

    if (!db) {
      throw new Error('Banco de dados não inicializado.');
    }

    try {
      const [resultSet] = await db.executeSql(sql, params);
      return resultSet;
    } catch (error: unknown) {
      const message = formatSqliteErrorMessage(error);
      throw new Error(`Erro ao executar consulta SQL [${sql}]: ${message}`);
    }
  }

  public async close(): Promise<void> {
    if (Platform.OS === 'web' || !hasNativeSQLite) {
      return;
    }

    if (this.userDatabase) {
      try {
        await this.userDatabase.close();
        this.userDatabase = null;
      } catch (error: unknown) {
        const message = formatSqliteErrorMessage(error);
        throw new Error(`Erro ao fechar o banco de dados do usuário: ${message}`);
      }
    }

    if (this.authDatabase) {
      try {
        await this.authDatabase.close();
        this.authDatabase = null;
      } catch (error: unknown) {
        const message = formatSqliteErrorMessage(error);
        throw new Error(`Erro ao fechar o banco de dados de autenticação: ${message}`);
      }
    }
  }
}
