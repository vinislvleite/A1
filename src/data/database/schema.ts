export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
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
  credit_limit REAL DEFAULT 0.0,
  closing_day INTEGER,
  due_day INTEGER,
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
  recurrence_parent_id TEXT,
  installment_group_id TEXT,
  installment_number INTEGER,
  installment_total INTEGER,
  is_extra_income INTEGER NOT NULL DEFAULT 0,
  income_source TEXT,
  color_label TEXT,
  event_id TEXT,
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

export const CREATE_TAGS_TABLE = `
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
`;

export const CREATE_TRANSACTION_TAGS_TABLE = `
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (transaction_id, tag_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
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
  budget_mode TEXT NOT NULL DEFAULT 'fixo' CHECK(budget_mode IN ('fixo', 'percentual')),
  percentage_value REAL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, month, year, period_type)
);
`;

export const CREATE_ZERO_BASED_ALLOCATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS zero_based_allocations (
  id TEXT PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  group_type TEXT NOT NULL CHECK(group_type IN ('gastos', 'poupanca', 'investimentos')),
  category_name TEXT NOT NULL,
  category_id TEXT,
  allocated_value REAL NOT NULL,
  expected_income REAL NOT NULL DEFAULT 0.0
);
`;

export const CREATE_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  limit_value REAL NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const CREATE_DAILY_LIMITS_TABLE = `
CREATE TABLE IF NOT EXISTS daily_limits (
  day_of_week INTEGER PRIMARY KEY,
  limit_value REAL NOT NULL
);
`;

export const CREATE_APP_SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const CREATE_CATEGORY_SPENDING_GOALS_TABLE = `
CREATE TABLE IF NOT EXISTS category_spending_goals (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL UNIQUE,
  max_monthly_value REAL NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const CREATE_RECURRING_BILLS_TABLE = `
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
`;

export const CREATE_BILL_PAYMENTS_TABLE = `
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

export const CREATE_SYSTEM_LOGS_TABLE = `
CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK(level IN ('CRITICAL', 'SECURITY')),
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
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
  `CREATE INDEX IF NOT EXISTS idx_budgets_lookup ON budgets(category_id, year, month);`,
];
