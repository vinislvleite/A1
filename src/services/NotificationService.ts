import { Alert } from 'react-native';

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  channelId?: string;
  date?: Date;
}

export interface INotificationService {
  sendLocalNotification: (payload: NotificationPayload) => Promise<void>;
  scheduleNotification: (payload: NotificationPayload) => Promise<void>;
  cancelNotification: (id: string) => Promise<void>;
}

export class NotificationService implements INotificationService {
  private static notifiedThresholds = new Set<string>();

  public static resetNotifications(): void {
    NotificationService.notifiedThresholds.clear();
  }

  public async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!payload.title || !payload.message) {
      throw new Error('Título e mensagem são obrigatórios para emissão de notificação.');
    }
    Alert.alert(payload.title, payload.message);
  }

  public async scheduleNotification(payload: NotificationPayload): Promise<void> {
    if (!payload.date) {
      throw new Error('Data de agendamento é obrigatória.');
    }
  }

  public async cancelNotification(id: string): Promise<void> {
    if (!id) {
      throw new Error('ID de notificação inválido.');
    }
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
}
