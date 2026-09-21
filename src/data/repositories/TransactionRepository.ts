import { DatabaseManager } from '../database/SQLiteDatabase';
import {
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionFilter,
  PaginatedResult,
} from '../../domain/entities/Transaction';
import { generateUUID } from '../../utils/uuid';
import { CategoryRepository } from './CategoryRepository';
import { AccountRepository } from './AccountRepository';


interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string;
  value: number;
  type: 'receita' | 'despesa';
  description: string;
  date: string;
  is_recurring: number;
  recurrence_day: number | null;
  tags: string;
  notes: string | null;
  attachment_uri: string | null;
  status: 'confirmada' | 'pendente';
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface TotalsRow {
  total_income: number | null;
  total_expense: number | null;
}

export class TransactionRepository {
  private dbManager: DatabaseManager;
  private categoryRepository: CategoryRepository;
  private accountRepository: AccountRepository;

  constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
    this.categoryRepository = new CategoryRepository(dbManager);
    this.accountRepository = new AccountRepository(dbManager);
  }

  private mapRowToEntity(row: TransactionRow): Transaction {
    let parsedTags: string[] = [];
    try {
      if (row.tags) {
        parsedTags = JSON.parse(row.tags) as string[];
      }
    } catch {
      parsedTags = [];
    }

    return {
      id: row.id,
      account_id: row.account_id,
      category_id: row.category_id,
      value: row.value,
      type: row.type,
      description: row.description,
      date: row.date,
      is_recurring: row.is_recurring === 1,
      recurrence_day: row.recurrence_day ?? undefined,
      tags: parsedTags,
      notes: row.notes ?? undefined,
      attachment_uri: row.attachment_uri ?? undefined,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private buildFilterClauses(filter?: TransactionFilter): {
    whereSql: string;
    params: (string | number | boolean | null)[];
  } {
    if (!filter) {
      return { whereSql: '', params: [] };
    }

    const conditions: string[] = [];
    const params: (string | number | boolean | null)[] = [];

    if (filter.accountId) {
      conditions.push('account_id = ?');
      params.push(filter.accountId);
    }

    if (filter.categoryId) {
      conditions.push('category_id = ?');
      params.push(filter.categoryId);
    }

    if (filter.type) {
      conditions.push('type = ?');
      params.push(filter.type);
    }

    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    if (filter.startDate) {
      conditions.push('date >= ?');
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push('date <= ?');
      params.push(filter.endDate);
    }

    if (filter.searchTerm) {
      conditions.push('(description LIKE ? OR notes LIKE ?)');
      params.push(`%${filter.searchTerm}%`);
      params.push(`%${filter.searchTerm}%`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereSql, params };
  }

  public async create(data: CreateTransactionDTO): Promise<Transaction> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const isRecurringInt = data.is_recurring ? 1 : 0;
    const tagsJson = JSON.stringify(data.tags ?? []);
    const status = data.status ?? 'confirmada';

    const accountExists = await this.accountRepository.findById(data.account_id);
    if (!accountExists) {
      throw new Error(`Conta com ID '${data.account_id}' não encontrada. Selecione uma conta válida.`);
    }

    const categoryExists = await this.categoryRepository.findById(data.category_id);
    if (!categoryExists) {
      throw new Error(`Categoria com ID '${data.category_id}' não encontrada. Selecione uma categoria válida.`);
    }

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO transactions (
          id, account_id, category_id, value, type, description, date,
          is_recurring, recurrence_day, tags, notes, attachment_uri,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          data.account_id,
          data.category_id,
          data.value,
          data.type,
          data.description,
          data.date,
          isRecurringInt,
          data.recurrence_day ?? null,
          tagsJson,
          data.notes ?? null,
          data.attachment_uri ?? null,
          status,
          now,
          now,
        ]
      );

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar transação recém-criada com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao criar transação: ${message}`);
    }
  }


  public async findById(id: string): Promise<Transaction | null> {
    try {
      const result = await this.dbManager.executeQuery(
        `SELECT id, account_id, category_id, value, type, description, date,
                is_recurring, recurrence_day, tags, notes, attachment_uri,
                status, created_at, updated_at
         FROM transactions
         WHERE id = ?;`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as TransactionRow;
      return this.mapRowToEntity(row);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar transação por ID [${id}]: ${message}`);
    }
  }

  public async findAll(filter?: TransactionFilter): Promise<Transaction[]> {
    try {
      const { whereSql, params } = this.buildFilterClauses(filter);
      const sql = `
        SELECT id, account_id, category_id, value, type, description, date,
               is_recurring, recurrence_day, tags, notes, attachment_uri,
               status, created_at, updated_at
        FROM transactions
        ${whereSql}
        ORDER BY date DESC, created_at DESC;
      `;

      const result = await this.dbManager.executeQuery(sql, params);
      const transactions: Transaction[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as TransactionRow;
        transactions.push(this.mapRowToEntity(row));
      }

      return transactions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao listar transações: ${message}`);
    }
  }

  public async findPaginated(
    page: number,
    limit: number,
    filter?: TransactionFilter
  ): Promise<PaginatedResult<Transaction>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;

    try {
      const { whereSql, params } = this.buildFilterClauses(filter);

      const countSql = `SELECT COUNT(*) AS count FROM transactions ${whereSql};`;
      const countResult = await this.dbManager.executeQuery(countSql, params);
      const total = (countResult.rows.item(0) as CountRow).count;

      const dataSql = `
        SELECT id, account_id, category_id, value, type, description, date,
               is_recurring, recurrence_day, tags, notes, attachment_uri,
               status, created_at, updated_at
        FROM transactions
        ${whereSql}
        ORDER BY date DESC, created_at DESC
        LIMIT ? OFFSET ?;
      `;

      const dataParams = [...params, safeLimit, offset];
      const dataResult = await this.dbManager.executeQuery(dataSql, dataParams);

      const data: Transaction[] = [];
      for (let i = 0; i < dataResult.rows.length; i++) {
        const row = dataResult.rows.item(i) as TransactionRow;
        data.push(this.mapRowToEntity(row));
      }

      const totalPages = Math.ceil(total / safeLimit);

      return {
        data,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao paginar transações: ${message}`);
    }
  }

  public async update(id: string, data: UpdateTransactionDTO): Promise<Transaction> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Transação não encontrada para atualização com ID: ${id}`);
    }

    const accountId = data.account_id ?? existing.account_id;
    const categoryId = data.category_id ?? existing.category_id;

    if (data.account_id !== undefined && data.account_id !== existing.account_id) {
      const accountExists = await this.accountRepository.findById(data.account_id);
      if (!accountExists) {
        throw new Error(`Conta com ID '${data.account_id}' não encontrada. Selecione uma conta válida.`);
      }
    }

    if (data.category_id !== undefined && data.category_id !== existing.category_id) {
      const categoryExists = await this.categoryRepository.findById(data.category_id);
      if (!categoryExists) {
        throw new Error(`Categoria com ID '${data.category_id}' não encontrada. Selecione uma categoria válida.`);
      }
    }

    const value = data.value !== undefined ? data.value : existing.value;
    const type = data.type ?? existing.type;
    const description = data.description ?? existing.description;
    const date = data.date ?? existing.date;
    const isRecurringInt = data.is_recurring !== undefined
      ? (data.is_recurring ? 1 : 0)
      : (existing.is_recurring ? 1 : 0);
    const recurrenceDay = data.recurrence_day !== undefined
      ? data.recurrence_day
      : existing.recurrence_day;
    const tagsJson = data.tags !== undefined ? JSON.stringify(data.tags) : JSON.stringify(existing.tags);
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const attachmentUri = data.attachment_uri !== undefined ? data.attachment_uri : existing.attachment_uri;
    const status = data.status ?? existing.status;
    const now = new Date().toISOString();

    try {
      await this.dbManager.executeQuery(
        `UPDATE transactions
         SET account_id = ?, category_id = ?, value = ?, type = ?, description = ?, date = ?,
             is_recurring = ?, recurrence_day = ?, tags = ?, notes = ?, attachment_uri = ?,
             status = ?, updated_at = ?
         WHERE id = ?;`,
        [
          accountId,
          categoryId,
          value,
          type,
          description,
          date,
          isRecurringInt,
          recurrenceDay ?? null,
          tagsJson,
          notes ?? null,
          attachmentUri ?? null,
          status,
          now,
          id,
        ]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Falha ao recuperar transação atualizada com ID: ${id}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao atualizar transação [${id}]: ${message}`);
    }
  }


  public async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Transação não encontrada para exclusão com ID: ${id}`);
    }

    try {
      await this.dbManager.executeQuery('DELETE FROM transactions WHERE id = ?;', [id]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao excluir transação [${id}]: ${message}`);
    }
  }

  public async findByAccountId(accountId: string): Promise<Transaction[]> {
    return this.findAll({ accountId });
  }

  public async getTotalsByPeriod(
    startDate: string,
    endDate: string,
    accountId?: string
  ): Promise<{ totalIncome: number; totalExpense: number; balance: number }> {
    try {
      const startDay = startDate.split('T')[0];
      const endDay = endDate.split('T')[0];

      let sql = `
        SELECT
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' THEN value ELSE 0 END) AS total_income,
          SUM(CASE WHEN type = 'despesa' AND status = 'confirmada' THEN value ELSE 0 END) AS total_expense
        FROM transactions
        WHERE substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?
      `;
      const params: (string | number | boolean | null)[] = [startDay, endDay];

      if (accountId) {
        sql += ' AND account_id = ?';
        params.push(accountId);
      }

      const result = await this.dbManager.executeQuery(sql, params);
      const row = result.rows.item(0) as TotalsRow;

      const totalIncome = row.total_income ?? 0;
      const totalExpense = row.total_expense ?? 0;
      const balance = totalIncome - totalExpense;

      return { totalIncome, totalExpense, balance };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao calcular totais por período: ${message}`);
    }
  }


  public async getAggregateTotalsPerAccount(): Promise<Map<string, { income: number; expense: number }>> {
    try {
      const sql = `
        SELECT
          account_id,
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' THEN value ELSE 0 END) AS total_income,
          SUM(CASE WHEN type = 'despesa' AND status = 'confirmada' THEN value ELSE 0 END) AS total_expense
        FROM transactions
        GROUP BY account_id;
      `;

      const result = await this.dbManager.executeQuery(sql, []);
      const totalsMap = new Map<string, { income: number; expense: number }>();

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as { account_id: string; total_income: number | null; total_expense: number | null };
        totalsMap.set(row.account_id, {
          income: row.total_income ?? 0,
          expense: row.total_expense ?? 0,
        });
      }

      return totalsMap;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao calcular totais agregados por conta: ${message}`);
    }
  }
}

