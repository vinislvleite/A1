import fs from 'fs';
import path from 'path';
import { dialog, DialogManager } from '../src/components/dialogs/DialogManager';
import {
  ConfirmOptions,
  AlertaOptions,
  ConfirmacaoDuplaOptions,
  DatePickerOptions,
  TimePickerOptions,
  ToastOptions,
  PermissionExplanationOptions,
} from '../src/components/dialogs/types';

describe('Sistema de Diálogos e Anti-Regressão', () => {
  describe('Anti-Regressão: ausência de diálogos e pickers nativos', () => {
    const scanDirectory = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanDirectory(fullPath));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    it('nenhum arquivo em src/ faz chamadas a Alert.alert, Alert.prompt ou ToastAndroid', () => {
      const srcDir = path.resolve(__dirname, '../src');
      const allFiles = scanDirectory(srcDir);
      const violations: { file: string; line: number; match: string }[] = [];

      const forbiddenPatterns = [
        /\bAlert\.alert\b/,
        /\bAlert\.prompt\b/,
        /\bToastAndroid\b/,
        /@react-native-community\/datetimepicker/,
        /\bDateTimePickerAndroid\b/,
      ];

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of forbiddenPatterns) {
            if (pattern.test(line)) {
              violations.push({
                file: path.relative(srcDir, file),
                line: i + 1,
                match: line.trim(),
              });
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('DialogManager: confirmação, alertas e fila FIFO', () => {
    let manager: DialogManager;

    beforeEach(() => {
      manager = new DialogManager();
      manager.clearQueueForTests();
    });

    it('confirm resolve true quando confirmado pelo usuário', async () => {
      const options: ConfirmOptions = {
        titulo: 'Excluir item',
        mensagem: 'Deseja realmente excluir?',
        variante: 'perigo',
        rotuloConfirmar: 'Sim, excluir',
        rotuloCancelar: 'Cancelar',
      };

      const promise = manager.confirm(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('confirm');
      if (active && active.kind === 'confirm') {
        expect(active.options.titulo).toBe('Excluir item');
        active.resolve(true);
      }

      const result = await promise;
      expect(result).toBe(true);
    });

    it('confirm resolve false quando cancelado pelo usuário', async () => {
      const options: ConfirmOptions = {
        titulo: 'Descartar alterações',
        mensagem: 'As alterações não salvas serão perdidas.',
      };

      const promise = manager.confirm(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      if (active && active.kind === 'confirm') {
        active.resolve(false);
      }

      const result = await promise;
      expect(result).toBe(false);
    });

    it('dismissCurrent cancela o diálogo ativo retornando false para confirmação', async () => {
      const promise = manager.confirm({
        titulo: 'Cancelar via dismissCurrent',
        mensagem: 'Teste',
      });

      expect(manager.getActiveDialog()?.kind).toBe('confirm');
      manager.dismissCurrent(false);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('alerta exibe mensagem e resolve ao fechar', async () => {
      const options: AlertaOptions = {
        titulo: 'Sucesso',
        mensagem: 'Operação realizada com sucesso.',
        tipo: 'sucesso',
      };

      const promise = manager.alerta(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('alerta');

      if (active && active.kind === 'alerta') {
        active.resolve();
      }

      await promise;
    });

    it('confirmacaoDupla cancelada resolve false', async () => {
      const options: ConfirmacaoDuplaOptions = {
        tituloPasso1: 'Limpar dados',
        mensagemPasso1: 'Deseja iniciar a limpeza?',
        tituloPasso2: 'Atenção extrema',
        mensagemPasso2: 'Essa ação apagará todo o histórico.',
        rotuloConfirmarPasso2: 'Apagar tudo',
      };

      const promise = manager.confirmacaoDupla(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('confirmacaoDupla');

      if (active && active.kind === 'confirmacaoDupla') {
        active.resolve(false);
      }

      const result = await promise;
      expect(result).toBe(false);
    });

    it('confirmacaoDupla confirmada resolve true', async () => {
      const options: ConfirmacaoDuplaOptions = {
        tituloPasso1: 'Limpar dados',
        mensagemPasso1: 'Deseja iniciar a limpeza?',
        tituloPasso2: 'Confirmação Final',
        mensagemPasso2: 'Essa ação não pode ser desfeita.',
      };

      const promise = manager.confirmacaoDupla(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('confirmacaoDupla');

      if (active && active.kind === 'confirmacaoDupla') {
        active.resolve(true);
      }

      const result = await promise;
      expect(result).toBe(true);
    });

    it('fila FIFO processa múltiplos diálogos ordenadamente sem sobreposição', async () => {
      const order: string[] = [];

      const p1 = manager.alerta({ titulo: 'Primeiro Alerta', mensagem: '1' });
      const p2 = manager.confirm({ titulo: 'Segundo Confirm', mensagem: '2' });
      const p3 = manager.alerta({ titulo: 'Terceiro Alerta', mensagem: '3' });

      let active = manager.getActiveDialog();
      expect(active?.kind).toBe('alerta');
      if (active && active.kind === 'alerta') {
        order.push(active.options.titulo);
        active.resolve();
      }
      await p1;

      await new Promise((resolve) => setTimeout(resolve, 80));

      active = manager.getActiveDialog();
      expect(active?.kind).toBe('confirm');
      if (active && active.kind === 'confirm') {
        order.push(active.options.titulo);
        active.resolve(true);
      }
      const r2 = await p2;
      expect(r2).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 80));

      active = manager.getActiveDialog();
      expect(active?.kind).toBe('alerta');
      if (active && active.kind === 'alerta') {
        order.push(active.options.titulo);
        active.resolve();
      }
      await p3;

      expect(order).toEqual(['Primeiro Alerta', 'Segundo Confirm', 'Terceiro Alerta']);
    });
  });

  describe('DialogManager: DatePicker e TimePicker', () => {
    let manager: DialogManager;

    beforeEach(() => {
      manager = new DialogManager();
      manager.clearQueueForTests();
    });

    it('datePicker resolve com a data selecionada', async () => {
      const options: DatePickerOptions = {
        titulo: 'Selecione o início',
        dataInicial: '10/11/2026',
        dataMinima: '01/11/2026',
        dataMaxima: '30/11/2026',
      };

      const promise = manager.datePicker(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('datePicker');

      if (active && active.kind === 'datePicker') {
        active.resolve('25/11/2026');
      }

      const result = await promise;
      expect(result).toBe('25/11/2026');
    });

    it('datePicker resolve null ao cancelar', async () => {
      const promise = manager.datePicker({ titulo: 'Data' });

      const active = manager.getActiveDialog();
      if (active && active.kind === 'datePicker') {
        active.resolve(null);
      }

      const result = await promise;
      expect(result).toBeNull();
    });

    it('timePicker resolve com o horário selecionado', async () => {
      const options: TimePickerOptions = {
        titulo: 'Hora do lançamento',
        horaInicial: '09:00',
      };

      const promise = manager.timePicker(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('timePicker');

      if (active && active.kind === 'timePicker') {
        active.resolve('14:45');
      }

      const result = await promise;
      expect(result).toBe('14:45');
    });

    it('timePicker resolve null ao cancelar', async () => {
      const promise = manager.timePicker({ titulo: 'Hora' });

      const active = manager.getActiveDialog();
      if (active && active.kind === 'timePicker') {
        active.resolve(null);
      }

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('DialogManager: Toasts', () => {
    let manager: DialogManager;

    beforeEach(() => {
      manager = new DialogManager();
      manager.clearQueueForTests();
    });

    it('toast emite notificação não bloqueante e permite fechamento manual', () => {
      const options: ToastOptions = {
        mensagem: 'Transação salva com sucesso!',
        tipo: 'sucesso',
        duracaoMs: 3000,
      };

      manager.toast(options);

      const activeToast = manager.getActiveToast();
      expect(activeToast).not.toBeNull();
      expect(activeToast?.mensagem).toBe('Transação salva com sucesso!');
      expect(activeToast?.tipo).toBe('sucesso');

      manager.dismissToast();
      expect(manager.getActiveToast()).toBeNull();
    });
  });

  describe('DialogManager: Permissões explicativas', () => {
    let manager: DialogManager;

    beforeEach(() => {
      manager = new DialogManager();
      manager.clearQueueForTests();
    });

    it('solicitarPermissao cancelada resolve false', async () => {
      const options: PermissionExplanationOptions = {
        titulo: 'Acesso à Câmera',
        mensagem: 'Precisamos de acesso para escanear recibos.',
        aoPermitir: async () => true,
      };

      const promise = manager.solicitarPermissao(options);

      const active = manager.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('permission');

      if (active && active.kind === 'permission') {
        active.resolve(false);
      }

      const result = await promise;
      expect(result).toBe(false);
    });

    it('solicitarPermissao confirmada resolve true', async () => {
      const options: PermissionExplanationOptions = {
        titulo: 'Acesso à Câmera',
        mensagem: 'Precisamos de acesso para escanear recibos.',
        aoPermitir: async () => true,
      };

      const promise = manager.solicitarPermissao(options);

      const active = manager.getActiveDialog();
      if (active && active.kind === 'permission') {
        active.resolve(true);
      }

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('Instância singleton global exportada', () => {
    it('dialog singleton está acessível e funcional', () => {
      expect(dialog).toBeDefined();
      expect(typeof dialog.confirm).toBe('function');
      expect(typeof dialog.alerta).toBe('function');
      expect(typeof dialog.toast).toBe('function');
      expect(typeof dialog.datePicker).toBe('function');
      expect(typeof dialog.timePicker).toBe('function');
      expect(typeof dialog.confirmacaoDupla).toBe('function');
    });
  });
});
