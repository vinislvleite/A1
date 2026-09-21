import { DatabaseManager } from '../database/SQLiteDatabase';
import { Account, CreateAccountDTO, UpdateAccountDTO } from '../../domain/entities/Account';
import { generateUUID } from '../../utils/uuid';

interface AccountRow {
  id: string;
  name: string;
  type: 'corrente' | 'poupanca' | 'cartao_credito';
  initial_balance: number;
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

  public async create(data: CreateAccountDTO): Promise<Account> {
    const id = generateUUID();
    const now = new Date().toISOString();

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO accounts (id, name, type, initial_balance, color, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [id, data.name, data.type, data.initial_balance, data.color, data.icon, now, now]
      );

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar conta recém-criada com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao criar conta: ${message}`);
    }
  }

  public async findById(id: string): Promise<Account | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, type, initial_balance, color, icon, created_at, updated_at FROM accounts WHERE id = ?;',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as AccountRow;
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        initial_balance: row.initial_balance,
        color: row.color,
        icon: row.icon,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar conta por ID [${id}]: ${message}`);
    }
  }

  public async findAll(): Promise<Account[]> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, type, initial_balance, color, icon, created_at, updated_at FROM accounts ORDER BY name ASC;'
      );

      const accounts: Account[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as AccountRow;
        accounts.push({
          id: row.id,
          name: row.name,
          type: row.type,
          initial_balance: row.initial_balance,
          color: row.color,
          icon: row.icon,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }

      return accounts;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
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
    const color = data.color ?? existing.color;
    const icon = data.icon ?? existing.icon;
    const now = new Date().toISOString();

    try {
      await this.dbManager.executeQuery(
        `UPDATE accounts
         SET name = ?, type = ?, initial_balance = ?, color = ?, icon = ?, updated_at = ?
         WHERE id = ?;`,
        [name, type, initialBalance, color, icon, now, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Falha ao recuperar conta atualizada com ID: ${id}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
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
      throw new Error(`Erro ao excluir conta [${id}]: ${message}`);
    }
  }
}
