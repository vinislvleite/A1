import { DatabaseManager } from '../database/SQLiteDatabase';
import { Account, CreateAccountDTO, UpdateAccountDTO } from '../../domain/entities/Account';
import { generateUUID } from '../../utils/uuid';
import { LogService } from '../../services/LogService';

interface AccountRow {
  id: string;
  name: string;
  type: 'corrente' | 'poupanca' | 'cartao_credito';
  initial_balance: number;
  credit_limit?: number | null;
  closing_day?: number | null;
  due_day?: number | null;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export class AccountRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
  }

  private mapRowToEntity(row: AccountRow): Account {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      initial_balance: Number(row.initial_balance ?? 0),
      credit_limit:
        row.credit_limit !== undefined && row.credit_limit !== null ? Number(row.credit_limit) : 0,
      closing_day:
        row.closing_day !== undefined && row.closing_day !== null ? Number(row.closing_day) : null,
      due_day: row.due_day !== undefined && row.due_day !== null ? Number(row.due_day) : null,
      color: row.color,
      icon: row.icon,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  public async create(data: CreateAccountDTO): Promise<Account> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const creditLimit =
      data.credit_limit !== undefined && data.credit_limit !== null ? Number(data.credit_limit) : 0;
    const closingDay =
      data.closing_day !== undefined && data.closing_day !== null ? Number(data.closing_day) : null;
    const dueDay =
      data.due_day !== undefined && data.due_day !== null ? Number(data.due_day) : null;

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO accounts (id, name, type, initial_balance, credit_limit, closing_day, due_day, color, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          data.name,
          data.type,
          data.initial_balance,
          creditLimit,
          closingDay,
          dueDay,
          data.color,
          data.icon,
          now,
          now,
        ]
      );

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar conta recém-criada com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('ACCOUNT_CREATE_FAILED', message);
      throw new Error(`Erro ao criar conta: ${message}`);
    }
  }

  public async findById(id: string): Promise<Account | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, type, initial_balance, credit_limit, closing_day, due_day, color, icon, created_at, updated_at FROM accounts WHERE id = ?;',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as AccountRow;
      return this.mapRowToEntity(row);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('ACCOUNT_FIND_BY_ID_FAILED', message);
      throw new Error(`Erro ao buscar conta por ID [${id}]: ${message}`);
    }
  }

  public async findAll(): Promise<Account[]> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, type, initial_balance, credit_limit, closing_day, due_day, color, icon, created_at, updated_at FROM accounts ORDER BY name ASC;'
      );

      const accounts: Account[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as AccountRow;
        accounts.push(this.mapRowToEntity(row));
      }

      return accounts;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('ACCOUNT_FIND_ALL_FAILED', message);
      throw new Error(`Erro ao listar contas: ${message}`);
    }
  }

  public async update(id: string, data: UpdateAccountDTO): Promise<Account> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Conta não encontrada para atualização com ID: ${id}`);
    }

    const name = data.name ?? existing.name;
    const type = data.type ?? existing.type;
    const initialBalance = data.initial_balance ?? existing.initial_balance;
    const creditLimit =
      data.credit_limit !== undefined ? data.credit_limit : (existing.credit_limit ?? 0);
    const closingDay =
      data.closing_day !== undefined ? data.closing_day : (existing.closing_day ?? null);
    const dueDay =
      data.due_day !== undefined ? data.due_day : (existing.due_day ?? null);
    const color = data.color ?? existing.color;
    const icon = data.icon ?? existing.icon;
    const now = new Date().toISOString();

    try {
      await this.dbManager.executeQuery(
        `UPDATE accounts
         SET name = ?, type = ?, initial_balance = ?, credit_limit = ?, closing_day = ?, due_day = ?, color = ?, icon = ?, updated_at = ?
         WHERE id = ?;`,
        [name, type, initialBalance, creditLimit, closingDay, dueDay, color, icon, now, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Falha ao recuperar conta atualizada com ID: ${id}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('ACCOUNT_UPDATE_FAILED', message);
      throw new Error(`Erro ao atualizar conta [${id}]: ${message}`);
    }
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Conta não encontrada para exclusão com ID: ${id}`);
    }

    try {
      await this.dbManager.executeQuery('DELETE FROM accounts WHERE id = ?;', [id]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('ACCOUNT_DELETE_FAILED', message);
      throw new Error(`Erro ao excluir conta [${id}]: ${message}`);
    }
  }

  public async adjustBalance(accountId: string, newBalance: number, asOfDate?: string): Promise<Account> {
    const existing = await this.findById(accountId);
    if (!existing) {
      throw new Error(`Conta não encontrada com ID: ${accountId}`);
    }

    try {
      const cutoffDay = (asOfDate ?? new Date().toISOString()).substring(0, 10);
      const totalsResult = await this.dbManager.executeQuery(
        `SELECT
           SUM(CASE WHEN type = 'receita' AND status = 'confirmada' THEN value ELSE 0 END) AS total_income,
           SUM(CASE WHEN type = 'despesa' AND status = 'confirmada' THEN value ELSE 0 END) AS total_expense
         FROM transactions
         WHERE account_id = ? AND substr(date, 1, 10) <= ?;`,
        [accountId, cutoffDay]
      );

      let totalIncome = 0;
      let totalExpense = 0;
      if (totalsResult.rows.length > 0) {
        const row = totalsResult.rows.item(0) as { total_income: number | null; total_expense: number | null };
        totalIncome = row.total_income ?? 0;
        totalExpense = row.total_expense ?? 0;
      }

      const calculatedInitialBalance = newBalance - (totalIncome - totalExpense);
      const now = new Date().toISOString();

      await this.dbManager.executeQuery(
        `UPDATE accounts
         SET initial_balance = ?, updated_at = ?
         WHERE id = ?;`,
        [calculatedInitialBalance, now, accountId]
      );

      const updated = await this.findById(accountId);
      if (!updated) {
        throw new Error(`Falha ao recuperar conta após ajuste com ID: ${accountId}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('ACCOUNT_ADJUST_BALANCE_FAILED', message);
      throw new Error(`Erro ao ajustar saldo da conta [${accountId}]: ${message}`);
    }
  }
}
