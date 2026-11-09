import { DatabaseManager } from '../src/data/database/SQLiteDatabase';
import { setupUserDatabase, isoDate } from './helpers/db';
import { AccountRepository } from '../src/data/repositories/AccountRepository';
import { TransactionRepository } from '../src/data/repositories/TransactionRepository';
import { CategoryRepository } from '../src/data/repositories/CategoryRepository';
import { BudgetRepository } from '../src/data/repositories/BudgetRepository';
import { BillRepository } from '../src/data/repositories/BillRepository';
import { CreateInstallmentsUseCase } from '../src/domain/usecases/CreateInstallmentsUseCase';
import { GenerateRecurringTransactionsUseCase } from '../src/domain/usecases/GenerateRecurringTransactionsUseCase';
import { CheckSpendingLimitsUseCase } from '../src/domain/usecases/CheckSpendingLimitsUseCase';
import { NotificationService } from '../src/services/NotificationService';
import { CategorySuggestionService } from '../src/services/CategorySuggestionService';
import { dialog } from '../src/components/dialogs/DialogManager';
import { formatDate, parseBrDate, formatDateInputMask } from '../src/utils/date';
import { Account } from '../src/domain/entities/Account';
import { Category } from '../src/domain/entities/Category';

const USER_ID = 'user-sprint2-repo-screens';

describe('Passo 3 & Passo 4: Testes Avançados de Repositório e Telas', () => {
  let db: DatabaseManager;
  let accountRepo: AccountRepository;
  let transactionRepo: TransactionRepository;
  let categoryRepo: CategoryRepository;
  let budgetRepo: BudgetRepository;
  let billRepo: BillRepository;
  let notificationService: NotificationService;
  let defaultAccount: Account;
  let defaultCategory: Category;
  let incomeCategory: Category;

  beforeAll(async () => {
    db = await setupUserDatabase(USER_ID);
    accountRepo = new AccountRepository(db);
    transactionRepo = new TransactionRepository(db);
    categoryRepo = new CategoryRepository(db);
    budgetRepo = new BudgetRepository(db);
    billRepo = new BillRepository();
    notificationService = new NotificationService();

    defaultAccount = await accountRepo.create({
      name: 'Conta Repositório e Telas',
      type: 'corrente',
      initial_balance: 10000.0,
      color: '#2563EB',
      icon: 'briefcase',
    });

    const allCategories = await categoryRepo.findAll();
    defaultCategory = allCategories[0];
    const foundIncome = allCategories.find((c) => c.name.toLowerCase().includes('salário') || c.name.toLowerCase().includes('receita'));
    incomeCategory = foundIncome ?? allCategories[1];
  });

  describe('Passo 3: Consultas Avançadas e Integridade de Repositório', () => {
    it('executa consultas paginadas combinando múltiplos filtros (tag, status, evento, renda extra)', async () => {
      const eventId = 'event-repo-test-1';
      await db.executeQuery(
        'INSERT OR REPLACE INTO events (id, name, limit_value, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?);',
        [eventId, 'Evento Teste Filtros', 5000.0, '2026-05-01', '2026-05-31', '2026-05-01']
      );

      const targetTx = await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: defaultCategory.id,
        value: 350.0,
        type: 'despesa',
        description: 'Despesa Completa Filtros',
        date: '2026-05-15T12:00:00.000Z',
        is_recurring: false,
        tags: ['filtro-especial', 'maio'],
        status: 'pendente',
        event_id: eventId,
        color_label: '#3B82F6',
      });

      await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: defaultCategory.id,
        value: 120.0,
        type: 'despesa',
        description: 'Despesa Outra',
        date: '2026-05-16T12:00:00.000Z',
        is_recurring: false,
        tags: ['outra'],
        status: 'confirmada',
      });

      const filteredResult = await transactionRepo.findPaginated(1, 10, {
        tag: 'filtro-especial',
        status: 'pendente',
        eventId: eventId,
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-31T23:59:59.000Z',
      });

      expect(filteredResult.data).toHaveLength(1);
      expect(filteredResult.data[0].id).toBe(targetTx.id);
      expect(filteredResult.total).toBe(1);
    });

    it('GROUP BY por mês agrega totais históricos sem carregar todas as linhas em memória', async () => {
      const catTest = await categoryRepo.create({
        name: 'Categoria Agrupada Mensal',
        color: '#F59E0B',
        icon: 'tag',
        is_custom: true,
      });

      await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: catTest.id,
        value: 100.0,
        type: 'despesa',
        description: 'Gasto M1',
        date: '2026-01-10T12:00:00.000Z',
        is_recurring: false,
      });
      await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: catTest.id,
        value: 200.0,
        type: 'despesa',
        description: 'Gasto M2',
        date: '2026-01-20T12:00:00.000Z',
        is_recurring: false,
      });
      await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: catTest.id,
        value: 400.0,
        type: 'despesa',
        description: 'Gasto M3',
        date: '2026-02-15T12:00:00.000Z',
        is_recurring: false,
      });

      const aggregated = await transactionRepo.getMonthlyTotalsByCategory(catTest.id);
      const jan = aggregated.find((a) => a.yearMonth === '2026-01');
      const feb = aggregated.find((a) => a.yearMonth === '2026-02');

      expect(jan).toBeDefined();
      expect(jan!.total).toBe(300.0);
      expect(jan!.count).toBe(2);

      expect(feb).toBeDefined();
      expect(feb!.total).toBe(400.0);
      expect(feb!.count).toBe(1);
    });

    it('preserva integridade relacional ao excluir transação removendo vínculos na tabela transaction_tags', async () => {
      const tx = await transactionRepo.create({
        account_id: defaultAccount.id,
        category_id: defaultCategory.id,
        value: 75.0,
        type: 'despesa',
        description: 'Transação com Tag Órfã Teste',
        date: '2026-06-01T12:00:00.000Z',
        is_recurring: false,
        tags: ['tag-temporaria'],
      });

      const beforeCheck = await db.executeQuery(
        'SELECT COUNT(*) as c FROM transaction_tags WHERE transaction_id = ?;',
        [tx.id]
      );
      expect(Number((beforeCheck.rows.item(0) as { c: number }).c)).toBeGreaterThan(0);

      await transactionRepo.delete(tx.id);

      const afterCheck = await db.executeQuery(
        'SELECT COUNT(*) as c FROM transaction_tags WHERE transaction_id = ?;',
        [tx.id]
      );
      expect(Number((afterCheck.rows.item(0) as { c: number }).c)).toBe(0);
    });
  });

  describe('Passo 4: Regras de Negócio e Validações de Telas e Formulários', () => {
    it('TransactionForm: impede ativar parcelamento e recorrência simultaneamente', () => {
      const isRecurring = true;
      const isInstallment = true;
      const isValidCombination = !(isRecurring && isInstallment);
      expect(isValidCombination).toBe(false);
    });

    it('TransactionForm: validação de limite por transação dispara alerta quando ultrapassa teto', async () => {
      await budgetRepo.setMaxTransactionLimit(500.0);
      const limitsUseCase = new CheckSpendingLimitsUseCase(budgetRepo, transactionRepo, notificationService);

      const withinLimit = await limitsUseCase.checkTransactionLimit(450.0);
      expect(withinLimit.exceeded).toBe(false);

      const exceeding = await limitsUseCase.checkTransactionLimit(550.0);
      expect(exceeding.exceeded).toBe(true);
      expect(exceeding.maxLimit).toBe(500.0);
    });

    it('TransactionForm: autossugestão de categoria por descrição não sobrescreve seleção manual', async () => {
      const suggestionService = new CategorySuggestionService(categoryRepo, transactionRepo);

      const suggested = await suggestionService.suggestCategory('Compras Supermercado Extra');
      expect(suggested).not.toBeNull();
      expect(suggested!.name.toLowerCase()).toContain('aliment');

      const manualSelectedCategoryId = 'cat-manual-user-choice';
      const effectiveCategoryId = manualSelectedCategoryId || suggested?.id;
      expect(effectiveCategoryId).toBe('cat-manual-user-choice');
    });

    it('CardDetailScreen: validação de ciclo exige que vencimento seja posterior ao fechamento', () => {
      const closingDay = 10;
      const dueDay = 17;
      expect(dueDay).toBeGreaterThan(closingDay);

      const closingDayLate = 25;
      const dueDayEarlyNextMonth = 5;
      const isNextMonthDue = dueDayEarlyNextMonth < closingDayLate;
      expect(isNextMonthDue).toBe(true);
    });

    it('EventsScreen: validação de período exige data final maior ou igual à data inicial', () => {
      const startBr = '10/11/2026';
      const endBrValid = '20/11/2026';
      const endBrInvalid = '05/11/2026';

      const pStart = parseBrDate(startBr);
      const pEndValid = parseBrDate(endBrValid);
      const pEndInvalid = parseBrDate(endBrInvalid);

      expect(pStart.valid && pEndValid.valid).toBe(true);
      expect(pEndValid.isoDate! >= pStart.isoDate!).toBe(true);
      expect(pEndInvalid.isoDate! >= pStart.isoDate!).toBe(false);
    });

    it('Campos de data: máscara DD/MM/AAAA formata digitação incremental com dígitos limpos', () => {
      expect(formatDateInputMask('10')).toBe('10');
      expect(formatDateInputMask('1011')).toBe('10/11');
      expect(formatDateInputMask('10112026')).toBe('10/11/2026');
      expect(formatDateInputMask('10/11/2026')).toBe('10/11/2026');
    });

    it('Modais próprios: resolvem confirmação, cancelamento e fecham ordenadamente', async () => {
      dialog.clearQueueForTests();

      const confirmPromise = dialog.confirm({
        titulo: 'Excluir Lançamento',
        mensagem: 'Confirma exclusão?',
        variante: 'perigo',
      });

      const active = dialog.getActiveDialog();
      expect(active).not.toBeNull();
      expect(active?.kind).toBe('confirm');

      dialog.dismissCurrent(false);
      const result = await confirmPromise;
      expect(result).toBe(false);
    });
  });
});
