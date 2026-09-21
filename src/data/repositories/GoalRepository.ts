import { DatabaseManager } from '../database/SQLiteDatabase';
import { Goal, CreateGoalDTO, UpdateGoalDTO } from '../../domain/entities/Goal';
import { generateUUID } from '../../utils/uuid';

interface GoalRow {
  id: string;
  name: string;
  target_value: number;
  deadline: string;
  current_value: number;
}

export class GoalRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
  }

  public async create(data: CreateGoalDTO): Promise<Goal> {
    const id = generateUUID();
    const currentValue = data.current_value ?? 0.0;

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO goals (id, name, target_value, deadline, current_value)
         VALUES (?, ?, ?, ?, ?);`,
        [id, data.name, data.target_value, data.deadline, currentValue]
      );

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar meta recém-criada com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao criar meta: ${message}`);
    }
  }

  public async findById(id: string): Promise<Goal | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, target_value, deadline, current_value FROM goals WHERE id = ?;',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as GoalRow;
      return {
        id: row.id,
        name: row.name,
        target_value: row.target_value,
        deadline: row.deadline,
        current_value: row.current_value,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar meta por ID [${id}]: ${message}`);
    }
  }

  public async findAll(): Promise<Goal[]> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, target_value, deadline, current_value FROM goals ORDER BY deadline ASC;'
      );

      const goals: Goal[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as GoalRow;
        goals.push({
          id: row.id,
          name: row.name,
          target_value: row.target_value,
          deadline: row.deadline,
          current_value: row.current_value,
        });
      }

      return goals;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao listar metas: ${message}`);
    }
  }

  public async update(id: string, data: UpdateGoalDTO): Promise<Goal> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Meta não encontrada para atualização com ID: ${id}`);
    }

    const name = data.name ?? existing.name;
    const targetValue = data.target_value !== undefined ? data.target_value : existing.target_value;
    const deadline = data.deadline ?? existing.deadline;
    const currentValue = data.current_value !== undefined ? data.current_value : existing.current_value;

    try {
      await this.dbManager.executeQuery(
        `UPDATE goals
         SET name = ?, target_value = ?, deadline = ?, current_value = ?
         WHERE id = ?;`,
        [name, targetValue, deadline, currentValue, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Falha ao recuperar meta atualizada com ID: ${id}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao atualizar meta [${id}]: ${message}`);
    }
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Meta não encontrada para exclusão com ID: ${id}`);
    }

    try {
      await this.dbManager.executeQuery('DELETE FROM goals WHERE id = ?;', [id]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao excluir meta [${id}]: ${message}`);
    }
  }
}
