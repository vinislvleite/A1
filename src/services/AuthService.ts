import { UserRepository } from '../data/repositories/UserRepository';
import { EncryptionStorage } from './EncryptionStorage';
import { User, UserSession } from '../domain/entities/User';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export class AuthService {
  private userRepository: UserRepository;
  private readonly sessionKey: string = 'orcamento_facil_auth_session';

  constructor(userRepository: UserRepository = new UserRepository()) {
    this.userRepository = userRepository;
  }

  public async login(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return {
        success: false,
        error: 'E-mail e senha são obrigatórios.',
      };
    }

    try {
      const user = await this.userRepository.validateCredentials(cleanEmail, cleanPassword);
      if (!user) {
        return {
          success: false,
          error: 'E-mail ou senha inválidos.',
        };
      }

      const session: UserSession = {
        userId: user.id,
        name: user.name,
        email: user.email,
        loginAt: new Date().toISOString(),
      };

      await EncryptionStorage.setItem(this.sessionKey, session);

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Erro ao autenticar: ${message}`,
      };
    }
  }

  public async register(name: string, email: string, password: string): Promise<AuthResult> {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return {
        success: false,
        error: 'Todos os campos são obrigatórios.',
      };
    }

    try {
      const user = await this.userRepository.createUser({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
      });

      const session: UserSession = {
        userId: user.id,
        name: user.name,
        email: user.email,
        loginAt: new Date().toISOString(),
      };

      await EncryptionStorage.setItem(this.sessionKey, session);

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }

  public async recoverPassword(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return {
        success: false,
        error: 'Informe seu e-mail cadastrado.',
      };
    }

    try {
      const user = await this.userRepository.findByEmail(cleanEmail);
      if (!user) {
        return {
          success: false,
          error: 'Nenhuma conta encontrada com este e-mail.',
        };
      }

      return {
        success: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }

  public async logout(): Promise<void> {
    try {
      await EncryptionStorage.removeItem(this.sessionKey);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao encerrar sessão: ${message}`);
    }
  }

  public async getCurrentUser(): Promise<UserSession | null> {
    try {
      return await EncryptionStorage.getItem<UserSession>(this.sessionKey);
    } catch {
      return null;
    }
  }

  public async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentUser();
    return session !== null;
  }
}

