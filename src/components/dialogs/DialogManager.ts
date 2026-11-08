import {
  ConfirmOptions,
  AlertaOptions,
  ConfirmacaoDuplaOptions,
  BottomSheetSelectorOptions,
  DatePickerOptions,
  TimePickerOptions,
  ToastOptions,
  PermissionExplanationOptions,
  DialogQueueItem,
  ActiveToast,
} from './types';

export class DialogManager {
  private static instance: DialogManager;
  private queue: DialogQueueItem[] = [];
  private activeDialog: DialogQueueItem | null = null;
  private activeToast: ActiveToast | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<() => void> = new Set();
  private nextId = 1;

  public static getInstance(): DialogManager {
    if (!DialogManager.instance) {
      DialogManager.instance = new DialogManager();
    }
    return DialogManager.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  }

  public getActiveDialog(): DialogQueueItem | null {
    return this.activeDialog;
  }

  public getActiveToast(): ActiveToast | null {
    return this.activeToast;
  }

  private processQueue(): void {
    if (this.activeDialog !== null) {
      return;
    }
    const next = this.queue.shift();
    if (next) {
      this.activeDialog = next;
      this.notify();
    }
  }

  private enqueue(item: DialogQueueItem): void {
    this.queue.push(item);
    this.processQueue();
  }

  public confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const item: DialogQueueItem = {
        id: `dialog_${this.nextId++}`,
        kind: 'confirm',
        options,
        resolve: (val: boolean) => {
          this.closeActive();
          resolve(val);
        },
      };
      this.enqueue(item);
    });
  }

  public alerta(options: AlertaOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      const item: DialogQueueItem = {
        id: `dialog_${this.nextId++}`,
        kind: 'alerta',
        options,
        resolve: () => {
          this.closeActive();
          resolve();
        },
      };
      this.enqueue(item);
    });
  }

  public confirmacaoDupla(options: ConfirmacaoDuplaOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const item: DialogQueueItem = {
        id: `dialog_${this.nextId++}`,
        kind: 'confirmacaoDupla',
        options,
        resolve: (val: boolean) => {
          this.closeActive();
          resolve(val);
        },
      };
      this.enqueue(item);
    });
  }

  public bottomSheet<T extends string>(
    options: BottomSheetSelectorOptions<T>
  ): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      const item: DialogQueueItem = {
        id: `dialog_${this.nextId++}`,
        kind: 'bottomSheet',
        options: options as BottomSheetSelectorOptions<string>,
        resolve: (val: string | null) => {
          this.closeActive();
          resolve(val as T | null);
        },
      };
      this.enqueue(item);
    });
  }

  public datePicker(options: DatePickerOptions = {}): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const item: DialogQueueItem = {
        id: `dialog_${this.nextId++}`,
        kind: 'datePicker',
        options,
        resolve: (val: string | null) => {
          this.closeActive();
          resolve(val);
        },
      };
      this.enqueue(item);
    });
  }

  public timePicker(options: TimePickerOptions = {}): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const item: DialogQueueItem = {
        id: `dialog_${this.nextId++}`,
        kind: 'timePicker',
        options,
        resolve: (val: string | null) => {
          this.closeActive();
          resolve(val);
        },
      };
      this.enqueue(item);
    });
  }

  public solicitarPermissao(
    options: PermissionExplanationOptions
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const item: DialogQueueItem = {
        id: `dialog_${this.nextId++}`,
        kind: 'permission',
        options,
        resolve: (val: boolean) => {
          this.closeActive();
          resolve(val);
        },
      };
      this.enqueue(item);
    });
  }

  public toast(options: ToastOptions): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    const duracao = options.duracaoMs ?? 3000;
    this.activeToast = {
      id: `toast_${this.nextId++}`,
      mensagem: options.mensagem,
      tipo: options.tipo ?? 'informacao',
      duracaoMs: duracao,
    };
    this.notify();

    this.toastTimer = setTimeout(() => {
      this.dismissToast();
    }, duracao);
  }

  public dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.activeToast !== null) {
      this.activeToast = null;
      this.notify();
    }
  }

  public dismissCurrent(cancelValue: unknown = null): void {
    if (!this.activeDialog) return;
    const current = this.activeDialog;
    if (current.kind === 'confirm' || current.kind === 'confirmacaoDupla' || current.kind === 'permission') {
      current.resolve(false);
    } else if (current.kind === 'alerta') {
      current.resolve();
    } else {
      current.resolve(cancelValue as string | null);
    }
  }

  private closeActive(): void {
    this.activeDialog = null;
    this.notify();
    setTimeout(() => {
      this.processQueue();
    }, 60);
  }

  public clearQueueForTests(): void {
    this.queue = [];
    this.activeDialog = null;
    this.dismissToast();
    this.notify();
  }
}

export const dialog = DialogManager.getInstance();
