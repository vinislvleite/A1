import { DatabaseManager } from '../data/database/SQLiteDatabase';

export type LogLevel = 'CRITICAL' | 'SECURITY';

export interface SystemLogEntry {
  id: string;
  level: LogLevel;
  action: string;
  message: string;
  created_at: string;
}

export class LogService {
  private static instance: LogService | null = null;
  private dbManager: DatabaseManager;

  private constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
  }

  public static getInstance(dbManager?: DatabaseManager): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService(dbManager);
    }
    return LogService.instance;
  }

  public static resetInstance(): void {
    LogService.instance = null;
  }

  private sanitizeMessage(text: string): string {
    return text
      .replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g, (_match, user, domain, tld) => {
        const masked = String(user).length > 2 ? `${String(user).substring(0, 2)}***` : '***';
        return `${masked}@${domain}.${tld}`;
      })
      .replace(/(password|senha|pwd)=[^&\s]+/gi, '$1=***')
      .replace(/("password"|"senha"):\s*"[^"]+"/gi, '$1:"***"');
  }

  public async logSecurityAttempt(action: string, detail: string): Promise<void> {
    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const sanitized = this.sanitizeMessage(detail);

      await this.dbManager.executeQuery(
        `INSERT INTO system_logs (id, level, action, message, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        [id, 'SECURITY', action, sanitized, now]
      );
    } catch {
      return;
    }
  }

  public async logCriticalError(action: string, error: Error | string): Promise<void> {
    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const rawMessage = error instanceof Error ? error.message : String(error);
      const sanitized = this.sanitizeMessage(rawMessage);

      await this.dbManager.executeQuery(
        `INSERT INTO system_logs (id, level, action, message, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        [id, 'CRITICAL', action, sanitized, now]
      );
    } catch {
      return;
    }
  }

  public async purgeOldLogs(retentionDays: number = 15): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffIso = cutoffDate.toISOString();

      const result = await this.dbManager.executeQuery(
        `DELETE FROM system_logs WHERE created_at < ?;`,
        [cutoffIso]
      );

      return result.rowsAffected;
    } catch {
      return 0;
    }
  }

  public async getRecentLogs(limit: number = 100): Promise<SystemLogEntry[]> {
    try {
      const result = await this.dbManager.executeQuery(
        `SELECT id, level, action, message, created_at
         FROM system_logs
         ORDER BY created_at DESC
         LIMIT ?;`,
        [limit]
      );

      const logs: SystemLogEntry[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as SystemLogEntry;
        logs.push({
          id: row.id,
          level: row.level,
          action: row.action,
          message: row.message,
          created_at: row.created_at,
        });
      }
      return logs;
    } catch {
      return [];
    }
  }
}
