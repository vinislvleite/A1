import { DatabaseManager } from '../database/SQLiteDatabase';
import { Budget, CreateBudgetDTO, UpdateBudgetDTO, BudgetPeriod } from '../../domain/entities/Budget';
import { generateUUID } from '../../utils/uuid';

interface BudgetRow {
  id: string;
  category_id: string;
  month: number;
  year: number;
  limit_value: number;
  period_type: BudgetPeriod;
}

export class BudgetRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
  }

  public async create(data: CreateBudgetDTO): Promise<Budget> {
    const id = generateUUID();
    const periodType = data.period_type ?? 'mensal';

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO budgets (id, category_id, month, year, limit_value, period_type)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [id, data.category_id, data.month, data.year, data.limit_value, periodType]
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
        'SELECT id, category_id, month, year, limit_value, period_type FROM budgets WHERE id = ?;',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as BudgetRow;
      return {
        id: row.id,
        category_id: row.category_id,
        month: row.month,
        year: row.year,
        limit_value: row.limit_value,
        period_type: row.period_type,
      };
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
      const result = await this.dbManager.executeQuery(
        `SELECT id, category_id, month, year, limit_value, period_type
         FROM budgets
         WHERE category_id = ? AND month = ? AND year = ? AND period_type = ?;`,
        [categoryId, month, year, periodType]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as BudgetRow;
      return {
        id: row.id,
        category_id: row.category_id,
        month: row.month,
        year: row.year,
        limit_value: row.limit_value,
        period_type: row.period_type,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar orçamento por categoria e período: ${message}`);
    }
  }

  public async findAllByMonth(month: number, year: number): Promise<Budget[]> {
    try {
      const result = await this.dbManager.executeQuery(
        `SELECT id, category_id, month, year, limit_value, period_type
         FROM budgets
         WHERE month = ? AND year = ?
         ORDER BY limit_value DESC;`,
        [month, year]
      );

      const budgets: Budget[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as BudgetRow;
        budgets.push({
          id: row.id,
          category_id: row.category_id,
          month: row.month,
          year: row.year,
          limit_value: row.limit_value,
          period_type: row.period_type,
        });
      }

      return budgets;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao listar orçamentos do mês [${month}/${year}]: ${message}`);
    }
  }

  public async update(id: string, data: UpdateBudgetDTO): Promise<Budget> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Orçamento não encontrado para atualização com ID: ${id}`);
    }

    const limitValue = data.limit_value !== undefined ? data.limit_value : existing.limit_value;
    const periodType = data.period_type ?? existing.period_type;

    try {
      await this.dbManager.executeQuery(
        `UPDATE budgets
         SET limit_value = ?, period_type = ?
         WHERE id = ?;`,
        [limitValue, periodType, id]
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
}
