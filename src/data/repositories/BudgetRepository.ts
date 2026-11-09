import { DatabaseManager } from '../database/SQLiteDatabase';
import {
  Budget,
  CreateBudgetDTO,
  UpdateBudgetDTO,
  BudgetPeriod,
  BudgetMode,
  ZeroBasedAllocation,
  ZeroBasedGroupType,
  BudgetEvent,
  DailySpendingLimit,
  CategorySpendingGoal,
} from '../../domain/entities/Budget';
import { generateUUID } from '../../utils/uuid';

interface BudgetRow {
  id: string;
  category_id: string;
  month: number;
  year: number;
  limit_value: number;
  period_type: BudgetPeriod;
  budget_mode?: BudgetMode;
  percentage_value?: number | null;
}

export class BudgetRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
  }

  private mapBudgetRow(row: BudgetRow): Budget {
    return {
      id: row.id,
      category_id: row.category_id,
      month: Number(row.month),
      year: Number(row.year),
      limit_value: Number(row.limit_value),
      period_type: row.period_type ?? 'mensal',
      budget_mode: row.budget_mode ?? 'fixo',
      percentage_value:
        row.percentage_value !== undefined && row.percentage_value !== null
          ? Number(row.percentage_value)
          : null,
    };
  }

  public async create(data: CreateBudgetDTO): Promise<Budget> {
    const id = generateUUID();
    const periodType = data.period_type ?? 'mensal';
    const budgetMode = data.budget_mode ?? 'fixo';
    const percentageVal =
      data.percentage_value !== undefined && data.percentage_value !== null
        ? Number(data.percentage_value)
        : null;

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO budgets (id, category_id, month, year, limit_value, period_type, budget_mode, percentage_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          data.category_id,
          data.month,
          data.year,
          data.limit_value,
          periodType,
          budgetMode,
          percentageVal,
        ]
      );

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar orçamento recém-criado com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao criar orçamento: ${message}`);
    }
  }

  public async findById(id: string): Promise<Budget | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, category_id, month, year, limit_value, period_type, budget_mode, percentage_value FROM budgets WHERE id = ?;',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as BudgetRow;
      return this.mapBudgetRow(row);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar orçamento por ID [${id}]: ${message}`);
    }
  }

  public async findByCategoryAndPeriod(
    categoryId: string,
    month: number,
    year: number,
    periodType: BudgetPeriod = 'mensal'
  ): Promise<Budget | null> {
    try {
      const targetMonth = periodType === 'anual' ? 0 : month;
      const result = await this.dbManager.executeQuery(
        `SELECT id, category_id, month, year, limit_value, period_type, budget_mode, percentage_value
         FROM budgets
         WHERE category_id = ? AND month = ? AND year = ? AND period_type = ?;`,
        [categoryId, targetMonth, year, periodType]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as BudgetRow;
      return this.mapBudgetRow(row);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar orçamento por categoria e período: ${message}`);
    }
  }

  public async findAllByMonth(month: number, year: number): Promise<Budget[]> {
    try {
      const result = await this.dbManager.executeQuery(
        `SELECT id, category_id, month, year, limit_value, period_type, budget_mode, percentage_value
         FROM budgets
         WHERE month = ? AND year = ? AND period_type = ?
         ORDER BY limit_value DESC;`,
        [month, year, 'mensal']
      );

      const budgets: Budget[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as BudgetRow;
        budgets.push(this.mapBudgetRow(row));
      }

      return budgets;
    } catch (error: unknown) {
      try {
        const fallbackRes = await this.dbManager.executeQuery(
          `SELECT id, category_id, month, year, limit_value, period_type
           FROM budgets
           WHERE month = ? AND year = ? AND period_type = ?
           ORDER BY limit_value DESC;`,
          [month, year, 'mensal']
        );
        const budgets: Budget[] = [];
        for (let i = 0; i < fallbackRes.rows.length; i++) {
          const row = fallbackRes.rows.item(i) as BudgetRow;
          budgets.push(this.mapBudgetRow(row));
        }
        return budgets;
      } catch {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Erro ao listar orçamentos do mês [${month}/${year}]: ${message}`);
      }
    }
  }

  public async findAllAnnualByYear(year: number): Promise<Budget[]> {
    try {
      const result = await this.dbManager.executeQuery(
        `SELECT id, category_id, month, year, limit_value, period_type, budget_mode, percentage_value
         FROM budgets
         WHERE year = ? AND period_type = ?
         ORDER BY limit_value DESC;`,
        [year, 'anual']
      );

      const budgets: Budget[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as BudgetRow;
        budgets.push(this.mapBudgetRow(row));
      }

      return budgets;
    } catch (error: unknown) {
      try {
        const fallbackRes = await this.dbManager.executeQuery(
          `SELECT id, category_id, month, year, limit_value, period_type
           FROM budgets
           WHERE year = ? AND period_type = ?
           ORDER BY limit_value DESC;`,
          [year, 'anual']
        );
        const budgets: Budget[] = [];
        for (let i = 0; i < fallbackRes.rows.length; i++) {
          const row = fallbackRes.rows.item(i) as BudgetRow;
          budgets.push(this.mapBudgetRow(row));
        }
        return budgets;
      } catch {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Erro ao listar orçamentos anuais de [${year}]: ${message}`);
      }
    }
  }

  public async update(id: string, data: UpdateBudgetDTO): Promise<Budget> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Orçamento não encontrado para atualização com ID: ${id}`);
    }

    const limitValue = data.limit_value !== undefined ? data.limit_value : existing.limit_value;
    const periodType = data.period_type ?? existing.period_type;
    const budgetMode = data.budget_mode ?? existing.budget_mode ?? 'fixo';
    const percentageValue =
      data.percentage_value !== undefined
        ? data.percentage_value
        : (existing.percentage_value ?? null);

    try {
      await this.dbManager.executeQuery(
        `UPDATE budgets
         SET limit_value = ?, period_type = ?, budget_mode = ?, percentage_value = ?
         WHERE id = ?;`,
        [limitValue, periodType, budgetMode, percentageValue, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Falha ao recuperar orçamento atualizado com ID: ${id}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao atualizar orçamento [${id}]: ${message}`);
    }
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Orçamento não encontrado para exclusão com ID: ${id}`);
    }

    try {
      await this.dbManager.executeQuery('DELETE FROM budgets WHERE id = ?;', [id]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao excluir orçamento [${id}]: ${message}`);
    }
  }

  public async setCategoryBudget(
    categoryId: string,
    month: number,
    year: number,
    limitValue: number,
    options?: {
      periodType?: BudgetPeriod;
      budgetMode?: BudgetMode;
      percentageValue?: number | null;
    }
  ): Promise<Budget> {
    const periodType = options?.periodType ?? 'mensal';
    const targetMonth = periodType === 'anual' ? 0 : month;
    const budgetMode = options?.budgetMode ?? 'fixo';
    const percentageValue =
      budgetMode === 'percentual' ? (options?.percentageValue ?? null) : null;

    const existing = await this.findByCategoryAndPeriod(categoryId, targetMonth, year, periodType);
    if (existing) {
      return this.update(existing.id, {
        limit_value: limitValue,
        period_type: periodType,
        budget_mode: budgetMode,
        percentage_value: percentageValue,
      });
    }
    return this.create({
      category_id: categoryId,
      month: targetMonth,
      year,
      limit_value: limitValue,
      period_type: periodType,
      budget_mode: budgetMode,
      percentage_value: percentageValue,
    });
  }

  public async saveZeroBasedAllocations(
    month: number,
    year: number,
    expectedIncome: number,
    items: Array<{
      group_type: ZeroBasedGroupType;
      category_name: string;
      category_id?: string | null;
      allocated_value: number;
    }>
  ): Promise<ZeroBasedAllocation[]> {
    await this.dbManager.executeQuery(
      'DELETE FROM zero_based_allocations WHERE month = ? AND year = ?;',
      [month, year]
    );

    for (const item of items) {
      const id = generateUUID();
      await this.dbManager.executeQuery(
        `INSERT INTO zero_based_allocations (id, month, year, group_type, category_name, category_id, allocated_value, expected_income)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          month,
          year,
          item.group_type,
          item.category_name,
          item.category_id ?? null,
          Number(item.allocated_value),
          Number(expectedIncome),
        ]
      );
    }

    return this.findZeroBasedAllocations(month, year);
  }

  public async findZeroBasedAllocations(
    month: number,
    year: number
  ): Promise<ZeroBasedAllocation[]> {
    const res = await this.dbManager.executeQuery(
      'SELECT id, month, year, group_type, category_name, category_id, allocated_value, expected_income FROM zero_based_allocations WHERE month = ? AND year = ?;',
      [month, year]
    );

    const list: ZeroBasedAllocation[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const r = res.rows.item(i) as ZeroBasedAllocation;
      list.push({
        id: r.id,
        month: Number(r.month),
        year: Number(r.year),
        group_type: r.group_type,
        category_name: r.category_name,
        category_id: r.category_id ?? null,
        allocated_value: Number(r.allocated_value),
        expected_income: Number(r.expected_income ?? 0),
      });
    }
    return list;
  }

  public async createEvent(data: {
    name: string;
    limit_value: number;
    start_date: string;
    end_date: string;
  }): Promise<BudgetEvent> {
    const id = generateUUID();
    const now = new Date().toISOString();
    await this.dbManager.executeQuery(
      `INSERT INTO events (id, name, limit_value, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [id, data.name.trim(), Number(data.limit_value), data.start_date, data.end_date, now]
    );

    const events = await this.findAllEvents();
    const created = events.find((e) => e.id === id);
    if (!created) {
      throw new Error('Falha ao criar evento.');
    }
    return created;
  }

  public async findAllEvents(): Promise<BudgetEvent[]> {
    const res = await this.dbManager.executeQuery(
      'SELECT id, name, limit_value, start_date, end_date, created_at FROM events ORDER BY start_date DESC;'
    );
    const list: BudgetEvent[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const r = res.rows.item(i) as BudgetEvent;
      list.push({
        id: r.id,
        name: r.name,
        limit_value: Number(r.limit_value),
        start_date: r.start_date,
        end_date: r.end_date,
        created_at: r.created_at,
      });
    }
    return list;
  }

  public async deleteEvent(id: string): Promise<void> {
    await this.dbManager.executeQuery('DELETE FROM events WHERE id = ?;', [id]);
  }

  public async setDailyLimit(dayOfWeek: number, limitValue: number): Promise<void> {
    await this.dbManager.executeQuery(
      'INSERT OR REPLACE INTO daily_limits (day_of_week, limit_value) VALUES (?, ?);',
      [dayOfWeek, Number(limitValue)]
    );
  }

  public async findAllDailyLimits(): Promise<DailySpendingLimit[]> {
    const res = await this.dbManager.executeQuery(
      'SELECT day_of_week, limit_value FROM daily_limits;'
    );
    const list: DailySpendingLimit[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const r = res.rows.item(i) as DailySpendingLimit;
      list.push({
        day_of_week: Number(r.day_of_week),
        limit_value: Number(r.limit_value),
      });
    }
    return list;
  }

  public async getDailyLimitForDay(dayOfWeek: number): Promise<number | null> {
    const specificRes = await this.dbManager.executeQuery(
      'SELECT day_of_week, limit_value FROM daily_limits WHERE day_of_week = ?;',
      [dayOfWeek]
    );
    if (specificRes.rows.length > 0) {
      const row = specificRes.rows.item(0) as DailySpendingLimit;
      if (Number(row.limit_value) > 0) {
        return Number(row.limit_value);
      }
    }

    const defaultRes = await this.dbManager.executeQuery(
      'SELECT day_of_week, limit_value FROM daily_limits WHERE day_of_week = ?;',
      [-1]
    );
    if (defaultRes.rows.length > 0) {
      const row = defaultRes.rows.item(0) as DailySpendingLimit;
      if (Number(row.limit_value) > 0) {
        return Number(row.limit_value);
      }
    }
    return null;
  }

  public async setSetting(key: string, value: string): Promise<void> {
    await this.dbManager.executeQuery(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
      [key, value]
    );
  }

  public async getSetting(key: string): Promise<string | null> {
    const res = await this.dbManager.executeQuery(
      'SELECT key, value FROM app_settings WHERE key = ?;',
      [key]
    );
    if (res.rows.length === 0) {
      return null;
    }
    const row = res.rows.item(0) as { key: string; value: string };
    return row.value ?? null;
  }

  public async setMaxTransactionLimit(limitValue: number | null): Promise<void> {
    if (limitValue === null || limitValue <= 0) {
      await this.setSetting('max_transaction_limit', '0');
    } else {
      await this.setSetting('max_transaction_limit', String(limitValue));
    }
  }

  public async getMaxTransactionLimit(): Promise<number | null> {
    const raw = await this.getSetting('max_transaction_limit');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  public async setCategorySpendingGoal(
    categoryId: string,
    maxMonthlyValue: number
  ): Promise<CategorySpendingGoal> {
    const id = generateUUID();
    const now = new Date().toISOString();
    await this.dbManager.executeQuery(
      `INSERT OR REPLACE INTO category_spending_goals (id, category_id, max_monthly_value, created_at)
       VALUES (?, ?, ?, ?);`,
      [id, categoryId, Number(maxMonthlyValue), now]
    );
    const goals = await this.findAllCategorySpendingGoals();
    const found = goals.find((g) => g.category_id === categoryId);
    if (!found) {
      throw new Error('Falha ao salvar meta de gasto por categoria.');
    }
    return found;
  }

  public async findAllCategorySpendingGoals(): Promise<CategorySpendingGoal[]> {
    try {
      const res = await this.dbManager.executeQuery(
        'SELECT id, category_id, max_monthly_value, created_at FROM category_spending_goals;'
      );
      const list: CategorySpendingGoal[] = [];
      for (let i = 0; i < res.rows.length; i++) {
        const r = res.rows.item(i) as CategorySpendingGoal;
        list.push({
          id: r.id,
          category_id: r.category_id,
          max_monthly_value: Number(r.max_monthly_value),
          created_at: r.created_at,
        });
      }
      return list;
    } catch {
      return [];
    }
  }

  public async deleteCategorySpendingGoal(id: string): Promise<void> {
    await this.dbManager.executeQuery('DELETE FROM category_spending_goals WHERE id = ?;', [id]);
  }
}
