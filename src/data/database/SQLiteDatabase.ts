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
  deleteDatabase?: (options: { name: string; location: string }) => Promise<void>;
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
  private userVersions = new Map<string, number>();
  private tableColumns = new Map<string, Set<string>>();
  private activeUserId: string | null = null;

  public setActiveUser(userId: string | null): void {
    this.activeUserId = userId;
  }

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  public getUserVersion(): number {
    const key = this.activeUserId || 'default';
    return this.userVersions.get(key) ?? 0;
  }

  public setUserVersion(version: number): void {
    const key = this.activeUserId || 'default';
    this.userVersions.set(key, version);
  }

  public getTableColumns(tableName: string): string[] {
    const cols = this.tableColumns.get(tableName.toLowerCase());
    return cols ? Array.from(cols) : [];
  }

  private registerColumns(tableName: string, cols: string[]): void {
    const lower = tableName.toLowerCase();
    const existing = this.tableColumns.get(lower) ?? new Set<string>();
    for (const c of cols) {
      existing.add(c.toLowerCase());
    }
    this.tableColumns.set(lower, existing);
  }

  private getTable(tableName: string): Record<string, unknown>[] {
    const lower = tableName.toLowerCase();
    const isAuth = lower === 'users' || lower === 'system_logs';
    if (isAuth) {
      return this.authTables.get(lower) ?? [];
    }
    const key = this.activeUserId || 'default';
    let userStore = this.userStores.get(key);
    if (!userStore) {
      userStore = new Map<string, Record<string, unknown>[]>();
      this.userStores.set(key, userStore);
    }
    if (lower === 'categories' && !userStore.has('categories')) {
      this.seedDefaultCategoriesForStore(userStore);
    }
    return userStore.get(lower) ?? [];
  }

  private setTable(tableName: string, rows: Record<string, unknown>[]): void {
    const lower = tableName.toLowerCase();
    const isAuth = lower === 'users' || lower === 'system_logs';
    if (isAuth) {
      this.authTables.set(lower, rows);
      return;
    }
    const key = this.activeUserId || 'default';
    let userStore = this.userStores.get(key);
    if (!userStore) {
      userStore = new Map<string, Record<string, unknown>[]>();
      this.userStores.set(key, userStore);
    }
    userStore.set(lower, rows);
  }

  private createTable(tableName: string, rawSql?: string): void {
    const lower = tableName.toLowerCase();
    if (rawSql) {
      const bodyMatch = rawSql.match(/\(([\s\S]+)\)/);
      if (bodyMatch && bodyMatch[1]) {
        const lines = bodyMatch[1].split(',').map((l) => l.trim());
        const colNames: string[] = [];
        for (const line of lines) {
          const upperLine = line.toUpperCase();
          if (
            upperLine.startsWith('PRIMARY KEY') ||
            upperLine.startsWith('FOREIGN KEY') ||
            upperLine.startsWith('UNIQUE') ||
            upperLine.startsWith('CHECK')
          ) {
            continue;
          }
          const firstWord = line.split(/\s+/)[0]?.replace(/[^a-zA-Z0-9_]/g, '');
          if (firstWord) {
            colNames.push(firstWord.toLowerCase());
          }
        }
        this.registerColumns(lower, colNames);
      }
    }

    const isAuth = lower === 'users' || lower === 'system_logs';
    if (isAuth) {
      if (!this.authTables.has(lower)) {
        this.authTables.set(lower, []);
      }
      return;
    }
    const key = this.activeUserId || 'default';
    let userStore = this.userStores.get(key);
    if (!userStore) {
      userStore = new Map<string, Record<string, unknown>[]>();
      this.userStores.set(key, userStore);
    }
    if (!userStore.has(lower)) {
      if (lower === 'categories') {
        this.seedDefaultCategoriesForStore(userStore);
      } else {
        userStore.set(lower, []);
      }
    }
  }

  private deleteTable(tableName: string): void {
    const lower = tableName.toLowerCase();
    const isAuth = lower === 'users' || lower === 'system_logs';
    if (isAuth) {
      this.authTables.delete(lower);
      return;
    }
    const key = this.activeUserId || 'default';
    const userStore = this.userStores.get(key);
    if (userStore) {
      userStore.delete(lower);
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

    if (upper.startsWith('PRAGMA')) {
      const setVersionMatch = trimmed.match(/PRAGMA\s+user_version\s*=\s*(\d+)/i);
      if (setVersionMatch && setVersionMatch[1]) {
        this.setUserVersion( parseInt(setVersionMatch[1], 10));
        return this.createResultSet([]);
      }
      if (/PRAGMA\s+user_version/i.test(trimmed)) {
        return this.createResultSet([{ user_version: this.getUserVersion() }]);
      }
      if (/PRAGMA\s+table_info\(([a-zA-Z0-9_]+)\)/i.test(trimmed)) {
        const tMatch = trimmed.match(/PRAGMA\s+table_info\(([a-zA-Z0-9_]+)\)/i);
        const tName = tMatch && tMatch[1] ? tMatch[1].toLowerCase() : '';
        const cols = this.getTableColumns(tName).map((name, idx) => ({ cid: idx, name }));
        return this.createResultSet(cols);
      }
      return this.createResultSet([]);
    }

    if (upper.startsWith('BEGIN') || upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
      return this.createResultSet([]);
    }

    if (upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX')) {
      return this.createResultSet([]);
    }

    if (upper.startsWith('ALTER TABLE')) {
      const alterMatch = trimmed.match(/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?([a-zA-Z0-9_]+)/i);
      if (alterMatch && alterMatch[1] && alterMatch[2]) {
        const tbl = alterMatch[1].toLowerCase();
        const col = alterMatch[2].toLowerCase();
        const existingCols = this.tableColumns.get(tbl);
        if (existingCols && existingCols.has(col)) {
          throw new Error(`duplicate column name: ${col}`);
        }
        this.registerColumns(tbl, [col]);
        const defaultMatch = trimmed.match(/DEFAULT\s+('[^']*'|\d+(?:\.\d+)?)/i);
        if (defaultMatch && defaultMatch[1] !== undefined) {
          const rawDefault = defaultMatch[1];
          const val = rawDefault.startsWith("'")
            ? rawDefault.slice(1, -1)
            : Number(rawDefault);
          const rows = this.getTable(tbl);
          for (const r of rows) {
            if (r[col] === undefined) {
              r[col] = val;
            }
          }
          this.setTable(tbl, rows);
        }
      }
      return this.createResultSet([]);
    }

    if (upper.startsWith('CREATE TABLE')) {
      const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        this.createTable(match[1].toLowerCase(), trimmed);
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

    if (upper.startsWith('INSERT')) {
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
    const isIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
    const isReplace = /INSERT\s+OR\s+REPLACE\s+INTO/i.test(sql);
    const match = sql.match(/INSERT\s+(?:OR\s+(?:IGNORE|REPLACE)\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
    if (!match || !match[1] || !match[2]) {
      return this.createResultSet([]);
    }

    const tableName = match[1].toLowerCase();
    const columns = match[2].split(',').map((c) => c.trim().toLowerCase());

    this.createTable(tableName);
    this.registerColumns(tableName, columns);

    const row: Record<string, unknown> = {};
    columns.forEach((col, index) => {
      row[col] = params[index] !== undefined ? params[index] : null;
    });

    const currentRows = this.getTable(tableName);

    if (isReplace) {
      let filtered = currentRows;
      if (tableName === 'daily_limits') {
        filtered = currentRows.filter((r) => Number(r.day_of_week) !== Number(row.day_of_week));
      } else if (tableName === 'app_settings') {
        filtered = currentRows.filter((r) => String(r.key) !== String(row.key));
      } else if (tableName === 'category_spending_goals') {
        filtered = currentRows.filter(
          (r) => r.id !== row.id && String(r.category_id) !== String(row.category_id)
        );
      } else if (tableName === 'bill_payments') {
        filtered = currentRows.filter(
          (r) =>
            r.id !== row.id &&
            !(
              String(r.bill_id) === String(row.bill_id) &&
              Number(r.month) === Number(row.month) &&
              Number(r.year) === Number(row.year)
            )
        );
      } else if (tableName === 'transaction_tags') {
        filtered = currentRows.filter(
          (r) =>
            !(
              String(r.transaction_id) === String(row.transaction_id) &&
              String(r.tag_id) === String(row.tag_id)
            )
        );
      } else if (row.id !== undefined) {
        filtered = currentRows.filter((r) => r.id !== row.id);
      }
      filtered.push(row);
      this.setTable(tableName, filtered);
      return this.createResultSet([], 1, 1);
    }

    if (isIgnore) {
      if (tableName === 'tags') {
        const exists = currentRows.some(
          (r) => r.id === row.id || String(r.name).toLowerCase() === String(row.name).toLowerCase()
        );
        if (exists) return this.createResultSet([], 0, 0);
      } else if (tableName === 'transaction_tags') {
        const exists = currentRows.some(
          (r) => r.transaction_id === row.transaction_id && r.tag_id === row.tag_id
        );
        if (exists) return this.createResultSet([], 0, 0);
      } else if (tableName === 'schema_migrations') {
        const exists = currentRows.some((r) => Number(r.version) === Number(row.version));
        if (exists) return this.createResultSet([], 0, 0);
      } else if (row.id !== undefined) {
        const exists = currentRows.some((r) => r.id === row.id);
        if (exists) return this.createResultSet([], 0, 0);
      }
    }

    currentRows.push(row);
    this.setTable(tableName, currentRows);
    return this.createResultSet([], 1, 1);
  }

  private handleUpdate(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    const tableMatch = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?);?$/i);
    if (!tableMatch || !tableMatch[1] || !tableMatch[2] || !tableMatch[3]) {
      return this.createResultSet([]);
    }

    const tableName = tableMatch[1].toLowerCase();
    const setClause = tableMatch[2];
    const whereClause = tableMatch[3].trim();
    const columns = setClause.split(',').map((part) => part.split('=')[0].trim().toLowerCase());

    const rows = this.getTable(tableName);
    let rowsAffected = 0;

    if (/installment_group_id\s*=\s*\?\s+AND\s+installment_number\s*>=\s*\?/i.test(whereClause)) {
      const groupId = params[columns.length];
      const minNum = Number(params[columns.length + 1]);
      for (const row of rows) {
        if (row.installment_group_id === groupId && Number(row.installment_number) >= minNum) {
          columns.forEach((col, index) => {
            row[col] = params[index];
          });
          rowsAffected++;
        }
      }
    } else if (/recurrence_parent_id\s*=\s*\?/i.test(whereClause)) {
      const parentId = params[columns.length];
      for (const row of rows) {
        if (row.recurrence_parent_id === parentId || row.id === parentId) {
          columns.forEach((col, index) => {
            row[col] = params[index];
          });
          rowsAffected++;
        }
      }
    } else {
      const whereId = params[params.length - 1];
      for (const row of rows) {
        if (row.id === whereId) {
          columns.forEach((col, index) => {
            row[col] = params[index];
          });
          rowsAffected++;
        }
      }
    }

    this.setTable(tableName, rows);
    return this.createResultSet([], rowsAffected);
  }

  private handleDelete(sql: string, params: (string | number | boolean | null)[]): ResultSet {
    if (/DELETE\s+FROM\s+zero_based_allocations\s+WHERE\s+month\s*=\s*\?\s+AND\s+year\s*=\s*\?/i.test(sql)) {
      const month = Number(params[0]);
      const year = Number(params[1]);
      const rows = this.getTable('zero_based_allocations');
      const remaining = rows.filter((r) => !(Number(r.month) === month && Number(r.year) === year));
      this.setTable('zero_based_allocations', remaining);
      return this.createResultSet([], rows.length - remaining.length);
    }
    if (/DELETE\s+FROM\s+bill_payments\s+WHERE\s+bill_id\s*=\s*\?\s+AND\s+month\s*=\s*\?\s+AND\s+year\s*=\s*\?/i.test(sql)) {
      const billId = String(params[0]);
      const month = Number(params[1]);
      const year = Number(params[2]);
      const rows = this.getTable('bill_payments');
      const remaining = rows.filter(
        (r) =>
          !(
            String(r.bill_id) === billId &&
            Number(r.month) === month &&
            Number(r.year) === year
          )
      );
      this.setTable('bill_payments', remaining);
      return this.createResultSet([], rows.length - remaining.length);
    }
    if (/DELETE\s+FROM\s+transactions\s+WHERE\s+installment_group_id\s*=\s*\?\s+AND\s+installment_number\s*>=\s*\?/i.test(sql)) {
      const groupId = params[0];
      const minNum = Number(params[1]);
      const rows = this.getTable('transactions');
      const initialLen = rows.length;
      const deletedIds = new Set<string>();
      const remaining = rows.filter((r) => {
        const match = r.installment_group_id === groupId && Number(r.installment_number) >= minNum;
        if (match && typeof r.id === 'string') {
          deletedIds.add(r.id);
        }
        return !match;
      });
      this.setTable('transactions', remaining);
      if (deletedIds.size > 0) {
        const txTags = this.getTable('transaction_tags').filter(
          (tt) => !deletedIds.has(String(tt.transaction_id))
        );
        this.setTable('transaction_tags', txTags);
      }
      return this.createResultSet([], initialLen - remaining.length);
    }

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

    if (tableName === 'transactions' && targetCol === 'id' && operator === '=') {
      const txTags = this.getTable('transaction_tags').filter((tt) => tt.transaction_id !== targetVal);
      this.setTable('transaction_tags', txTags);
    }
    if (tableName === 'recurring_bills' && targetCol === 'id' && operator === '=') {
      const payments = this.getTable('bill_payments').filter((bp) => bp.bill_id !== targetVal);
      this.setTable('bill_payments', payments);
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

    if (upper.includes('FROM TRANSACTION_TAGS') && upper.includes('JOIN TAGS') && !upper.includes('FROM TRANSACTIONS')) {
      const txTags = this.getTable('transaction_tags');
      const allTags = this.getTable('tags');
      const tagMap = new Map<string, string>();
      for (const t of allTags) {
        tagMap.set(String(t.id), String(t.name));
      }

      if (upper.includes('WHERE TT.TRANSACTION_ID = ?') || upper.includes('WHERE TRANSACTION_ID = ?')) {
        const txId = String(params[0]);
        const matched = txTags
          .filter((tt) => String(tt.transaction_id) === txId)
          .map((tt) => ({
            transaction_id: txId,
            tag_id: tt.tag_id,
            name: tagMap.get(String(tt.tag_id)) ?? '',
          }))
          .filter((item) => Boolean(item.name));
        return this.createResultSet(matched);
      }

      const allMapped = txTags
        .map((tt) => ({
          transaction_id: tt.transaction_id,
          tag_id: tt.tag_id,
          name: tagMap.get(String(tt.tag_id)) ?? '',
        }))
        .filter((item) => Boolean(item.name));
      return this.createResultSet(allMapped);
    }

    if (upper.includes('FROM TAGS')) {
      let rows = [...this.getTable('tags')];
      if (upper.includes('WHERE NAME = ?') || upper.includes('WHERE LOWER(NAME) = ?')) {
        const target = String(params[0]).toLowerCase().trim();
        rows = rows.filter((r) => String(r.name).toLowerCase() === target);
      } else if (upper.includes('WHERE NAME LIKE ?')) {
        const pattern = String(params[0]).replace(/%/g, '').toLowerCase();
        rows = rows.filter((r) => String(r.name).toLowerCase().includes(pattern));
      }
      rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return this.createResultSet(rows);
    }

    if (upper.includes('GROUP BY SUBSTR(DATE, 1, 7)') && upper.includes('FROM TRANSACTIONS')) {
      const catId = String(params[0]);
      const allTx = this.getTable('transactions').filter((tx) => {
        if (String(tx.category_id) !== catId) return false;
        if (upper.includes("STATUS = 'CONFIRMADA'") && tx.status !== 'confirmada') return false;
        if (upper.includes("TYPE = 'DESPESA'") && tx.type !== 'despesa') return false;
        return true;
      });

      const grouped = new Map<string, { total: number; count: number }>();
      for (const tx of allTx) {
        const ym = String(tx.date).substring(0, 7);
        const cur = grouped.get(ym) ?? { total: 0, count: 0 };
        cur.total = Number((cur.total + Number(tx.value)).toFixed(2));
        cur.count += 1;
        grouped.set(ym, cur);
      }

      const resultRows = Array.from(grouped.entries())
        .map(([year_month, data]) => ({
          year_month,
          total: data.total,
          count: data.count,
        }))
        .sort((a, b) => b.year_month.localeCompare(a.year_month));

      return this.createResultSet(resultRows);
    }

    if (upper.includes('COUNT(*) AS COUNT') && upper.includes('FROM TRANSACTIONS')) {
      if (upper.includes('WHERE CATEGORY_ID = ?') && params.length === 1 && !upper.includes('AND')) {
        const catId = params[0];
        const count = this.getTable('transactions').filter((r) => r.category_id === catId).length;
        return this.createResultSet([{ count }]);
      }
      const rows = this.filterTransactions(params, sql);
      return this.createResultSet([{ count: rows.length }]);
    }

    if (upper.includes('SUM(CASE WHEN TYPE =') && upper.includes('FROM TRANSACTIONS')) {
      if (upper.includes('GROUP BY ACCOUNT_ID')) {
        const allTx = this.getTable('transactions');
        const grouped = new Map<string, { total_income: number; total_expense: number; fixed_income: number; extra_income: number }>();
        const maxDateParam = params.length > 0 && typeof params[0] === 'string' ? String(params[0]).substring(0, 10) : null;

        for (const tx of allTx) {
          if (tx.status !== 'confirmada') continue;
          const txDay = String(tx.date).substring(0, 10);
          if (maxDateParam && txDay > maxDateParam) continue;

          const accId = String(tx.account_id);
          const current = grouped.get(accId) ?? { total_income: 0, total_expense: 0, fixed_income: 0, extra_income: 0 };
          const val = Number(tx.value);
          if (tx.type === 'receita') {
            current.total_income += val;
            if (Number(tx.is_extra_income) === 1) {
              current.extra_income += val;
            } else {
              current.fixed_income += val;
            }
          }
          if (tx.type === 'despesa') {
            current.total_expense += val;
          }
          grouped.set(accId, current);
        }

        const resultRows = Array.from(grouped.entries()).map(([account_id, totals]) => ({
          account_id,
          total_income: totals.total_income,
          total_expense: totals.total_expense,
          fixed_income: totals.fixed_income,
          extra_income: totals.extra_income,
        }));

        return this.createResultSet(resultRows);
      }

      if (upper.includes('SUBSTR(DATE, 1, 10) < ?')) {
        const beforeDay = String(params[0]).substring(0, 10);
        const accountId = params.length > 1 && params[1] ? String(params[1]) : undefined;
        const rows = this.getTable('transactions').filter((tx) => {
          if (tx.status !== 'confirmada') return false;
          if (accountId && tx.account_id !== accountId) return false;
          return String(tx.date).substring(0, 10) < beforeDay;
        });
        let totalIncome = 0;
        let totalExpense = 0;
        let fixedIncome = 0;
        let extraIncome = 0;
        for (const tx of rows) {
          const val = Number(tx.value);
          if (tx.type === 'receita') {
            totalIncome += val;
            if (Number(tx.is_extra_income) === 1) {
              extraIncome += val;
            } else {
              fixedIncome += val;
            }
          }
          if (tx.type === 'despesa') totalExpense += val;
        }
        return this.createResultSet([
          {
            total_income: totalIncome,
            total_expense: totalExpense,
            fixed_income: fixedIncome,
            extra_income: extraIncome,
          },
        ]);
      }

      if (upper.includes('WHERE ACCOUNT_ID = ?') && !upper.includes('SUBSTR(DATE, 1, 10) >=')) {
        const accountId = String(params[0]);
        const maxDateParam = params.length > 1 && typeof params[1] === 'string' ? String(params[1]).substring(0, 10) : null;
        const rows = this.getTable('transactions').filter((tx) => {
          if (tx.account_id !== accountId || tx.status !== 'confirmada') return false;
          if (maxDateParam && String(tx.date).substring(0, 10) > maxDateParam) return false;
          return true;
        });
        let totalIncome = 0;
        let totalExpense = 0;
        let fixedIncome = 0;
        let extraIncome = 0;
        for (const tx of rows) {
          const val = Number(tx.value);
          if (tx.type === 'receita') {
            totalIncome += val;
            if (Number(tx.is_extra_income) === 1) {
              extraIncome += val;
            } else {
              fixedIncome += val;
            }
          }
          if (tx.type === 'despesa') totalExpense += val;
        }
        return this.createResultSet([
          {
            total_income: totalIncome,
            total_expense: totalExpense,
            fixed_income: fixedIncome,
            extra_income: extraIncome,
          },
        ]);
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
      let fixedIncome = 0;
      let extraIncome = 0;

      for (const tx of rows) {
        const val = Number(tx.value);
        if (tx.type === 'receita') {
          totalIncome += val;
          if (Number(tx.is_extra_income) === 1) {
            extraIncome += val;
          } else {
            fixedIncome += val;
          }
        }
        if (tx.type === 'despesa') totalExpense += val;
      }

      return this.createResultSet([
        {
          total_income: totalIncome,
          total_expense: totalExpense,
          fixed_income: fixedIncome,
          extra_income: extraIncome,
        },
      ]);
    }

    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch || !fromMatch[1]) {
      return this.createResultSet([]);
    }

    const tableName = fromMatch[1].toLowerCase();
    let rows = [...this.getTable(tableName)];

    if (tableName === 'transactions') {
      if (sql.includes('WHERE id = ?')) {
        const targetId = params[0];
        rows = rows.filter((r) => r.id === targetId);
      } else {
        rows = this.filterTransactions(params, sql);
      }
    } else if (sql.includes('WHERE id = ?')) {
      const targetId = params[0];
      rows = rows.filter((r) => r.id === targetId);
    } else if (sql.includes('WHERE username = ?') || sql.includes('WHERE LOWER(username) = ?')) {
      const targetUsername = String(params[0]).toLowerCase();
      rows = rows.filter((r) => String(r.username || '').toLowerCase() === targetUsername);
    } else if (sql.includes('WHERE email = ?') || sql.includes('WHERE LOWER(email) = ?')) {
      if (sql.includes('OR LOWER(username) = ?') || sql.includes('OR username = ?')) {
        const target = String(params[0]).toLowerCase();
        rows = rows.filter(
          (r) =>
            String(r.email || '').toLowerCase() === target ||
            String(r.username || '').toLowerCase() === target
        );
      } else {
        const targetEmail = String(params[0]).toLowerCase();
        rows = rows.filter((r) => String(r.email).toLowerCase() === targetEmail);
      }
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
          (r.period_type ?? 'mensal') === periodType
      );
    } else if (tableName === 'budgets' && sql.includes('WHERE month = ? AND year = ? AND period_type = ?')) {
      const month = params[0];
      const year = params[1];
      const periodType = params[2];
      rows = rows
        .filter(
          (r) =>
            Number(r.month) === Number(month) &&
            Number(r.year) === Number(year) &&
            (r.period_type ?? 'mensal') === periodType
        )
        .sort((a, b) => Number(b.limit_value) - Number(a.limit_value));
    } else if (tableName === 'budgets' && sql.includes('WHERE year = ? AND period_type = ?')) {
      const year = params[0];
      const periodType = params[1];
      rows = rows
        .filter((r) => Number(r.year) === Number(year) && (r.period_type ?? 'mensal') === periodType)
        .sort((a, b) => Number(b.limit_value) - Number(a.limit_value));
    } else if (tableName === 'budgets' && sql.includes('WHERE month = ? AND year = ?')) {
      const month = params[0];
      const year = params[1];
      rows = rows
        .filter(
          (r) =>
            Number(r.month) === Number(month) &&
            Number(r.year) === Number(year) &&
            (r.period_type ?? 'mensal') === 'mensal'
        )
        .sort((a, b) => Number(b.limit_value) - Number(a.limit_value));
    } else if (tableName === 'zero_based_allocations' && sql.includes('WHERE month = ? AND year = ?')) {
      const month = Number(params[0]);
      const year = Number(params[1]);
      rows = rows.filter((r) => Number(r.month) === month && Number(r.year) === year);
    } else if (tableName === 'daily_limits' && sql.includes('WHERE day_of_week = ?')) {
      const dow = Number(params[0]);
      rows = rows.filter((r) => Number(r.day_of_week) === dow);
    } else if (tableName === 'app_settings' && sql.includes('WHERE key = ?')) {
      const k = String(params[0]);
      rows = rows.filter((r) => String(r.key) === k);
    } else if (tableName === 'category_spending_goals' && sql.includes('WHERE category_id = ?')) {
      const catId = String(params[0]);
      rows = rows.filter((r) => String(r.category_id) === catId);
    } else if (tableName === 'recurring_bills') {
      if (sql.includes('WHERE is_active = 1')) {
        rows = rows.filter((r) => Number(r.is_active ?? 1) === 1);
      }
      rows.sort((a, b) => Number(a.due_day) - Number(b.due_day));
    } else if (tableName === 'bill_payments') {
      if (sql.includes('WHERE bill_id = ? AND month = ? AND year = ?')) {
        const billId = String(params[0]);
        const month = Number(params[1]);
        const year = Number(params[2]);
        rows = rows.filter(
          (r) =>
            String(r.bill_id) === billId &&
            Number(r.month) === month &&
            Number(r.year) === year
        );
      } else if (sql.includes('WHERE month = ? AND year = ?')) {
        const month = Number(params[0]);
        const year = Number(params[1]);
        rows = rows.filter((r) => Number(r.month) === month && Number(r.year) === year);
      } else if (sql.includes('WHERE bill_id = ?')) {
        const billId = String(params[0]);
        rows = rows.filter((r) => String(r.bill_id) === billId);
      }
    } else if (tableName === 'events') {
      rows.sort((a, b) => String(b.start_date ?? '').localeCompare(String(a.start_date ?? '')));
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

  private getTagMatchedTransactionIds(searchLower: string, exactOnly: boolean = false): Set<string> {
    const matchedTagIds = new Set<string>();
    const tags = this.getTable('tags');
    for (const t of tags) {
      const nameLower = String(t.name).toLowerCase();
      if (exactOnly ? nameLower === searchLower : nameLower.includes(searchLower)) {
        matchedTagIds.add(String(t.id));
      }
    }

    const matchedTxIds = new Set<string>();
    if (matchedTagIds.size > 0) {
      const txTags = this.getTable('transaction_tags');
      for (const tt of txTags) {
        if (matchedTagIds.has(String(tt.tag_id))) {
          matchedTxIds.add(String(tt.transaction_id));
        }
      }
    }
    return matchedTxIds;
  }

  private filterTransactions(
    params: (string | number | boolean | null)[],
    sql: string
  ): Record<string, unknown>[] {
    let rows = [...this.getTable('transactions')];
    const upper = sql.toUpperCase();

    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:ORDER\s+BY|GROUP\s+BY|LIMIT|;|$)/i);
    if (whereMatch && whereMatch[1]) {
      const rawWhere = whereMatch[1].trim();
      const parts = rawWhere.split(/\s+AND\s+/i);
      let paramIdx = 0;

      for (const part of parts) {
        const cleanPart = part.trim();
        const qCount = (cleanPart.match(/\?/g) || []).length;
        const partParams = params.slice(paramIdx, paramIdx + qCount);
        paramIdx += qCount;

        if (/^account_id\s*=\s*\?$/i.test(cleanPart)) {
          const val = partParams[0];
          rows = rows.filter((r) => r.account_id === val);
        } else if (/^category_id\s*=\s*\?$/i.test(cleanPart)) {
          const val = partParams[0];
          rows = rows.filter((r) => r.category_id === val);
        } else if (/^category_id\s+IN\s*\(/i.test(cleanPart)) {
          const set = new Set(partParams.map(String));
          rows = rows.filter((r) => set.has(String(r.category_id)));
        } else if (/^value\s*>=\s*\?$/i.test(cleanPart)) {
          const min = Number(partParams[0]);
          rows = rows.filter((r) => Number(r.value) >= min);
        } else if (/^value\s*<=\s*\?$/i.test(cleanPart)) {
          const max = Number(partParams[0]);
          rows = rows.filter((r) => Number(r.value) <= max);
        } else if (/^type\s*=\s*\?$/i.test(cleanPart)) {
          const t = partParams[0];
          rows = rows.filter((r) => r.type === t);
        } else if (/^status\s*=\s*\?$/i.test(cleanPart)) {
          const st = partParams[0];
          rows = rows.filter((r) => (r.status ?? 'confirmada') === st);
        } else if (/^status\s*=\s*'confirmada'$/i.test(cleanPart)) {
          rows = rows.filter((r) => (r.status ?? 'confirmada') === 'confirmada');
        } else if (/^is_extra_income\s*=\s*\?$/i.test(cleanPart)) {
          const flag = Number(partParams[0]);
          rows = rows.filter((r) => Number(r.is_extra_income ?? 0) === flag);
        } else if (/^is_recurring\s*=\s*\?$/i.test(cleanPart)) {
          const flag = Number(partParams[0]);
          rows = rows.filter((r) => Number(r.is_recurring ?? 0) === flag);
        } else if (/^recurrence_parent_id\s*=\s*\?$/i.test(cleanPart)) {
          const parentId = partParams[0];
          rows = rows.filter((r) => r.recurrence_parent_id === parentId);
        } else if (/^installment_group_id\s*=\s*\?$/i.test(cleanPart)) {
          const groupId = partParams[0];
          rows = rows.filter((r) => r.installment_group_id === groupId);
        } else if (/^event_id\s*=\s*\?$/i.test(cleanPart)) {
          const evId = partParams[0];
          rows = rows.filter((r) => r.event_id === evId);
        } else if (/^event_id\s+IS\s+NULL$/i.test(cleanPart)) {
          rows = rows.filter((r) => !r.event_id);
        } else if (/^installment_number\s*>=\s*\?$/i.test(cleanPart)) {
          const minNum = Number(partParams[0]);
          rows = rows.filter((r) => Number(r.installment_number ?? 0) >= minNum);
        } else if (/^date\s*>=\s*\?$/i.test(cleanPart)) {
          const start = String(partParams[0]);
          rows = rows.filter((r) => String(r.date) >= start);
        } else if (/^date\s*<=\s*\?$/i.test(cleanPart)) {
          const end = String(partParams[0]);
          rows = rows.filter((r) => String(r.date) <= end);
        } else if (/^substr\(date,\s*1,\s*10\)\s*>=\s*\?$/i.test(cleanPart)) {
          const minDay = String(partParams[0]).substring(0, 10);
          rows = rows.filter((r) => String(r.date).substring(0, 10) >= minDay);
        } else if (/^substr\(date,\s*1,\s*10\)\s*<=\s*\?$/i.test(cleanPart)) {
          const maxDay = String(partParams[0]).substring(0, 10);
          rows = rows.filter((r) => String(r.date).substring(0, 10) <= maxDay);
        } else if (/^substr\(date,\s*1,\s*10\)\s*<\s*\?$/i.test(cleanPart)) {
          const beforeDay = String(partParams[0]).substring(0, 10);
          rows = rows.filter((r) => String(r.date).substring(0, 10) < beforeDay);
        } else if (/^substr\(date,\s*1,\s*7\)\s*=\s*\?$/i.test(cleanPart)) {
          const ym = String(partParams[0]);
          rows = rows.filter((r) => String(r.date).substring(0, 7) === ym);
        } else if (cleanPart.toUpperCase().includes('DESCRIPTION LIKE ?')) {
          const rawSearch = String(partParams[0] ?? '').replace(/%/g, '').toLowerCase();
          const tagTxIds = this.getTagMatchedTransactionIds(rawSearch, false);
          rows = rows.filter((r) => {
            const descMatch = String(r.description ?? '').toLowerCase().includes(rawSearch);
            const notesMatch = String(r.notes ?? '').toLowerCase().includes(rawSearch);
            const jsonTagsMatch = String(r.tags ?? '').toLowerCase().includes(rawSearch);
            const normTagMatch = tagTxIds.has(String(r.id));
            return descMatch || notesMatch || jsonTagsMatch || normTagMatch;
          });
        } else if (cleanPart.toUpperCase().includes('TRANSACTION_TAGS')) {
          const rawTag = String(partParams[0] ?? '').replace(/%/g, '').toLowerCase().trim();
          const tagTxIds = this.getTagMatchedTransactionIds(rawTag, true);
          rows = rows.filter((r) => {
            if (tagTxIds.has(String(r.id))) return true;
            try {
              const arr = JSON.parse(String(r.tags ?? '[]')) as string[];
              return arr.some((t) => String(t).toLowerCase().trim() === rawTag);
            } catch {
              return false;
            }
          });
        }
      }
    }

    const isAsc = /ORDER\s+BY\s+[^;]*\bASC\b/i.test(sql);
    if (upper.includes('ORDER BY VALUE')) {
      rows.sort((a, b) => (isAsc ? Number(a.value) - Number(b.value) : Number(b.value) - Number(a.value)));
    } else if (upper.includes('ORDER BY CATEGORY_ID')) {
      rows.sort((a, b) =>
        isAsc
          ? String(a.category_id).localeCompare(String(b.category_id))
          : String(b.category_id).localeCompare(String(a.category_id))
      );
    } else if (upper.includes('ORDER BY INSTALLMENT_NUMBER ASC')) {
      rows.sort((a, b) => Number(a.installment_number ?? 0) - Number(b.installment_number ?? 0));
    } else {
      rows.sort((a, b) => {
        const dateA = String(a.date);
        const dateB = String(b.date);
        const cmp = isAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
        if (cmp !== 0) return cmp;
        const createdA = String(a.created_at ?? '');
        const createdB = String(b.created_at ?? '');
        const createdCmp = isAsc ? createdA.localeCompare(createdB) : createdB.localeCompare(createdA);
        if (createdCmp !== 0) return createdCmp;
        return isAsc ? String(a.id).localeCompare(String(b.id)) : String(b.id).localeCompare(String(a.id));
      });
    }

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
  private authDbInitPromise: Promise<RNSQLiteDatabase | null> | null = null;
  private userDatabase: RNSQLiteDatabase | null = null;
  private userDatabases = new Map<string, RNSQLiteDatabase>();
  private userDbInitPromises = new Map<string, Promise<RNSQLiteDatabase | null>>();
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

  public createMockDatabaseAdapter(): RNSQLiteDatabase {
    if (!this.webStore) {
      this.webStore = new WebSQLiteStore();
    }
    const store = this.webStore;
    return {
      executeSql: async (sql: string, params: (string | number | boolean | null)[] = []) => {
        const res = store.execute(sql, params);
        return [res];
      },
      transaction: async () => {},
      readTransaction: async () => {},
      close: async () => {},
      attach: async () => {},
      dettach: async () => {},
    } as unknown as RNSQLiteDatabase;
  }

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  public async setActiveUser(userId: string | null): Promise<void> {
    this.activeUserId = userId;

    if (this.webStore) {
      this.webStore.setActiveUser(userId);
    }

    if (!userId) {
      this.userDatabase = null;
      return;
    }

    if (Platform.OS !== 'web' && hasNativeSQLite) {
      this.userDatabase = await this.getUserDatabase();
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

    if (this.authDbInitPromise) {
      return this.authDbInitPromise;
    }

    this.authDbInitPromise = (async () => {
      try {
        const db = await sqliteModule.openDatabase({
          name: this.authDatabaseName,
          location: 'default',
        });

        await db.executeSql('PRAGMA foreign_keys = ON;');
        await runMigrations(db);

        this.authDatabase = db;
        return db;
      } catch {
        try {
          if (sqliteModule.deleteDatabase) {
            await sqliteModule.deleteDatabase({
              name: this.authDatabaseName,
              location: 'default',
            });
          }
          const repairedDb = await sqliteModule.openDatabase({
            name: this.authDatabaseName,
            location: 'default',
          });
          await repairedDb.executeSql('PRAGMA foreign_keys = ON;');
          await runMigrations(repairedDb);
          this.authDatabase = repairedDb;
          return repairedDb;
        } catch {
          const fallbackDb = this.createMockDatabaseAdapter();
          await runMigrations(fallbackDb);
          this.authDatabase = fallbackDb;
          return fallbackDb;
        }
      }
    })();

    return this.authDbInitPromise;
  }

  public async getUserDatabase(): Promise<RNSQLiteDatabase | null> {
    const sqliteModule = getNativeSQLiteModule();
    if (!sqliteModule) {
      return null;
    }

    if (!this.activeUserId) {
      return this.getAuthDatabase();
    }

    const sanitizedId = this.activeUserId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const userDbName = `orcamentofacil_usr_${sanitizedId}.db`;

    const existingDb = this.userDatabases.get(userDbName);
    if (existingDb) {
      this.userDatabase = existingDb;
      return existingDb;
    }

    const existingPromise = this.userDbInitPromises.get(userDbName);
    if (existingPromise) {
      const db = await existingPromise;
      if (this.activeUserId && `orcamentofacil_usr_${this.activeUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.db` === userDbName) {
        this.userDatabase = db;
      }
      return db;
    }

    const initPromise = (async () => {
      try {
        const db = await sqliteModule.openDatabase({
          name: userDbName,
          location: 'default',
        });

        await db.executeSql('PRAGMA foreign_keys = ON;');
        await runMigrations(db);
        await this.ensureDefaultCategories(db);

        this.userDatabases.set(userDbName, db);
        this.userDatabase = db;
        return db;
      } catch {
        try {
          if (sqliteModule.deleteDatabase) {
            await sqliteModule.deleteDatabase({
              name: userDbName,
              location: 'default',
            });
          }
          const repairedDb = await sqliteModule.openDatabase({
            name: userDbName,
            location: 'default',
          });
          await repairedDb.executeSql('PRAGMA foreign_keys = ON;');
          await runMigrations(repairedDb);
          await this.ensureDefaultCategories(repairedDb);
          this.userDatabases.set(userDbName, repairedDb);
          this.userDatabase = repairedDb;
          return repairedDb;
        } catch {
          const fallbackDb = this.createMockDatabaseAdapter();
          await runMigrations(fallbackDb);
          await this.ensureDefaultCategories(fallbackDb);
          this.userDatabases.set(userDbName, fallbackDb);
          this.userDatabase = fallbackDb;
          return fallbackDb;
        }
      }
    })();

    this.userDbInitPromises.set(userDbName, initPromise);
    return initPromise;
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
