import { DatabaseManager } from '../database/SQLiteDatabase';
import { User, CreateUserDTO } from '../../domain/entities/User';
import { generateUUID } from '../../utils/uuid';
import { sha256 } from '../../utils/sha256';

interface UserRow {
  id: string;
  name: string;
  email: string;
  username?: string;
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
    const cleanEmail = data.email.toLowerCase().trim();
    const rawUsername = data.username?.trim() || cleanEmail.split('@')[0];
    const cleanUsername = rawUsername.toLowerCase();

    const existingEmail = await this.findByEmail(cleanEmail);
    if (existingEmail) {
      throw new Error(`Já existe um usuário cadastrado com o e-mail: ${data.email}`);
    }

    const existingUsername = await this.findByUsername(cleanUsername);
    if (existingUsername) {
      throw new Error(`Já existe um usuário cadastrado com o nome de usuário: ${cleanUsername}`);
    }

    const id = generateUUID();
    const now = new Date().toISOString();
    const passwordHash = await this.hashPassword(data.password);

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO users (id, name, email, username, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [id, data.name, cleanEmail, cleanUsername, passwordHash, now]
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
        'SELECT id, name, email, username, password_hash, created_at FROM users WHERE email = ?;',
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
        username: row.username || row.email.split('@')[0],
        password_hash: row.password_hash,
        created_at: row.created_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar usuário por e-mail [${email}]: ${message}`);
    }
  }

  public async findByUsername(username: string): Promise<User | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, email, username, password_hash, created_at FROM users WHERE LOWER(username) = ?;',
        [username.toLowerCase().trim()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as UserRow;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        username: row.username || row.email.split('@')[0],
        password_hash: row.password_hash,
        created_at: row.created_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar usuário por nome de usuário [${username}]: ${message}`);
    }
  }

  public async findByIdentifier(identifier: string): Promise<User | null> {
    const clean = identifier.toLowerCase().trim();
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, email, username, password_hash, created_at FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?;',
        [clean, clean]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as UserRow;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        username: row.username || row.email.split('@')[0],
        password_hash: row.password_hash,
        created_at: row.created_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar usuário por identificador [${identifier}]: ${message}`);
    }
  }

  public async findById(id: string): Promise<User | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, email, username, password_hash, created_at FROM users WHERE id = ?;',
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
        username: row.username || row.email.split('@')[0],
        password_hash: row.password_hash,
        created_at: row.created_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar usuário por ID [${id}]: ${message}`);
    }
  }

  public async validateCredentials(identifier: string, password: string): Promise<User | null> {
    const user = await this.findByIdentifier(identifier);
    if (!user) {
      return null;
    }

    const inputHash = await this.hashPassword(password);
    if (inputHash !== user.password_hash) {
      return null;
    }

    return user;
  }

  public async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      const newHash = await this.hashPassword(newPassword);
      await this.dbManager.executeQuery(
        'UPDATE users SET password_hash = ? WHERE id = ?;',
        [newHash, userId]
      );
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao atualizar senha do usuário [${userId}]: ${message}`);
    }
  }
}
