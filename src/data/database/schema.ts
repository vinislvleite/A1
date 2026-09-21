export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const CREATE_ACCOUNTS_TABLE = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('corrente', 'poupanca', 'cartao_credito')),
  initial_balance REAL NOT NULL DEFAULT 0.0,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_CATEGORIES_TABLE = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0
);
`;

export const CREATE_TRANSACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  value REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('receita', 'despesa')),
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_day INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  attachment_uri TEXT,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK(status IN ('confirmada', 'pendente')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);
`;

export const CREATE_BUDGETS_TABLE = `
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  limit_value REAL NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'mensal' CHECK(period_type IN ('mensal', 'anual')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, month, year, period_type)
);
`;

export const CREATE_GOALS_TABLE = `
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_value REAL NOT NULL,
  deadline TEXT NOT NULL,
  current_value REAL NOT NULL DEFAULT 0.0
);
`;

export const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

export const CREATE_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);`,
  `CREATE INDEX IF NOT EXISTS idx_budgets_lookup ON budgets(category_id, year, month);`,
];
