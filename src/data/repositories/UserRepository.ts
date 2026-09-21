import { DatabaseManager } from '../database/SQLiteDatabase';
import { User, CreateUserDTO } from '../../domain/entities/User';
import { generateUUID } from '../../utils/uuid';
import { sha256 } from '../../utils/sha256';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export class UserRepository {
  private dbManager: DatabaseManager;
  private readonly salt: string = '_orcamentofacil_salt_2026';

  constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
  }

  public async hashPassword(password: string): Promise<string> {
    return sha256(password + this.salt);
  }

  public async createUser(data: CreateUserDTO): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new Error(`Já existe um usuário cadastrado com o e-mail: ${data.email}`);
    }

    const id = generateUUID();
    const now = new Date().toISOString();
    const passwordHash = await this.hashPassword(data.password);

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO users (id, name, email, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        [id, data.name, data.email.toLowerCase().trim(), passwordHash, now]
      );

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar usuário recém-criado com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao criar usuário: ${message}`);
    }
  }

  public async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?;',
        [email.toLowerCase().trim()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as UserRow;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        password_hash: row.password_hash,
        created_at: row.created_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar usuário por e-mail [${email}]: ${message}`);
    }
  }

  public async findById(id: string): Promise<User | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, email, password_hash, created_at FROM users WHERE id = ?;',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as UserRow;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        password_hash: row.password_hash,
        created_at: row.created_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar usuário por ID [${id}]: ${message}`);
    }
  }

  public async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const inputHash = await this.hashPassword(password);
    if (inputHash !== user.password_hash) {
      return null;
    }

    return user;
  }
}
