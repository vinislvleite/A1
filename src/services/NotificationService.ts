import { Alert } from 'react-native';
import { DatabaseManager } from '../data/database/SQLiteDatabase';

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  channelId?: string;
  date?: Date;
  silent?: boolean;
}

export interface RecordedNotification extends NotificationPayload {
  channelId: string;
  silent: boolean;
  deliveredAt: string;
}

export interface INotificationService {
  sendLocalNotification: (payload: NotificationPayload) => Promise<void>;
  scheduleNotification: (payload: NotificationPayload) => Promise<void>;
  cancelNotification: (id: string) => Promise<void>;
}

export const SOUND_CHANNEL_ID = 'finance_alerts_sound';
export const SILENT_CHANNEL_ID = 'finance_alerts_silent';
export const SOUND_SETTING_KEY = 'notifications_sound_enabled';

export class NotificationService implements INotificationService {
  private static notifiedThresholds = new Set<string>();
  private static scheduledMap = new Map<string, NotificationPayload>();
  private static deliveredList: RecordedNotification[] = [];
  private static cachedSoundEnabled: boolean | null = null;
  private static activeChannelId: string = SOUND_CHANNEL_ID;

  public static resetNotifications(): void {
    NotificationService.notifiedThresholds.clear();
    NotificationService.scheduledMap.clear();
    NotificationService.deliveredList = [];
    NotificationService.cachedSoundEnabled = null;
    NotificationService.activeChannelId = SOUND_CHANNEL_ID;
  }

  public static getDeliveredNotifications(): RecordedNotification[] {
    return [...NotificationService.deliveredList];
  }

  public static getScheduledNotifications(): NotificationPayload[] {
    return Array.from(NotificationService.scheduledMap.values());
  }

  public static getActiveChannelId(): string {
    return NotificationService.activeChannelId;
  }

  public async isSoundEnabled(): Promise<boolean> {
    try {
      const db = DatabaseManager.getInstance();
      const res = await db.executeQuery(
        'SELECT key, value FROM app_settings WHERE key = ?;',
        [SOUND_SETTING_KEY]
      );
      if (res.rows.length > 0) {
        const row = res.rows.item(0) as { value?: string };
        const enabled = row.value !== 'false' && row.value !== '0';
        NotificationService.cachedSoundEnabled = enabled;
        NotificationService.activeChannelId = enabled ? SOUND_CHANNEL_ID : SILENT_CHANNEL_ID;
        return enabled;
      }
    } catch {}

    if (NotificationService.cachedSoundEnabled !== null) {
      return NotificationService.cachedSoundEnabled;
    }
    return true;
  }

  public async setSoundEnabled(enabled: boolean): Promise<{ channelId: string; soundEnabled: boolean }> {
    NotificationService.cachedSoundEnabled = enabled;
    const channelId = this.recreateAndroidChannel(enabled);
    try {
      const db = DatabaseManager.getInstance();
      await db.executeQuery(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
        [SOUND_SETTING_KEY, enabled ? 'true' : 'false']
      );
    } catch {}
    return { channelId, soundEnabled: enabled };
  }

  public recreateAndroidChannel(soundEnabled: boolean): string {
    const nextChannel = soundEnabled ? SOUND_CHANNEL_ID : SILENT_CHANNEL_ID;
    NotificationService.activeChannelId = nextChannel;
    return nextChannel;
  }

  public async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!payload.title || !payload.message) {
      throw new Error('Título e mensagem são obrigatórios para emissão de notificação.');
    }

    const soundEnabled = await this.isSoundEnabled();
    const channelId = payload.channelId ?? (soundEnabled ? SOUND_CHANNEL_ID : SILENT_CHANNEL_ID);
    const silent = payload.silent !== undefined ? payload.silent : !soundEnabled;

    NotificationService.deliveredList.push({
      ...payload,
      channelId,
      silent,
      deliveredAt: new Date().toISOString(),
    });

    Alert.alert(payload.title, payload.message);
  }

  public async scheduleNotification(payload: NotificationPayload): Promise<void> {
    if (!payload.date) {
      throw new Error('Data de agendamento é obrigatória.');
    }

    const soundEnabled = await this.isSoundEnabled();
    const channelId = payload.channelId ?? (soundEnabled ? SOUND_CHANNEL_ID : SILENT_CHANNEL_ID);
    const silent = payload.silent !== undefined ? payload.silent : !soundEnabled;

    NotificationService.scheduledMap.set(payload.id, {
      ...payload,
      channelId,
      silent,
    });
  }

  public async cancelNotification(id: string): Promise<void> {
    if (!id) {
      throw new Error('ID de notificação inválido.');
    }
    NotificationService.scheduledMap.delete(id);
    NotificationService.notifiedThresholds.delete(id);
  }

  public static buildBillReminderId(billId: string, month: number, year: number): string {
    return `bill_reminder_${billId}_${year}_${String(month).padStart(2, '0')}`;
  }

  public async scheduleMonthlyBillReminder(params: {
    billId: string;
    billName: string;
    value: number;
    dueDay: number;
    reminderDaysBefore: number;
    month: number;
    year: number;
  }): Promise<{ notificationId: string; scheduledDate: Date }> {
    const notificationId = NotificationService.buildBillReminderId(
      params.billId,
      params.month,
      params.year
    );

    const maxDayInMonth = new Date(params.year, params.month, 0).getDate();
    const effectiveDueDay = Math.min(Math.max(1, params.dueDay), maxDayInMonth);
    const dueDate = new Date(params.year, params.month - 1, effectiveDueDay, 9, 0, 0);
    const scheduledDate = new Date(
      dueDate.getTime() - Math.max(0, params.reminderDaysBefore) * 24 * 60 * 60 * 1000
    );

    const formattedVal = params.value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const dueText =
      params.reminderDaysBefore === 0
        ? 'vence hoje'
        : params.reminderDaysBefore === 1
          ? 'vence amanhã'
          : `vence em ${params.reminderDaysBefore} dias (dia ${String(effectiveDueDay).padStart(2, '0')})`;

    await this.scheduleNotification({
      id: notificationId,
      title: 'Lembrete de Conta Fixa',
      message: `A conta "${params.billName}" (${formattedVal}) ${dueText}.`,
      date: scheduledDate,
    });

    return { notificationId, scheduledDate };
  }

  public async cancelBillReminderForMonth(
    billId: string,
    month: number,
    year: number
  ): Promise<void> {
    const id = NotificationService.buildBillReminderId(billId, month, year);
    await this.cancelNotification(id);
  }

  public async checkAndNotifyBillDueReminder(params: {
    billId: string;
    billName: string;
    value: number;
    dueDay: number;
    reminderDaysBefore: number;
    month: number;
    year: number;
    daysUntilDue: number;
    isPaid: boolean;
  }): Promise<{ shouldAlert: boolean; title?: string; message?: string }> {
    const notificationId = NotificationService.buildBillReminderId(
      params.billId,
      params.month,
      params.year
    );

    if (params.isPaid) {
      await this.cancelNotification(notificationId);
      return { shouldAlert: false };
    }

    if (params.daysUntilDue < 0 || params.daysUntilDue > params.reminderDaysBefore) {
      return { shouldAlert: false };
    }

    if (NotificationService.notifiedThresholds.has(notificationId)) {
      return { shouldAlert: false };
    }

    NotificationService.notifiedThresholds.add(notificationId);

    const formattedVal = params.value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const dueLabel =
      params.daysUntilDue === 0
        ? 'vence hoje'
        : params.daysUntilDue === 1
          ? 'vence amanhã'
          : `vence em ${params.daysUntilDue} dias`;

    const title = 'Lembrete de Conta Fixa';
    const message = `A conta "${params.billName}" (${formattedVal}) ${dueLabel}.`;

    await this.sendLocalNotification({
      id: notificationId,
      title,
      message,
    });

    return { shouldAlert: true, title, message };
  }

  public async checkAndNotifyBudgetThreshold(params: {
    categoryId: string;
    categoryName: string;
    totalSpent: number;
    limitValue: number;
    month: number;
    year: number;
  }): Promise<{ shouldAlert: boolean; title?: string; message?: string }> {
    if (params.limitValue <= 0) {
      return { shouldAlert: false };
    }

    const percentage = (params.totalSpent / params.limitValue) * 100;
    const warningKey = `${params.year}_${params.month}_${params.categoryId}_warning`;
    const exceededKey = `${params.year}_${params.month}_${params.categoryId}_exceeded`;

    if (percentage >= 100 && !NotificationService.notifiedThresholds.has(exceededKey)) {
      NotificationService.notifiedThresholds.add(exceededKey);
      NotificationService.notifiedThresholds.add(warningKey);

      const title = 'Limite de Orçamento Excedido!';
      const message = `Você ultrapassou o limite de ${params.categoryName} neste mês. Total gasto: ${params.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de ${params.limitValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;

      await this.sendLocalNotification({
        id: exceededKey,
        title,
        message,
      });

      return { shouldAlert: true, title, message };
    }

    if (percentage >= 90 && percentage < 100 && !NotificationService.notifiedThresholds.has(warningKey)) {
      NotificationService.notifiedThresholds.add(warningKey);

      const title = 'Alerta de Orçamento (90%)';
      const message = `Atenção: você atingiu ${percentage.toFixed(0)}% do orçamento estipulado para ${params.categoryName} neste mês.`;

      await this.sendLocalNotification({
        id: warningKey,
        title,
        message,
      });

      return { shouldAlert: true, title, message };
    }

    return { shouldAlert: false };
  }

  public async checkAndNotifyCardDueSoon(params: {
    accountId: string;
    accountName: string;
    invoiceAmount: number;
    dueDateIso: string;
    daysUntilDue: number;
  }): Promise<{ shouldAlert: boolean; title?: string; message?: string }> {
    if (params.invoiceAmount <= 0 || params.daysUntilDue < 0 || params.daysUntilDue > 3) {
      return { shouldAlert: false };
    }

    const dueKey = `card_due_${params.accountId}_${params.dueDateIso.substring(0, 10)}`;
    if (NotificationService.notifiedThresholds.has(dueKey)) {
      return { shouldAlert: false };
    }

    NotificationService.notifiedThresholds.add(dueKey);

    const formattedAmount = params.invoiceAmount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const dueLabel =
      params.daysUntilDue === 0
        ? 'vence hoje'
        : params.daysUntilDue === 1
          ? 'vence amanhã'
          : `vence em ${params.daysUntilDue} dias`;

    const title = 'Vencimento da Fatura Próximo';
    const message = `A fatura do cartão ${params.accountName} (${formattedAmount}) ${dueLabel}.`;

    await this.sendLocalNotification({
      id: dueKey,
      title,
      message,
    });

    return { shouldAlert: true, title, message };
  }

  public async checkAndNotifyDailyLimitExceeded(params: {
    dateYmd: string;
    totalDaySpent: number;
    dailyLimit: number;
  }): Promise<{ shouldAlert: boolean; title?: string; message?: string }> {
    if (params.dailyLimit <= 0 || params.totalDaySpent <= params.dailyLimit) {
      return { shouldAlert: false };
    }

    const dayKey = `daily_limit_${params.dateYmd.substring(0, 10)}`;
    if (NotificationService.notifiedThresholds.has(dayKey)) {
      return { shouldAlert: false };
    }

    NotificationService.notifiedThresholds.add(dayKey);

    const spentStr = params.totalDaySpent.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const limitStr = params.dailyLimit.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const title = 'Teto de Gasto Diário Ultrapassado!';
    const message = `Seus gastos em ${params.dateYmd.substring(0, 10)} atingiram ${spentStr}, ultrapassando o teto diário de ${limitStr}.`;

    await this.sendLocalNotification({
      id: dayKey,
      title,
      message,
    });

    return { shouldAlert: true, title, message };
  }
}
