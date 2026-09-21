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
  public async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!payload.title || !payload.message) {
      throw new Error('Título e mensagem são obrigatórios para emissão de notificação.');
    }
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
}
