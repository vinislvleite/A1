import { DatabaseManager } from '../src/data/database/SQLiteDatabase';
import { runMigrations } from '../src/data/database/migrations';
import { migration001Initial } from '../src/data/database/migrations/migration_001_initial';
import { migration002SystemLogs } from '../src/data/database/migrations/migration_002_system_logs';
import { migration003AddUsername } from '../src/data/database/migrations/migration_003_add_username';
import { setupUserDatabase, openedDatabases, tableColumns } from './helpers/db';

describe('Infra e Migrações - Schema Sprint 1 para Sprint 2 (Blocos A, B, C, D)', () => {
  let db: DatabaseManager;

  beforeAll(async () => {
    db = await setupUserDatabase('user-sprint2-infra');
  });

  it('abre um arquivo de banco isolado por usuário', () => {
    expect(openedDatabases()).toContain('orcamentofacil_usr_user-sprint2-infra.db');
  });

  it('aplica todas as migrations até a versão 7', async () => {
    const res = await db.executeQuery('SELECT version FROM schema_migrations ORDER BY version;');
    const versions = Array.from({ length: res.rows.length }, (_, i) =>
      Number((res.rows.item(i) as { version: number }).version)
    );
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const pragma = await db.executeQuery('PRAGMA user_version;');
    expect(Number((pragma.rows.item(0) as { user_version: number }).user_version)).toBe(7);
  });

  it('cria todas as tabelas novas da Sprint 2', async () => {
    const res = await db.executeQuery("SELECT name FROM sqlite_master WHERE type='table';");
    const tables = Array.from({ length: res.rows.length }, (_, i) =>
      String((res.rows.item(i) as { name: string }).name)
    );
    for (const t of [
      'tags',
      'transaction_tags',
      'zero_based_allocations',
      'events',
      'daily_limits',
      'app_settings',
      'category_spending_goals',
      'recurring_bills',
      'bill_payments',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('adiciona as colunas novas em transactions, accounts, budgets e categories', async () => {
    expect(await tableColumns('transactions')).toEqual(
      expect.arrayContaining([
        'recurrence_parent_id',
        'installment_group_id',
        'installment_number',
        'installment_total',
        'is_extra_income',
        'income_source',
        'color_label',
        'event_id',
        'status',
      ])
    );
    expect(await tableColumns('accounts')).toEqual(
      expect.arrayContaining(['credit_limit', 'closing_day', 'due_day'])
    );
    expect(await tableColumns('budgets')).toEqual(
      expect.arrayContaining(['budget_mode', 'percentage_value'])
    );
    expect(await tableColumns('categories')).toEqual(expect.arrayContaining(['description']));
  });

  it('popula categorias padrão no banco do usuário', async () => {
    const res = await db.executeQuery('SELECT COUNT(*) AS c FROM categories;');
    expect(Number((res.rows.item(0) as { c: number }).c)).toBeGreaterThanOrEqual(9);
  });

  it('é idempotente: rodar as migrations de novo não quebra o banco', async () => {
    const raw = await db.getUserDatabase();
    await expect(runMigrations(raw!)).resolves.toBeUndefined();
    const pragma = await db.executeQuery('PRAGMA user_version;');
    expect(Number((pragma.rows.item(0) as { user_version: number }).user_version)).toBe(7);
  });

  it('migra banco existente com dados da Sprint 1 preservando integridade, colunas e user_version 7', async () => {
    const manager = DatabaseManager.getInstance();
    const fixtureUser = 'user-fixture-sprint1';
    await manager.setActiveUser(fixtureUser);
    const rawFixtureDb = await manager.getUserDatabase();
    expect(rawFixtureDb).toBeDefined();

    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS transaction_tags;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS tags;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS zero_based_allocations;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS events;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS daily_limits;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS app_settings;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS category_spending_goals;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS bill_payments;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS recurring_bills;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS transactions;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS accounts;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS budgets;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS categories;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS users;');
    await rawFixtureDb!.executeSql('DROP TABLE IF EXISTS schema_migrations;');
    await rawFixtureDb!.executeSql('PRAGMA user_version = 0;');

    await rawFixtureDb!.executeSql(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    await migration001Initial.up(rawFixtureDb!);
    await rawFixtureDb!.executeSql('INSERT INTO schema_migrations VALUES (1, ?);', [new Date().toISOString()]);
    await migration002SystemLogs.up(rawFixtureDb!);
    await rawFixtureDb!.executeSql('INSERT INTO schema_migrations VALUES (2, ?);', [new Date().toISOString()]);
    await migration003AddUsername.up(rawFixtureDb!);
    await rawFixtureDb!.executeSql('INSERT INTO schema_migrations VALUES (3, ?);', [new Date().toISOString()]);
    await rawFixtureDb!.executeSql('PRAGMA user_version = 3;');

    await rawFixtureDb!.executeSql(
      'INSERT INTO accounts (id, name, type, initial_balance, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      ['acc-s1', 'Conta Corrente Sprint 1', 'corrente', 2500.0, '#2563EB', 'briefcase', '2026-01-01', '2026-01-01']
    );
    await rawFixtureDb!.executeSql(
      'INSERT INTO categories (id, name, color, icon, is_custom) VALUES (?, ?, ?, ?, ?);',
      ['cat-s1', 'Alimentação Sprint 1', '#10B981', 'coffee', 0]
    );
    await rawFixtureDb!.executeSql(
      'INSERT INTO transactions (id, account_id, category_id, value, type, description, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
      ['tx-s1', 'acc-s1', 'cat-s1', 150.0, 'despesa', 'Supermercado Mensal S1', '2026-01-10T12:00:00.000Z', '2026-01-10', '2026-01-10']
    );
    await rawFixtureDb!.executeSql(
      'INSERT INTO budgets (id, category_id, month, year, limit_value) VALUES (?, ?, ?, ?, ?);',
      ['b-s1', 'cat-s1', 1, 2026, 1000.0]
    );

    await runMigrations(rawFixtureDb!);

    const [pragmaRes] = await rawFixtureDb!.executeSql('PRAGMA user_version;');
    expect(Number((pragmaRes.rows.item(0) as { user_version: number }).user_version)).toBe(7);

    const [accCheck] = await rawFixtureDb!.executeSql('SELECT * FROM accounts WHERE id = ?;', ['acc-s1']);
    expect(accCheck.rows.length).toBe(1);
    const accRow = accCheck.rows.item(0) as { name: string; initial_balance: number; credit_limit: number };
    expect(accRow.name).toBe('Conta Corrente Sprint 1');
    expect(accRow.initial_balance).toBe(2500.0);
    expect(accRow.credit_limit).toBe(0.0);

    const [txCheck] = await rawFixtureDb!.executeSql('SELECT * FROM transactions WHERE id = ?;', ['tx-s1']);
    expect(txCheck.rows.length).toBe(1);
    const txRow = txCheck.rows.item(0) as { description: string; value: number; status: string; is_extra_income: number };
    expect(txRow.description).toBe('Supermercado Mensal S1');
    expect(txRow.value).toBe(150.0);
    expect(txRow.status).toBe('confirmada');
    expect(txRow.is_extra_income).toBe(0);

    const [idxCheck] = await rawFixtureDb!.executeSql(
      "SELECT name FROM sqlite_master WHERE type = 'index';"
    );
    const indexNames: string[] = [];
    for (let i = 0; i < idxCheck.rows.length; i++) {
      indexNames.push(String((idxCheck.rows.item(i) as { name: string }).name));
    }
    expect(indexNames).toContain('idx_transactions_recurrence_parent');
    expect(indexNames).toContain('idx_transactions_installment_group');
    expect(indexNames).toContain('idx_transactions_extra_income');
    expect(indexNames).toContain('idx_tags_name');
    expect(indexNames).toContain('idx_transaction_tags_tag');
    expect(indexNames).toContain('idx_transaction_tags_tx');
    expect(indexNames).toContain('idx_transactions_account_date');
    expect(indexNames).toContain('idx_transactions_event');
    expect(indexNames).toContain('idx_zero_based_period');
    expect(indexNames).toContain('idx_spending_goals_cat');
    expect(indexNames).toContain('idx_recurring_bills_due_day');
    expect(indexNames).toContain('idx_bill_payments_period');
  });

  it('migração sobre banco com 10.000 transações executa em tempo aceitável (< 3000 ms)', async () => {
    const manager = DatabaseManager.getInstance();
    const perfUser = 'user-migration-10k';
    await manager.setActiveUser(perfUser);
    const rawDb = await manager.getUserDatabase();

    await rawFixtureBaseline(rawDb!);

    await rawDb!.executeSql('BEGIN TRANSACTION;');
    for (let i = 0; i < 10000; i++) {
      await rawDb!.executeSql(
        'INSERT INTO transactions (id, account_id, category_id, value, type, description, date, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [
          `tx_m_${i}`,
          'acc-perf',
          'cat-perf',
          25.5,
          'despesa',
          `Compra teste ${i}`,
          '2026-03-15T12:00:00.000Z',
          JSON.stringify(['mercado', 'fixo']),
          '2026-03-15',
          '2026-03-15',
        ]
      );
    }
    await rawDb!.executeSql('COMMIT;');

    const start = Date.now();
    await runMigrations(rawDb!);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(3000);

    const [pragmaRes] = await rawDb!.executeSql('PRAGMA user_version;');
    expect(Number((pragmaRes.rows.item(0) as { user_version: number }).user_version)).toBe(7);

    const [cntRes] = await rawDb!.executeSql('SELECT COUNT(*) AS total FROM transactions;');
    expect(Number((cntRes.rows.item(0) as { total: number }).total)).toBe(10000);

    const [tagRelRes] = await rawDb!.executeSql('SELECT COUNT(*) AS total FROM transaction_tags;');
    expect(Number((tagRelRes.rows.item(0) as { total: number }).total)).toBeGreaterThan(0);
  });
});

async function rawFixtureBaseline(db: { executeSql: (sql: string, params?: unknown[]) => Promise<unknown> }): Promise<void> {
  await db.executeSql('DROP TABLE IF EXISTS transaction_tags;');
  await db.executeSql('DROP TABLE IF EXISTS tags;');
  await db.executeSql('DROP TABLE IF EXISTS transactions;');
  await db.executeSql('DROP TABLE IF EXISTS accounts;');
  await db.executeSql('DROP TABLE IF EXISTS categories;');
  await db.executeSql('DROP TABLE IF EXISTS schema_migrations;');
  await db.executeSql('PRAGMA user_version = 0;');

  await db.executeSql(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  await db.executeSql(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      initial_balance REAL NOT NULL DEFAULT 0.0,
      color TEXT,
      icon TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await db.executeSql(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 0
    );
  `);
  await db.executeSql(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      value REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await db.executeSql('INSERT INTO schema_migrations VALUES (1, ?);', [new Date().toISOString()]);
  await db.executeSql('INSERT INTO schema_migrations VALUES (2, ?);', [new Date().toISOString()]);
  await db.executeSql('INSERT INTO schema_migrations VALUES (3, ?);', [new Date().toISOString()]);
  await db.executeSql('PRAGMA user_version = 3;');

  await db.executeSql(
    'INSERT INTO accounts (id, name, type, initial_balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
    ['acc-perf', 'Conta Perf', 'corrente', 50000.0, '2026-01-01', '2026-01-01']
  );
  await db.executeSql(
    'INSERT INTO categories (id, name, color, icon, is_custom) VALUES (?, ?, ?, ?, ?);',
    ['cat-perf', 'Categoria Perf', '#10B981', 'coffee', 0]
  );
}
