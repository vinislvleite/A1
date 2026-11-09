import { DatabaseManager } from '../src/data/database/SQLiteDatabase';
import { setupUserDatabase, isoDate } from './helpers/db';
import { AccountRepository } from '../src/data/repositories/AccountRepository';
import { TransactionRepository } from '../src/data/repositories/TransactionRepository';
import { CategoryRepository } from '../src/data/repositories/CategoryRepository';
import { BudgetRepository } from '../src/data/repositories/BudgetRepository';
import {
  CalculateBudgetProgressUseCase,
  calculateEffectiveFlexibleLimit,
} from '../src/domain/usecases/CalculateBudgetProgressUseCase';
import {
  ZeroBasedBudgetUseCase,
  calculateZeroBasedSummary,
} from '../src/domain/usecases/ZeroBasedBudgetUseCase';
import { EventBudgetUseCase } from '../src/domain/usecases/EventBudgetUseCase';
import {
  CheckSpendingLimitsUseCase,
  getWeekdayFromYmd,
} from '../src/domain/usecases/CheckSpendingLimitsUseCase';
import {
  CategorySpendingGoalsUseCase,
  evaluateSpendingGoalStatus,
} from '../src/domain/usecases/CategorySpendingGoalsUseCase';
import { CategorySuggestionService } from '../src/services/CategorySuggestionService';
import { NotificationService } from '../src/services/NotificationService';
import { Account } from '../src/domain/entities/Account';
import { Category } from '../src/domain/entities/Category';

const USER_ID = 'user-sprint2-budgets-limits';

describe('Sprint 2: Orçamentos Avançados, Tetos, Metas e Categorias', () => {
  let db: DatabaseManager;
  let accountRepo: AccountRepository;
  let transactionRepo: TransactionRepository;
  let categoryRepo: CategoryRepository;
  let budgetRepo: BudgetRepository;
  let notificationService: NotificationService;
  let testAccount: Account;
  let catAlimentacao: Category;
  let catTransporte: Category;
  let catLazer: Category;

  beforeAll(async () => {
    db = await setupUserDatabase(USER_ID);
    accountRepo = new AccountRepository(db);
    transactionRepo = new TransactionRepository(db);
    categoryRepo = new CategoryRepository(db);
    budgetRepo = new BudgetRepository(db);
    notificationService = new NotificationService();

    testAccount = await accountRepo.create({
      name: 'Conta Principal US32-48',
      type: 'corrente',
      initial_balance: 10000.0,
      color: '#2563EB',
      icon: 'briefcase',
    });

    const allCategories = await categoryRepo.findAll();
    catAlimentacao = allCategories.find((c) => c.name.toLowerCase().includes('aliment'))!;
    catTransporte = allCategories.find((c) => c.name.toLowerCase().includes('transp'))!;
    catLazer = allCategories.find((c) => c.name.toLowerCase().includes('lazer'))!;
  });




  describe('US32: Orçamento Anual por Categoria', () => {
    it('cadastra e calcula o progresso de orçamento com periodicidade anual', async () => {

      await budgetRepo.create({
        category_id: catAlimentacao.id,
        month: 0,
        year: 2026,
        limit_value: 12000.0,
        period_type: 'anual',
        budget_mode: 'fixo',
      });


      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catAlimentacao.id,
        value: 1500.0,
        type: 'despesa',
        description: 'Supermercado Janeiro',
        date: '2026-01-15T12:00:00.000Z',
        is_recurring: false,
      });

      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catAlimentacao.id,
        value: 2000.0,
        type: 'despesa',
        description: 'Supermercado Fevereiro',
        date: '2026-02-15T12:00:00.000Z',
        is_recurring: false,
      });

      const useCase = new CalculateBudgetProgressUseCase(budgetRepo, categoryRepo, transactionRepo);
      const annualProgress = await useCase.executeAnnual(2026);

      expect(annualProgress.periodType).toBe('anual');
      expect(annualProgress.year).toBe(2026);

      const catProgress = annualProgress.categories.find((c) => c.categoryId === catAlimentacao.id);
      expect(catProgress).toBeDefined();
      expect(catProgress!.limitValue).toBe(12000.0);
      expect(catProgress!.spentValue).toBe(3500.0);
      expect(catProgress!.remainingValue).toBe(8500.0);
      expect(catProgress!.percentageSpent).toBe(29.17);
      expect(catProgress!.isWarning).toBe(false);
      expect(catProgress!.isExceeded).toBe(false);
    });
  });




  describe('US33: Orçamento Flexível Dinâmico', () => {
    it('calculateEffectiveFlexibleLimit adapta o teto conforme variação da receita mensal', () => {

      const flex1 = calculateEffectiveFlexibleLimit({
        budgetMode: 'percentual',
        fixedLimit: 0,
        percentageValue: 20,
        monthlyIncome: 5000,
      });
      expect(flex1.effectiveLimit).toBe(1000.0);
      expect(flex1.missingIncomeWarning).toBe(false);


      const flexZero = calculateEffectiveFlexibleLimit({
        budgetMode: 'percentual',
        fixedLimit: 0,
        percentageValue: 20,
        monthlyIncome: 0,
      });
      expect(flexZero.effectiveLimit).toBe(0);
      expect(flexZero.missingIncomeWarning).toBe(true);
    });

    it('recalcula o limite da categoria no execute() quando a receita do mês varia', async () => {

      await budgetRepo.create({
        category_id: catLazer.id,
        month: 7,
        year: 2026,
        limit_value: 0,
        period_type: 'mensal',
        budget_mode: 'percentual',
        percentage_value: 15,
      });


      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catLazer.id,
        value: 8000.0,
        type: 'receita',
        description: 'Receita Julho Salário + Bônus',
        date: '2026-07-05T12:00:00.000Z',
        is_recurring: false,
      });


      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catLazer.id,
        value: 600.0,
        type: 'despesa',
        description: 'Cinema e Viagem Fim de Semana',
        date: '2026-07-15T12:00:00.000Z',
        is_recurring: false,
      });

      const useCase = new CalculateBudgetProgressUseCase(budgetRepo, categoryRepo, transactionRepo);
      const res = await useCase.execute(7, 2026);

      const lazerProgress = res.categories.find((c) => c.categoryId === catLazer.id);
      expect(lazerProgress).toBeDefined();
      expect(lazerProgress!.budgetMode).toBe('percentual');
      expect(lazerProgress!.percentageValue).toBe(15);
      expect(lazerProgress!.limitValue).toBe(1200.0);
      expect(lazerProgress!.spentValue).toBe(600.0);
      expect(lazerProgress!.remainingValue).toBe(600.0);
      expect(lazerProgress!.percentageSpent).toBe(50.0);
    });
  });




  describe('US34: Orçamento Base Zero (Zero-Based)', () => {
    it('calculateZeroBasedSummary valida se 100% da receita foi intencionalmente alocada', () => {

      const balanced = calculateZeroBasedSummary(5000.0, [
        { group_type: 'gastos', allocated_value: 3000.0 },
        { group_type: 'poupanca', allocated_value: 1000.0 },
        { group_type: 'investimentos', allocated_value: 1000.0 },
      ]);

      expect(balanced.expectedIncome).toBe(5000.0);
      expect(balanced.totalAllocated).toBe(5000.0);
      expect(balanced.remainingToAllocate).toBe(0.0);
      expect(balanced.isZeroBalanced).toBe(true);
      expect(balanced.isOverAllocated).toBe(false);


      const over = calculateZeroBasedSummary(5000.0, [
        { group_type: 'gastos', allocated_value: 4000.0 },
        { group_type: 'poupanca', allocated_value: 1500.0 },
      ]);
      expect(over.totalAllocated).toBe(5500.0);
      expect(over.remainingToAllocate).toBe(-500.0);
      expect(over.isZeroBalanced).toBe(false);
      expect(over.isOverAllocated).toBe(true);
    });

    it('persiste e recarrega alocações do mês no banco SQLite via ZeroBasedBudgetUseCase', async () => {
      const useCase = new ZeroBasedBudgetUseCase(budgetRepo);

      const saved = await useCase.saveMonth({
        month: 8,
        year: 2026,
        expectedIncome: 6000.0,
        items: [
          { group_type: 'gastos', category_name: 'Moradia e Contas', allocated_value: 2500.0 },
          { group_type: 'gastos', category_name: 'Alimentação', allocated_value: 1500.0 },
          { group_type: 'poupanca', category_name: 'Reserva de Emergência', allocated_value: 1000.0 },
          { group_type: 'investimentos', category_name: 'Tesouro Direto', allocated_value: 1000.0 },
        ],
      });

      expect(saved.summary.isZeroBalanced).toBe(true);
      expect(saved.allocations).toHaveLength(4);


      const loaded = await useCase.loadMonth(8, 2026);
      expect(loaded.summary.isZeroBalanced).toBe(true);
      expect(loaded.summary.expectedIncome).toBe(6000.0);
      expect(loaded.summary.gastosTotal).toBe(4000.0);
      expect(loaded.summary.poupancaTotal).toBe(1000.0);
      expect(loaded.summary.investimentosTotal).toBe(1000.0);
      expect(loaded.allocations).toHaveLength(4);
    });
  });




  describe('US35: Orçamento Isolado por Evento', () => {
    it('acompanha teto específico de evento e não mistura com orçamentos mensais de categorias', async () => {
      const useCase = new EventBudgetUseCase(budgetRepo, transactionRepo);


      const event = await useCase.createEvent({
        name: 'Viagem Férias Bahia',
        limit_value: 4000.0,
        start_date: '2026-09-10',
        end_date: '2026-09-20',
      });

      expect(event.id).toBeDefined();
      expect(event.name).toBe('Viagem Férias Bahia');


      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catAlimentacao.id,
        value: 3700.0,
        type: 'despesa',
        description: 'Resort All-Inclusive Bahia',
        date: '2026-09-12T12:00:00.000Z',
        is_recurring: false,
        event_id: event.id,
      });

      const eventsProgress = await useCase.listEventsWithProgress();
      const thisEvent = eventsProgress.find((e) => e.event.id === event.id);

      expect(thisEvent).toBeDefined();
      expect(thisEvent!.spentValue).toBe(3700.0);
      expect(thisEvent!.remainingValue).toBe(300.0);
      expect(thisEvent!.percentageSpent).toBe(92.5);
      expect(thisEvent!.isWarning).toBe(true);
      expect(thisEvent!.isExceeded).toBe(false);


      const normalCategoryTxs = await transactionRepo.findAll({
        categoryId: catAlimentacao.id,
        excludeEvents: true,
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-30T23:59:59.000Z',
      });
      const hasEventTx = normalCategoryTxs.some((t) => t.event_id === event.id);
      expect(hasEventTx).toBe(false);
    });
  });





  describe('US36 & US37: Tetos e Limites de Gastos (Diário e Individual)', () => {
    it('US36: getWeekdayFromYmd extrai o dia da semana correto em UTC', () => {

      expect(getWeekdayFromYmd('2026-11-08')).toBe(0);
      expect(getWeekdayFromYmd('2026-11-09')).toBe(1);
      expect(getWeekdayFromYmd('2026-11-14')).toBe(6);
    });

    it('US36: monitora teto diário variável e alerta quando os gastos do dia excedem o teto', async () => {

      await budgetRepo.setDailyLimit(1, 150.0);

      const limitsUseCase = new CheckSpendingLimitsUseCase(
        budgetRepo,
        transactionRepo,
        notificationService
      );


      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catAlimentacao.id,
        value: 100.0,
        type: 'despesa',
        description: 'Almoço Executivo Segunda',
        date: '2026-10-05T12:00:00.000Z',
        is_recurring: false,
      });

      const check1 = await limitsUseCase.checkDailyLimitAfterExpense('2026-10-05T12:00:00.000Z');
      expect(check1.exceeded).toBe(false);
      expect(check1.totalDaySpent).toBe(100.0);
      expect(check1.dailyLimit).toBe(150.0);


      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catTransporte.id,
        value: 80.0,
        type: 'despesa',
        description: 'Combustível Segunda Noite',
        date: '2026-10-05T19:00:00.000Z',
        is_recurring: false,
      });

      const check2 = await limitsUseCase.checkDailyLimitAfterExpense('2026-10-05T19:00:00.000Z');
      expect(check2.exceeded).toBe(true);
      expect(check2.totalDaySpent).toBe(180.0);
      expect(check2.notified).toBe(true);
    });

    it('US37: valida limite máximo individual por transação', async () => {

      await budgetRepo.setMaxTransactionLimit(800.0);

      const limitsUseCase = new CheckSpendingLimitsUseCase(
        budgetRepo,
        transactionRepo,
        notificationService
      );

      const belowLimit = await limitsUseCase.checkTransactionLimit(550.0);
      expect(belowLimit.exceeded).toBe(false);
      expect(belowLimit.maxLimit).toBe(800.0);

      const aboveLimit = await limitsUseCase.checkTransactionLimit(1200.0);
      expect(aboveLimit.exceeded).toBe(true);
      expect(aboveLimit.maxLimit).toBe(800.0);
    });
  });




  describe('US38: Metas de Gastos por Categoria', () => {
    it('evaluateSpendingGoalStatus classifica em cumprida, em_risco (>=80%) e estourada (>100%)', () => {
      expect(evaluateSpendingGoalStatus(400, 1000).status).toBe('cumprida');
      expect(evaluateSpendingGoalStatus(850, 1000).status).toBe('em_risco');
      expect(evaluateSpendingGoalStatus(1050, 1000).status).toBe('estourada');
    });

    it('executa avaliação das metas cadastradas confrontando gastos reais do mês', async () => {

      await budgetRepo.setCategorySpendingGoal(catTransporte.id, 500.0);


      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catTransporte.id,
        value: 420.0,
        type: 'despesa',
        description: 'Uber e Recarga Bilhete',
        date: '2026-05-15T12:00:00.000Z',
        is_recurring: false,
      });

      const goalsUseCase = new CategorySpendingGoalsUseCase(
        budgetRepo,
        categoryRepo,
        transactionRepo
      );
      const results = await goalsUseCase.execute(5, 2026);

      const transpGoal = results.find((g) => g.goal.category_id === catTransporte.id);
      expect(transpGoal).toBeDefined();
      expect(transpGoal!.maxMonthlyValue).toBe(500.0);
      expect(transpGoal!.spentValue).toBe(420.0);
      expect(transpGoal!.percentageSpent).toBe(84.0);
      expect(transpGoal!.status).toBe('em_risco');
    });
  });




  describe('US46, US47 & US48: Categorias, Histórico Mensal e Autossugestão', () => {
    it('US46: getMonthlyTotalsByCategory retorna o histórico de gastos agrupado por mês', async () => {

      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catAlimentacao.id,
        value: 300.0,
        type: 'despesa',
        description: 'Restaurante Novembro',
        date: '2026-11-01T12:00:00.000Z',
        is_recurring: false,
      });

      await transactionRepo.create({
        account_id: testAccount.id,
        category_id: catAlimentacao.id,
        value: 200.0,
        type: 'despesa',
        description: 'Lanchonete Novembro',
        date: '2026-11-02T12:00:00.000Z',
        is_recurring: false,
      });

      const history = await transactionRepo.getMonthlyTotalsByCategory(catAlimentacao.id);
      expect(history.length).toBeGreaterThan(0);

      const nov = history.find((h) => h.yearMonth === '2026-11');
      expect(nov).toBeDefined();
      expect(nov!.total).toBeGreaterThanOrEqual(500.0);
      expect(nov!.count).toBeGreaterThanOrEqual(2);
    });

    it('US47: permite cadastrar e recuperar descrição detalhada na categoria', async () => {
      const customCategory = await categoryRepo.create({
        name: 'Pets e Veterinário',
        description: 'Rações, consultas veterinárias, vacinas e banho/tosa',
        color: '#10B981',
        icon: 'heart',
        is_custom: true,
      });

      expect(customCategory.id).toBeDefined();
      expect(customCategory.description).toBe('Rações, consultas veterinárias, vacinas e banho/tosa');

      const fetched = await categoryRepo.findById(customCategory.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.description).toBe('Rações, consultas veterinárias, vacinas e banho/tosa');
    });

    it('US48: sugere automaticamente a categoria com base em palavras-chave da descrição', async () => {
      const suggestionService = new CategorySuggestionService(categoryRepo, transactionRepo);


      const s1 = await suggestionService.suggestCategory('Compras no Carrefour Supermercado');
      expect(s1).not.toBeNull();
      expect(s1!.name.toLowerCase()).toContain('aliment');


      const s2 = await suggestionService.suggestCategory('Corrida Uber até o escritório');
      expect(s2).not.toBeNull();
      expect(s2!.name.toLowerCase()).toContain('transp');


      const s3 = await suggestionService.suggestCategory('Medicamento na Drogasil');
      expect(s3).not.toBeNull();
      expect(s3!.name.toLowerCase()).toContain('saúde');
    });
  });
});
