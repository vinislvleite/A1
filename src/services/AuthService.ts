import { UserRepository } from '../data/repositories/UserRepository';
import { DatabaseManager } from '../data/database/SQLiteDatabase';
import { EncryptionStorage } from './EncryptionStorage';
import { User, UserSession } from '../domain/entities/User';
import { seedDemoUser } from '../data/database/seed';
import { LogService } from './LogService';

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
        await LogService.getInstance().logSecurityAttempt(
          'LOGIN_AUTH_FAILED',
          `Tentativa de autenticação com credenciais incorretas para: ${cleanEmail}`
        );
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
      await DatabaseManager.getInstance().setActiveUser(user.id);

      if (cleanEmail.toLowerCase() === 'teste@orcamentofacil.com') {
        await seedDemoUser();
        await DatabaseManager.getInstance().setActiveUser(user.id);
      }

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('LOGIN_EXCEPTION', message);
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

    if (cleanPassword.length < 8) {
      return {
        success: false,
        error: 'A senha deve ter no mínimo 8 caracteres.',
      };
    }

    if (!/[A-Z]/.test(cleanPassword)) {
      return {
        success: false,
        error: 'A senha deve conter ao menos uma letra maiúscula.',
      };
    }

    if (!/[^A-Za-z0-9]/.test(cleanPassword)) {
      return {
        success: false,
        error: 'A senha deve conter ao menos um caractere especial.',
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
      await DatabaseManager.getInstance().setActiveUser(user.id);

      return {
        success: true,
        user,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('AUTH_REGISTER_UNEXPECTED', message);
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
        await LogService.getInstance().logSecurityAttempt(
          'PASSWORD_RECOVERY_UNKNOWN_EMAIL',
          `Tentativa de recuperação para e-mail não cadastrado: ${cleanEmail}`
        );
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
      await LogService.getInstance().logCriticalError('RECOVER_PASSWORD_EXCEPTION', message);
      return {
        success: false,
        error: message,
      };
    }
  }

  public async resetPasswordLocally(
    email: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return { success: false, error: 'E-mail inválido.' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'A nova senha deve ter no mínimo 8 caracteres.' };
    }
    if (!/[A-Z]/.test(newPassword)) {
      return { success: false, error: 'A senha deve conter ao menos uma letra maiúscula.' };
    }
    if (!/[a-z]/.test(newPassword)) {
      return { success: false, error: 'A senha deve conter ao menos uma letra minúscula.' };
    }
    if (!/[0-9]/.test(newPassword)) {
      return { success: false, error: 'A senha deve conter ao menos um número.' };
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      return { success: false, error: 'A senha deve conter ao menos um caractere especial.' };
    }

    try {
      const user = await this.userRepository.findByEmail(cleanEmail);
      if (!user) {
        await LogService.getInstance().logSecurityAttempt(
          'PASSWORD_RESET_UNKNOWN_EMAIL',
          `Tentativa de redefinição para e-mail não cadastrado: ${cleanEmail}`
        );
        return { success: false, error: 'Usuário não encontrado.' };
      }

      await this.userRepository.updatePassword(user.id, newPassword);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await LogService.getInstance().logCriticalError('RESET_PASSWORD_EXCEPTION', message);
      return { success: false, error: message };
    }
  }

  public async logout(): Promise<void> {
    try {
      await EncryptionStorage.removeItem(this.sessionKey);
      await DatabaseManager.getInstance().setActiveUser(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao encerrar sessão: ${message}`);
    }
  }

  public async getCurrentUser(): Promise<UserSession | null> {
    try {
      const session = await EncryptionStorage.getItem<UserSession>(this.sessionKey);
      if (session && DatabaseManager.getInstance().getActiveUserId() !== session.userId) {
        await DatabaseManager.getInstance().setActiveUser(session.userId);
      }
      return session;
    } catch {
      return null;
    }
  }

  public async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentUser();
    return session !== null;
  }
}

