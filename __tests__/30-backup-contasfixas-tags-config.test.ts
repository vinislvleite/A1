import { DatabaseManager } from '../src/data/database/SQLiteDatabase';
import { setupUserDatabase, isoDate } from './helpers/db';
import { AccountRepository } from '../src/data/repositories/AccountRepository';
import { TransactionRepository } from '../src/data/repositories/TransactionRepository';
import { CategoryRepository } from '../src/data/repositories/CategoryRepository';
import { BillRepository } from '../src/data/repositories/BillRepository';
import {
  BackupService,
  MAX_BACKUPS,
  encryptBackupPayload,
  decryptBackupEnvelope,
} from '../src/services/BackupService';
import {
  ManageBillsUseCase,
  calculateBillStatusAndNextDue,
} from '../src/domain/usecases/ManageBillsUseCase';
import { RecurringBill } from '../src/domain/entities/RecurringBill';
import {
  NotificationService,
  SILENT_CHANNEL_ID,
  SOUND_CHANNEL_ID,
} from '../src/services/NotificationService';
import {
  PrivacyManager,
  PRIVACY_SETTING_KEY,
} from '../src/context/PrivacyContext';
import { formatMoneyValue, HIDDEN_MONEY_MASK } from '../src/components/MoneyText';
import { BuildStatementUseCase } from '../src/domain/usecases/BuildStatementUseCase';
import { Account } from '../src/domain/entities/Account';
import { Category } from '../src/domain/entities/Category';

const USER_ID = 'user-sprint2-backup-bills-tags';

describe('Sprint 2: Privacidade, Backup Criptografado, Contas Fixas, Tags e Notificações', () => {
  let db: DatabaseManager;
  let accountRepo: AccountRepository;
  let transactionRepo: TransactionRepository;
  let categoryRepo: CategoryRepository;
  let billRepo: BillRepository;
  let backupService: BackupService;
  let notificationService: NotificationService;
  let manageBillsUseCase: ManageBillsUseCase;
  let defaultAccount: Account;
  let defaultCategory: Category;

  beforeAll(async () => {
    db = await setupUserDatabase(USER_ID);
    accountRepo = new AccountRepository(db);
    transactionRepo = new TransactionRepository(db);
    categoryRepo = new CategoryRepository(db);
    billRepo = new BillRepository();
    backupService = new BackupService();
    notificationService = new NotificationService();
    manageBillsUseCase = new ManageBillsUseCase(
      billRepo,
      transactionRepo,
      categoryRepo,
      accountRepo,
      notificationService
    );

    defaultAccount = await accountRepo.create({
      name: 'Conta Principal US39-52',
      type: 'corrente',
      initial_balance: 5000.0,
      color: '#2563EB',
      icon: 'briefcase',
    });

    const categories = await categoryRepo.findAll();
    defaultCategory = categories[0];
  });

  beforeEach(() => {
    NotificationService.resetNotifications();
  });




  describe('US39: Modo Cortina de Privacidade', () => {
    afterEach(async () => {
      await PrivacyManager.setPrivacyEnabled(false);
    });

    it('formatMoneyValue oculta valores quando o modo de privacidade está ativo', () => {

      const visible = formatMoneyValue(1234.56, false);
      expect(visible).toContain('1.234,56');


      const hidden = formatMoneyValue(1234.56, true);
      expect(hidden).toBe(HIDDEN_MONEY_MASK);
    });

    it('PrivacyManager persiste o estado no banco SQLite e notifica inscritos', async () => {
      let notifiedState: boolean | null = null;
      const unsubscribe = PrivacyManager.subscribe((val) => {
        notifiedState = val;
      });


      await PrivacyManager.setPrivacyEnabled(true);
      expect(PrivacyManager.isPrivacyEnabled()).toBe(true);
      expect(notifiedState).toBe(true);


      const res = await db.executeQuery(
        'SELECT value FROM app_settings WHERE key = ?;',
        [PRIVACY_SETTING_KEY]
      );
      expect(res.rows.length).toBe(1);
      expect((res.rows.item(0) as { value: string }).value).toBe('true');


      const loaded = await PrivacyManager.loadPersistedPrivacyMode();
      expect(loaded).toBe(true);

      unsubscribe();
    });
  });




  describe('US40 & US41: Backup Criptografado, Rotação e Restauração', () => {
    const BACKUP_PASS = 'ChaveSegura@2026';

    beforeEach(() => {
      BackupService.clearAllBackupsForTest();
    });

    it('US40: gera envelope criptografado com salting e HMAC PBKDF2 derivado da senha', () => {
      const payload = {
        app: 'OrcamentoFacil' as const,
        schemaVersion: 7,
        exportedAt: new Date().toISOString(),
        userId: USER_ID,
        tables: {
          categories: [{ id: 'cat-1', name: 'Alimentação' }],
        },
      };

      const envelope = encryptBackupPayload(payload, BACKUP_PASS);
      expect(envelope.format).toBe('ORCAMENTO_FACIL_ENC_V1');
      expect(envelope.salt).toBeDefined();
      expect(envelope.iv).toBeDefined();
      expect(envelope.ciphertext).toBeDefined();
      expect(envelope.mac).toBeDefined();


      const decrypted = decryptBackupEnvelope(envelope, BACKUP_PASS);
      expect(decrypted.app).toBe('OrcamentoFacil');
      expect(decrypted.tables.categories).toEqual([{ id: 'cat-1', name: 'Alimentação' }]);


      expect(() => decryptBackupEnvelope(envelope, 'senhaErrada999')).toThrow(
        'Senha de backup incorreta ou arquivo adulterado.'
      );
    });

    it('US40: rotina diária de auto-backup é idempotente no mesmo dia e limita a 7 arquivos', async () => {
      await backupService.saveBackupPassword(BACKUP_PASS);


      const firstRun = await backupService.runDailyAutoBackupIfNeeded(
        BACKUP_PASS,
        new Date('2026-06-01T08:00:00Z')
      );
      expect(firstRun.executed).toBe(true);


      const secondRun = await backupService.runDailyAutoBackupIfNeeded(
        BACKUP_PASS,
        new Date('2026-06-01T14:00:00Z')
      );
      expect(secondRun.executed).toBe(false);
      expect(secondRun.reason).toBe('already_done_today');


      for (let i = 2; i <= 8; i++) {
        await backupService.createBackup(BACKUP_PASS, {
          customCreatedAt: `2026-06-0${i}T10:00:00.000Z`,
        });
      }

      const backups = await backupService.listBackups();
      expect(backups.length).toBeLessThanOrEqual(MAX_BACKUPS);
      expect(backups.length).toBe(7);
    });

    it('US41: restaura banco SQLite a partir de backup criptografado', async () => {

      const txMarcadora = await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: defaultCategory.id,
        value: 777.77,
        type: 'receita',
        description: 'Transação Marcadora Pré-Backup',
        date: '2026-06-10T12:00:00.000Z',
        is_recurring: false,
      });


      const { metadata, encryptedContent } = await backupService.createBackup(BACKUP_PASS);
      expect(metadata.id).toBeDefined();


      await transactionRepo.delete(txMarcadora.id);
      const afterDelete = await transactionRepo.findById(txMarcadora.id);
      expect(afterDelete).toBeNull();


      const restoreRes = await backupService.restoreBackup({
        rawEncryptedContent: encryptedContent,
        password: BACKUP_PASS,
        createSafetyBackupFirst: false,
      });

      expect(restoreRes.finalSchemaVersion).toBe(7);


      const restoredTx = await transactionRepo.findById(txMarcadora.id);
      expect(restoredTx).not.toBeNull();
      expect(restoredTx!.value).toBe(777.77);
      expect(restoredTx!.description).toBe('Transação Marcadora Pré-Backup');
    });

    it('US41: rejeita arquivo corrompido com byte alterado', () => {
      const payload = {
        app: 'OrcamentoFacil' as const,
        schemaVersion: 7,
        exportedAt: new Date().toISOString(),
        userId: USER_ID,
        tables: { categories: [] },
      };
      const envelope = encryptBackupPayload(payload, BACKUP_PASS);
      const corruptedEnvelope = {
        ...envelope,
        ciphertext: envelope.ciphertext.substring(0, envelope.ciphertext.length - 4) + 'AAAA',
      };
      expect(() => decryptBackupEnvelope(corruptedEnvelope, BACKUP_PASS)).toThrow();
    });

    it('US41: rejeita arquivo com versão de schema futura', async () => {
      const payload = {
        app: 'OrcamentoFacil' as const,
        schemaVersion: 99,
        exportedAt: new Date().toISOString(),
        userId: USER_ID,
        tables: { categories: [] },
      };
      const envelope = encryptBackupPayload(payload, BACKUP_PASS);
      const rawEncryptedContent = JSON.stringify(envelope);

      await expect(
        backupService.restoreBackup({
          rawEncryptedContent,
          password: BACKUP_PASS,
          createSafetyBackupFirst: false,
        })
      ).rejects.toThrow('incompatível com a versão atual');
    });

    it('US41: cria backup de segurança antes de aplicar restauração', async () => {
      const { encryptedContent } = await backupService.createBackup(BACKUP_PASS);
      const beforeCount = (await backupService.listBackups()).length;

      await backupService.restoreBackup({
        rawEncryptedContent: encryptedContent,
        password: BACKUP_PASS,
        createSafetyBackupFirst: true,
      });

      const afterCount = (await backupService.listBackups()).length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    });
  });




  describe('US42 & US43: Central de Contas Fixas e Lembretes de Vencimento', () => {
    it('US42: agenda notificação com antecedência configurada antes do vencimento', async () => {

      const bill = await manageBillsUseCase.createBill(
        {
          name: 'Internet Fibra 500MB',
          value: 119.9,
          due_day: 15,
          reminder_days_before: 3,
          category_id: defaultCategory.id,
          account_id: defaultAccount.id,
        },
        new Date('2026-07-01T12:00:00Z')
      );

      expect(bill.id).toBeDefined();


      const scheduled = NotificationService.getScheduledNotifications();
      const billReminder = scheduled.find((n) => n.id.includes(bill.id));

      expect(billReminder).toBeDefined();
      expect(billReminder!.title).toBe('Lembrete de Conta Fixa');
      expect(billReminder!.message).toContain('Internet Fibra 500MB');

      expect(billReminder!.date!.getUTCDate()).toBe(12);
    });

    it('US43: lista contas fixas do mês ordenadas por vencimento e reflete status em_dia, vence_em_breve, vencida e paga', async () => {

      const billVencida = await manageBillsUseCase.createBill(
        {
          name: 'Condomínio',
          value: 450.0,
          due_day: 5,
          reminder_days_before: 2,
          category_id: defaultCategory.id,
        },
        new Date('2026-08-01T12:00:00Z')
      );


      const billEmBreve = await manageBillsUseCase.createBill(
        {
          name: 'Energia Elétrica Enel',
          value: 180.0,
          due_day: 12,
          reminder_days_before: 3,
          category_id: defaultCategory.id,
        },
        new Date('2026-08-01T12:00:00Z')
      );


      const billEmDia = await manageBillsUseCase.createBill(
        {
          name: 'Plano de Saúde',
          value: 350.0,
          due_day: 28,
          reminder_days_before: 3,
          category_id: defaultCategory.id,
        },
        new Date('2026-08-01T12:00:00Z')
      );


      const refDateAug10 = new Date('2026-08-10T12:00:00Z');
      const listAug = await manageBillsUseCase.listBillsForMonth(8, 2026, refDateAug10);

      const statusVencida = listAug.find((b) => b.id === billVencida.id);
      expect(statusVencida).toBeDefined();
      expect(statusVencida!.status).toBe('vencida');

      const statusEmBreve = listAug.find((b) => b.id === billEmBreve.id);
      expect(statusEmBreve).toBeDefined();
      expect(statusEmBreve!.status).toBe('vence_em_breve');

      const statusEmDia = listAug.find((b) => b.id === billEmDia.id);
      expect(statusEmDia).toBeDefined();
      expect(statusEmDia!.status).toBe('em_dia');


      await manageBillsUseCase.markAsPaid({
        billId: billVencida.id,
        month: 8,
        year: 2026,
        createExpenseTransaction: true,
        accountId: defaultAccount.id,
      });


      const listAfterPaid = await manageBillsUseCase.listBillsForMonth(8, 2026, refDateAug10);
      const paidItem = listAfterPaid.find((b) => b.id === billVencida.id);
      expect(paidItem!.status).toBe('paga');
      expect(paidItem!.isPaidInCurrentMonth).toBe(true);


      const txs = await transactionRepo.findAll({ accountId: defaultAccount.id });
      const createdTx = txs.find((t) => t.description === 'Condomínio');
      expect(createdTx).toBeDefined();
      expect(createdTx!.value).toBe(450.0);
    });

    it('US42: calcula próximo vencimento para dia 31 em fevereiro ajustando para 28 ou 29', () => {
      const baseBill: RecurringBill = {
        id: 'bill-31',
        name: 'Conta Dia 31',
        value: 100,
        due_day: 31,
        reminder_days_before: 3,
        category_id: defaultCategory.id,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      };

      const feb2026 = calculateBillStatusAndNextDue(
        baseBill,
        new Date('2026-02-10T12:00:00Z'),
        null,
        2,
        2026
      );
      expect(feb2026.nextDueDateIso.substring(0, 10)).toBe('2026-02-28');

      const feb2024 = calculateBillStatusAndNextDue(
        baseBill,
        new Date('2024-02-10T12:00:00Z'),
        null,
        2,
        2024
      );
      expect(feb2024.nextDueDateIso.substring(0, 10)).toBe('2024-02-29');

      const apr2026 = calculateBillStatusAndNextDue(
        baseBill,
        new Date('2026-04-10T12:00:00Z'),
        null,
        4,
        2026
      );
      expect(apr2026.nextDueDateIso.substring(0, 10)).toBe('2026-04-30');
    });
  });




  describe('US49: Etiquetas com Cores para Identificação Visual', () => {
    it('persiste e recupera color_label em transações', async () => {
      const redTx = await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: defaultCategory.id,
        value: 85.0,
        type: 'despesa',
        description: 'Compra com Etiqueta Urgente',
        date: '2026-09-01T12:00:00.000Z',
        is_recurring: false,
        color_label: '#EF4444',
      });

      expect(redTx.color_label).toBe('#EF4444');

      const retrieved = await transactionRepo.findById(redTx.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.color_label).toBe('#EF4444');


      const updated = await transactionRepo.update(redTx.id, {
        color_label: '#3B82F6',
      });
      expect(updated.color_label).toBe('#3B82F6');
    });
  });




  describe('US50: Tags Livres em Transações e Busca Avançada por Tags', () => {
    it('sincroniza tags normalizadas na tabela tags/transaction_tags e permite busca filtrada', async () => {
      const txWithTags = await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: defaultCategory.id,
        value: 250.0,
        type: 'despesa',
        description: 'Jantar com Clientes',
        date: '2026-09-05T12:00:00.000Z',
        is_recurring: false,
        tags: ['#trabalho', 'reembolsavel', 'REUNIÃO'],
      });


      expect(txWithTags.tags).toEqual(expect.arrayContaining(['trabalho', 'reembolsavel', 'REUNIÃO']));


      const allTags = await transactionRepo.getAllTags();
      expect(allTags.map((t) => t.toLowerCase())).toEqual(
        expect.arrayContaining(['trabalho', 'reembolsavel', 'reunião'])
      );


      const searchReembolsavel = await transactionRepo.findAll({
        tag: 'reembolsavel',
      });
      expect(searchReembolsavel.some((t) => t.id === txWithTags.id)).toBe(true);


      const searchMulti = await transactionRepo.findAll({
        tags: ['trabalho', 'inexistente'],
      });
      expect(searchMulti.some((t) => t.id === txWithTags.id)).toBe(true);
    });
  });




  describe('US51: Status Pendente e Conciliação Manual', () => {
    it('transações pendentes não impactam o saldo confirmado até que sejam conciliadas', async () => {
      const statementUseCase = new BuildStatementUseCase(accountRepo, transactionRepo);


      const stmtBefore = await statementUseCase.execute({
        month: 9,
        year: 2026,
        accountId: defaultAccount.id,
        asOfDate: '2026-09-30T23:59:59.000Z',
      });

      const balanceBefore = stmtBefore.closingBalance;


      const pendingTx = await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: defaultCategory.id,
        value: 300.0,
        type: 'despesa',
        description: 'Cheque Pré-datado Pendente',
        date: '2026-09-10T12:00:00.000Z',
        is_recurring: false,
        status: 'pendente',
      });

      expect(pendingTx.status).toBe('pendente');


      const stmtWithPending = await statementUseCase.execute({
        month: 9,
        year: 2026,
        accountId: defaultAccount.id,
        asOfDate: '2026-09-30T23:59:59.000Z',
      });

      expect(stmtWithPending.closingBalance).toBe(balanceBefore);
      const hasPendingInLines = stmtWithPending.lines.some((l) => l.transaction.id === pendingTx.id);
      expect(hasPendingInLines).toBe(false);


      await transactionRepo.update(pendingTx.id, {
        status: 'confirmada',
      });


      const stmtConfirmed = await statementUseCase.execute({
        month: 9,
        year: 2026,
        accountId: defaultAccount.id,
        asOfDate: '2026-09-30T23:59:59.000Z',
      });

      expect(stmtConfirmed.closingBalance).toBe(Number((balanceBefore - 300.0).toFixed(2)));
    });
  });




  describe('US52: Controle Sensorial e Desativação de Som', () => {
    it('permite desativar o som persistindo a preferência e alternando para canal silencioso', async () => {

      const resDisable = await notificationService.setSoundEnabled(false);
      expect(resDisable.soundEnabled).toBe(false);
      expect(resDisable.channelId).toBe(SILENT_CHANNEL_ID);
      expect(NotificationService.getActiveChannelId()).toBe(SILENT_CHANNEL_ID);


      const isSound = await notificationService.isSoundEnabled();
      expect(isSound).toBe(false);


      await notificationService.sendLocalNotification({
        id: 'test-silent-notif',
        title: 'Alerta Discreto',
        message: 'Notificação sem sinal sonoro mantendo exibição visual',
      });

      const delivered = NotificationService.getDeliveredNotifications();
      const lastDelivered = delivered.find((n) => n.id === 'test-silent-notif');
      expect(lastDelivered).toBeDefined();
      expect(lastDelivered!.channelId).toBe(SILENT_CHANNEL_ID);
      expect(lastDelivered!.silent).toBe(true);


      const resEnable = await notificationService.setSoundEnabled(true);
      expect(resEnable.soundEnabled).toBe(true);
      expect(resEnable.channelId).toBe(SOUND_CHANNEL_ID);
      expect(NotificationService.getActiveChannelId()).toBe(SOUND_CHANNEL_ID);
    });
  });
});
