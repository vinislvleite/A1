import { DatabaseManager } from '../database/SQLiteDatabase';
import {
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionFilter,
  TransactionSortOptions,
  PaginatedResult,
  CategoryMonthlyTotal,
} from '../../domain/entities/Transaction';
import { generateUUID } from '../../utils/uuid';
import { CategoryRepository } from './CategoryRepository';
import { AccountRepository } from './AccountRepository';
import { LogService } from '../../services/LogService';

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
  recurrence_parent_id?: string | null;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  is_extra_income?: number | null;
  income_source?: string | null;
  color_label?: string | null;
  event_id?: string | null;
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
  fixed_income?: number | null;
  extra_income?: number | null;
}

interface MonthlyCategoryRow {
  year_month: string;
  total: number | null;
  count: number | null;
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

  private normalizeTagsList(tags?: string[]): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of tags) {
      const cleaned = raw.trim().replace(/^#/, '');
      if (!cleaned) continue;
      const lower = cleaned.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(cleaned);
      }
    }
    return result;
  }

  private async syncNormalizedTags(transactionId: string, tags: string[], now: string): Promise<void> {
    await this.dbManager.executeQuery('DELETE FROM transaction_tags WHERE transaction_id = ?;', [transactionId]);

    for (const tagName of tags) {
      const existingTagRes = await this.dbManager.executeQuery(
        'SELECT id, name FROM tags WHERE LOWER(name) = ?;',
        [tagName.toLowerCase()]
      );

      let tagId: string;
      if (existingTagRes.rows.length > 0) {
        const item = existingTagRes.rows.item(0) as { id: string };
        tagId = item.id;
      } else {
        tagId = generateUUID();
        await this.dbManager.executeQuery(
          'INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?);',
          [tagId, tagName]
        );
      }

      await this.dbManager.executeQuery(
        'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?);',
        [transactionId, tagId]
      );
    }
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
      recurrence_parent_id: row.recurrence_parent_id ?? undefined,
      installment_group_id: row.installment_group_id ?? undefined,
      installment_number: row.installment_number !== null && row.installment_number !== undefined ? Number(row.installment_number) : undefined,
      installment_total: row.installment_total !== null && row.installment_total !== undefined ? Number(row.installment_total) : undefined,
      is_extra_income: row.is_extra_income === 1,
      income_source: row.income_source ?? undefined,
      color_label: row.color_label ?? undefined,
      event_id: row.event_id ?? undefined,
      tags: parsedTags,
      notes: row.notes ?? undefined,
      attachment_uri: row.attachment_uri ?? undefined,
      status: row.status ?? 'confirmada',
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

    if (filter.categoryIds && filter.categoryIds.length > 0) {
      const placeholders = filter.categoryIds.map(() => '?').join(', ');
      conditions.push(`category_id IN (${placeholders})`);
      params.push(...filter.categoryIds);
    }

    if (filter.minValue !== undefined) {
      conditions.push('value >= ?');
      params.push(filter.minValue);
    }

    if (filter.maxValue !== undefined) {
      conditions.push('value <= ?');
      params.push(filter.maxValue);
    }

    if (filter.type) {
      conditions.push('type = ?');
      params.push(filter.type);
    }

    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    if (filter.isExtraIncome !== undefined) {
      conditions.push('is_extra_income = ?');
      params.push(filter.isExtraIncome ? 1 : 0);
    }

    if (filter.installmentGroupId) {
      conditions.push('installment_group_id = ?');
      params.push(filter.installmentGroupId);
    }

    if (filter.recurrenceParentId) {
      conditions.push('recurrence_parent_id = ?');
      params.push(filter.recurrenceParentId);
    }

    if (filter.eventId) {
      conditions.push('event_id = ?');
      params.push(filter.eventId);
    }

    if (filter.excludeEvents) {
      conditions.push('event_id IS NULL');
    }

    if (filter.startDate) {
      conditions.push('date >= ?');
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push('date <= ?');
      params.push(filter.endDate);
    }

    if (filter.maxEffectiveDate) {
      conditions.push('substr(date, 1, 10) <= ?');
      params.push(filter.maxEffectiveDate.substring(0, 10));
    }

    if (filter.tags && filter.tags.length > 0) {
      const cleanTags = filter.tags
        .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean);
      if (cleanTags.length === 1) {
        conditions.push(
          "id IN (SELECT tt.transaction_id FROM transaction_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE REPLACE(LOWER(tg.name), '#', '') = ?)"
        );
        params.push(cleanTags[0]);
      } else if (cleanTags.length > 1) {
        const placeholders = cleanTags.map(() => '?').join(',');
        conditions.push(
          `id IN (SELECT tt.transaction_id FROM transaction_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE REPLACE(LOWER(tg.name), '#', '') IN (${placeholders}))`
        );
        params.push(...cleanTags);
      }
    } else if (filter.tag) {
      conditions.push(
        "id IN (SELECT tt.transaction_id FROM transaction_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE REPLACE(LOWER(tg.name), '#', '') = ?)"
      );
      params.push(filter.tag.trim().toLowerCase().replace(/^#/, ''));
    }

    if (filter.searchTerm) {
      const likeTerm = `%${filter.searchTerm}%`;
      conditions.push(
        '(description LIKE ? OR notes LIKE ? OR id IN (SELECT tt.transaction_id FROM transaction_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tg.name LIKE ?))'
      );
      params.push(likeTerm, likeTerm, likeTerm);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereSql, params };
  }

  public async create(data: CreateTransactionDTO): Promise<Transaction> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const isRecurringInt = data.is_recurring ? 1 : 0;
    const isExtraIncomeInt = data.is_extra_income ? 1 : 0;
    const cleanTags = this.normalizeTagsList(data.tags);
    const tagsJson = JSON.stringify(cleanTags);
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
          is_recurring, recurrence_day, recurrence_parent_id,
          installment_group_id, installment_number, installment_total,
          is_extra_income, income_source, color_label, event_id,
          tags, notes, attachment_uri, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
          data.recurrence_parent_id ?? null,
          data.installment_group_id ?? null,
          data.installment_number ?? null,
          data.installment_total ?? null,
          isExtraIncomeInt,
          data.income_source ?? null,
          data.color_label ?? null,
          data.event_id ?? null,
          tagsJson,
          data.notes ?? null,
          data.attachment_uri ?? null,
          status,
          now,
          now,
        ]
      );

      if (cleanTags.length > 0) {
        await this.syncNormalizedTags(id, cleanTags, now);
      }

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar transação recém-criada com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('TRANSACTION_CREATE_FAILED', message);
      throw new Error(`Erro ao criar transação: ${message}`);
    }
  }

  public async findById(id: string): Promise<Transaction | null> {
    try {
      const result = await this.dbManager.executeQuery(
        `SELECT id, account_id, category_id, value, type, description, date,
                is_recurring, recurrence_day, recurrence_parent_id,
                installment_group_id, installment_number, installment_total,
                is_extra_income, income_source, color_label, event_id,
                tags, notes, attachment_uri, status, created_at, updated_at
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
               is_recurring, recurrence_day, recurrence_parent_id,
               installment_group_id, installment_number, installment_total,
               is_extra_income, income_source, color_label, event_id,
               tags, notes, attachment_uri, status, created_at, updated_at
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
    filter?: TransactionFilter,
    sort?: TransactionSortOptions
  ): Promise<PaginatedResult<Transaction>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;

    try {
      const { whereSql, params } = this.buildFilterClauses(filter);

      const countSql = `SELECT COUNT(*) AS count FROM transactions ${whereSql};`;
      const countResult = await this.dbManager.executeQuery(countSql, params);
      const total = (countResult.rows.item(0) as CountRow).count;

      const direction = sort?.direction === 'ASC' ? 'ASC' : 'DESC';
      let orderBySql = `date ${direction}, created_at ${direction}`;
      if (sort?.field === 'value') {
        orderBySql = `value ${direction}`;
      } else if (sort?.field === 'category') {
        orderBySql = `category_id ${direction}`;
      } else if (sort?.field === 'date') {
        orderBySql = `date ${direction}, created_at ${direction}`;
      }

      const dataSql = `
        SELECT id, account_id, category_id, value, type, description, date,
               is_recurring, recurrence_day, recurrence_parent_id,
               installment_group_id, installment_number, installment_total,
               is_extra_income, income_source, color_label, event_id,
               tags, notes, attachment_uri, status, created_at, updated_at
        FROM transactions
        ${whereSql}
        ORDER BY ${orderBySql}
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
    const isRecurringInt =
      data.is_recurring !== undefined
        ? data.is_recurring
          ? 1
          : 0
        : existing.is_recurring
        ? 1
        : 0;
    const recurrenceDay =
      data.recurrence_day !== undefined ? data.recurrence_day : existing.recurrence_day;
    const recurrenceParentId =
      data.recurrence_parent_id !== undefined
        ? data.recurrence_parent_id
        : existing.recurrence_parent_id;
    const installmentGroupId =
      data.installment_group_id !== undefined
        ? data.installment_group_id
        : existing.installment_group_id;
    const installmentNumber =
      data.installment_number !== undefined
        ? data.installment_number
        : existing.installment_number;
    const installmentTotal =
      data.installment_total !== undefined
        ? data.installment_total
        : existing.installment_total;
    const isExtraIncomeInt =
      data.is_extra_income !== undefined
        ? data.is_extra_income
          ? 1
          : 0
        : existing.is_extra_income
        ? 1
        : 0;
    const incomeSource =
      data.income_source !== undefined ? data.income_source : existing.income_source;
    const colorLabel =
      data.color_label !== undefined ? data.color_label : existing.color_label;
    const eventId =
      data.event_id !== undefined ? data.event_id : existing.event_id;
    const cleanTags =
      data.tags !== undefined ? this.normalizeTagsList(data.tags) : existing.tags;
    const tagsJson = JSON.stringify(cleanTags);
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const attachmentUri =
      data.attachment_uri !== undefined ? data.attachment_uri : existing.attachment_uri;
    const status = data.status ?? existing.status;
    const now = new Date().toISOString();

    try {
      await this.dbManager.executeQuery(
        `UPDATE transactions
         SET account_id = ?, category_id = ?, value = ?, type = ?, description = ?, date = ?,
             is_recurring = ?, recurrence_day = ?, recurrence_parent_id = ?,
             installment_group_id = ?, installment_number = ?, installment_total = ?,
             is_extra_income = ?, income_source = ?, color_label = ?, event_id = ?,
             tags = ?, notes = ?, attachment_uri = ?, status = ?, updated_at = ?
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
          recurrenceParentId ?? null,
          installmentGroupId ?? null,
          installmentNumber ?? null,
          installmentTotal ?? null,
          isExtraIncomeInt,
          incomeSource ?? null,
          colorLabel ?? null,
          eventId ?? null,
          tagsJson,
          notes ?? null,
          attachmentUri ?? null,
          status,
          now,
          id,
        ]
      );

      if (data.tags !== undefined) {
        await this.syncNormalizedTags(id, cleanTags, now);
      }

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Falha ao recuperar transação atualizada com ID: ${id}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('TRANSACTION_UPDATE_FAILED', message);
      throw new Error(`Erro ao atualizar transação [${id}]: ${message}`);
    }
  }

  public async confirmTransaction(id: string): Promise<Transaction> {
    return this.update(id, { status: 'confirmada' });
  }

  public async disableRecurrence(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Transação não encontrada com ID: ${id}`);
    }

    const parentId = existing.recurrence_parent_id ?? existing.id;
    const now = new Date().toISOString();

    try {
      await this.dbManager.executeQuery(
        'UPDATE transactions SET is_recurring = ?, updated_at = ? WHERE id = ?;',
        [0, now, parentId]
      );
      await this.dbManager.executeQuery(
        'UPDATE transactions SET is_recurring = ?, updated_at = ? WHERE recurrence_parent_id = ?;',
        [0, now, parentId]
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('TRANSACTION_DISABLE_RECURRENCE_FAILED', message);
      throw new Error(`Erro ao desativar recorrência [${id}]: ${message}`);
    }
  }

  public async findByInstallmentGroup(groupId: string): Promise<Transaction[]> {
    const list = await this.findAll({ installmentGroupId: groupId });
    return list.sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0));
  }

  public async updateInstallmentGroup(
    id: string,
    scope: 'single' | 'future',
    data: UpdateTransactionDTO
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Transação não encontrada com ID: ${id}`);
    }

    if (scope === 'single' || !existing.installment_group_id || !existing.installment_number) {
      await this.update(id, data);
      return;
    }

    const groupItems = await this.findByInstallmentGroup(existing.installment_group_id);
    const minNumber = existing.installment_number;
    const targetItems = groupItems.filter((item) => (item.installment_number ?? 0) >= minNumber);

    for (const item of targetItems) {
      const itemUpdate: UpdateTransactionDTO = { ...data };
      if (item.id !== existing.id) {
        delete itemUpdate.date;
      }
      if (data.description !== undefined) {
        const baseDesc = data.description.replace(/\s*\(\d+\/\d+\)$/, '').trim();
        if (item.installment_number && item.installment_total) {
          itemUpdate.description = `${baseDesc} (${item.installment_number}/${item.installment_total})`;
        } else {
          itemUpdate.description = baseDesc;
        }
      }
      await this.update(item.id, itemUpdate);
    }
  }

  public async deleteInstallmentGroup(
    id: string,
    scope: 'single' | 'future'
  ): Promise<number> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Transação não encontrada para exclusão com ID: ${id}`);
    }

    if (scope === 'single' || !existing.installment_group_id || !existing.installment_number) {
      await this.delete(id);
      return 1;
    }

    try {
      const res = await this.dbManager.executeQuery(
        'DELETE FROM transactions WHERE installment_group_id = ? AND installment_number >= ?;',
        [existing.installment_group_id, existing.installment_number]
      );
      return res.rowsAffected || 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('TRANSACTION_INSTALLMENT_DELETE_FAILED', message);
      throw new Error(`Erro ao excluir parcelas do grupo [${existing.installment_group_id}]: ${message}`);
    }
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Transação não encontrada para exclusão com ID: ${id}`);
    }

    try {
      await this.dbManager.executeQuery('DELETE FROM transaction_tags WHERE transaction_id = ?;', [id]);
      await this.dbManager.executeQuery('DELETE FROM transactions WHERE id = ?;', [id]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('TRANSACTION_DELETE_FAILED', message);
      throw new Error(`Erro ao excluir transação [${id}]: ${message}`);
    }
  }

  public async deleteMany(ids: string[]): Promise<number> {
    let deletedCount = 0;
    for (const id of ids) {
      await this.delete(id);
      deletedCount++;
    }
    return deletedCount;
  }

  public async findByAccountId(accountId: string): Promise<Transaction[]> {
    return this.findAll({ accountId });
  }

  public async getAllTags(): Promise<string[]> {
    try {
      const result = await this.dbManager.executeQuery('SELECT id, name FROM tags ORDER BY name ASC;');
      const tags: string[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as { name: string };
        if (row.name) {
          tags.push(row.name);
        }
      }
      return tags;
    } catch {
      return [];
    }
  }

  public async findTagsByTransactionId(transactionId: string): Promise<string[]> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT tg.name FROM transaction_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.transaction_id = ?;',
        [transactionId]
      );
      const tags: string[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as { name: string };
        if (row.name) {
          tags.push(row.name);
        }
      }
      return tags;
    } catch {
      return [];
    }
  }

  public async getMonthlyTotalsByCategory(categoryId: string): Promise<CategoryMonthlyTotal[]> {
    try {
      const result = await this.dbManager.executeQuery(
        `SELECT substr(date, 1, 7) AS year_month, SUM(value) AS total, COUNT(*) AS count
         FROM transactions
         WHERE category_id = ? AND status = 'confirmada'
         GROUP BY substr(date, 1, 7)
         ORDER BY year_month DESC;`,
        [categoryId]
      );

      const items: CategoryMonthlyTotal[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as MonthlyCategoryRow;
        items.push({
          yearMonth: row.year_month,
          total: Number((row.total ?? 0).toFixed(2)),
          count: Number(row.count ?? 0),
        });
      }
      return items;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao agregar gastos mensais da categoria [${categoryId}]: ${message}`);
    }
  }

  public async getTotalsByPeriod(
    startDate: string,
    endDate: string,
    accountId?: string
  ): Promise<{
    totalIncome: number;
    totalExpense: number;
    fixedIncome: number;
    extraIncome: number;
    balance: number;
  }> {
    try {
      const startDay = startDate.split('T')[0];
      const endDay = endDate.split('T')[0];

      let sql = `
        SELECT
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' THEN value ELSE 0 END) AS total_income,
          SUM(CASE WHEN type = 'despesa' AND status = 'confirmada' THEN value ELSE 0 END) AS total_expense,
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' AND (is_extra_income = 0 OR is_extra_income IS NULL) THEN value ELSE 0 END) AS fixed_income,
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' AND is_extra_income = 1 THEN value ELSE 0 END) AS extra_income
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
      const fixedIncome = row.fixed_income ?? 0;
      const extraIncome = row.extra_income ?? 0;
      const balance = totalIncome - totalExpense;

      return { totalIncome, totalExpense, fixedIncome, extraIncome, balance };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao calcular totais por período: ${message}`);
    }
  }

  public async getTotalsBeforeDate(
    beforeDateIso: string,
    accountId?: string
  ): Promise<{ totalIncome: number; totalExpense: number; netDelta: number }> {
    try {
      const beforeDay = beforeDateIso.substring(0, 10);
      let sql = `
        SELECT
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' THEN value ELSE 0 END) AS total_income,
          SUM(CASE WHEN type = 'despesa' AND status = 'confirmada' THEN value ELSE 0 END) AS total_expense
        FROM transactions
        WHERE substr(date, 1, 10) < ?
      `;
      const params: (string | number | boolean | null)[] = [beforeDay];

      if (accountId) {
        sql += ' AND account_id = ?';
        params.push(accountId);
      }

      const result = await this.dbManager.executeQuery(sql, params);
      const row = result.rows.item(0) as TotalsRow;
      const totalIncome = row.total_income ?? 0;
      const totalExpense = row.total_expense ?? 0;

      return {
        totalIncome,
        totalExpense,
        netDelta: Number((totalIncome - totalExpense).toFixed(2)),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao calcular saldo anterior a [${beforeDateIso}]: ${message}`);
    }
  }

  public async findStatementTransactions(params: {
    startDate: string;
    endDate: string;
    accountId?: string;
  }): Promise<Transaction[]> {
    try {
      const startDay = params.startDate.substring(0, 10);
      const endDay = params.endDate.substring(0, 10);

      let sql = `
        SELECT * FROM transactions
        WHERE status = 'confirmada' AND substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?
      `;
      const queryParams: (string | number | boolean | null)[] = [startDay, endDay];

      if (params.accountId) {
        sql += ' AND account_id = ?';
        queryParams.push(params.accountId);
      }

      sql += ' ORDER BY date ASC, created_at ASC;';

      const result = await this.dbManager.executeQuery(sql, queryParams);
      const items: Transaction[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as TransactionRow;
        items.push(this.mapRowToEntity(row));
      }

      return items;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar transações de extrato: ${message}`);
    }
  }

  public async getAggregateTotalsPerAccount(
    asOfDate?: string
  ): Promise<Map<string, { income: number; expense: number; fixedIncome: number; extraIncome: number }>> {
    try {
      const cutoffDay = (asOfDate ?? new Date().toISOString()).substring(0, 10);
      const sql = `
        SELECT
          account_id,
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' THEN value ELSE 0 END) AS total_income,
          SUM(CASE WHEN type = 'despesa' AND status = 'confirmada' THEN value ELSE 0 END) AS total_expense,
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' AND (is_extra_income = 0 OR is_extra_income IS NULL) THEN value ELSE 0 END) AS fixed_income,
          SUM(CASE WHEN type = 'receita' AND status = 'confirmada' AND is_extra_income = 1 THEN value ELSE 0 END) AS extra_income
        FROM transactions
        WHERE substr(date, 1, 10) <= ?
        GROUP BY account_id;
      `;

      const result = await this.dbManager.executeQuery(sql, [cutoffDay]);
      const totalsMap = new Map<
        string,
        { income: number; expense: number; fixedIncome: number; extraIncome: number }
      >();

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as {
          account_id: string;
          total_income: number | null;
          total_expense: number | null;
          fixed_income?: number | null;
          extra_income?: number | null;
        };
        totalsMap.set(row.account_id, {
          income: row.total_income ?? 0,
          expense: row.total_expense ?? 0,
          fixedIncome: row.fixed_income ?? 0,
          extraIncome: row.extra_income ?? 0,
        });
      }

      return totalsMap;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao calcular totais agregados por conta: ${message}`);
    }
  }

  public async transfer(data: {
    sourceAccountId: string;
    destinationAccountId: string;
    value: number;
    date: string;
    description?: string;
  }): Promise<{ sourceTransaction: Transaction; destinationTransaction: Transaction }> {
    if (data.sourceAccountId === data.destinationAccountId) {
      throw new Error('A conta de origem e a de destino não podem ser iguais.');
    }

    if (data.value <= 0) {
      throw new Error('O valor da transferência deve ser maior que zero.');
    }

    const sourceAccount = await this.accountRepository.findById(data.sourceAccountId);
    if (!sourceAccount) {
      throw new Error('Conta de origem não encontrada.');
    }

    const destAccount = await this.accountRepository.findById(data.destinationAccountId);
    if (!destAccount) {
      throw new Error('Conta de destino não encontrada.');
    }

    const categories = await this.categoryRepository.findAll();
    const defaultCat =
      categories.find(
        (c) =>
          c.name.toLowerCase().includes('outros') ||
          c.name.toLowerCase().includes('serviços')
      ) ?? categories[0];

    if (!defaultCat) {
      throw new Error('Nenhuma categoria encontrada para associar à transferência.');
    }

    const desc = data.description?.trim();
    const sourceDesc = desc ? `Transferência: ${desc}` : `Transferência para ${destAccount.name}`;
    const destDesc = desc ? `Transferência recebida: ${desc}` : `Transferência de ${sourceAccount.name}`;

    await this.dbManager.executeQuery('BEGIN TRANSACTION;');
    try {
      const sourceTx = await this.create({
        account_id: data.sourceAccountId,
        category_id: defaultCat.id,
        value: data.value,
        type: 'despesa',
        description: sourceDesc,
        date: data.date,
        is_recurring: false,
        tags: ['transferencia', data.destinationAccountId],
        status: 'confirmada',
      });

      const destTx = await this.create({
        account_id: data.destinationAccountId,
        category_id: defaultCat.id,
        value: data.value,
        type: 'receita',
        description: destDesc,
        date: data.date,
        is_recurring: false,
        tags: ['transferencia', data.sourceAccountId],
        status: 'confirmada',
      });

      await this.dbManager.executeQuery('COMMIT;');
      return { sourceTransaction: sourceTx, destinationTransaction: destTx };
    } catch (error: unknown) {
      await this.dbManager.executeQuery('ROLLBACK;');
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('TRANSACTION_TRANSFER_FAILED', message);
      throw new Error(`Falha ao realizar transferência atômica: ${message}`);
    }
  }
}
