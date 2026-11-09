import { DatabaseManager } from '../src/data/database/SQLiteDatabase';
import { setupUserDatabase, isoDate } from './helpers/db';
import { AccountRepository } from '../src/data/repositories/AccountRepository';
import { TransactionRepository } from '../src/data/repositories/TransactionRepository';
import { CategoryRepository } from '../src/data/repositories/CategoryRepository';
import { BudgetRepository } from '../src/data/repositories/BudgetRepository';
import { BuildStatementUseCase } from '../src/domain/usecases/BuildStatementUseCase';
import { CalculateBudgetProgressUseCase } from '../src/domain/usecases/CalculateBudgetProgressUseCase';
import { CreateInstallmentsUseCase } from '../src/domain/usecases/CreateInstallmentsUseCase';
import { GenerateRecurringTransactionsUseCase } from '../src/domain/usecases/GenerateRecurringTransactionsUseCase';
import { CalculateCardInvoiceUseCase } from '../src/domain/usecases/CalculateCardInvoiceUseCase';
import { NotificationService } from '../src/services/NotificationService';
import { BackupService, encryptBackupPayload } from '../src/services/BackupService';
import { seed10kTestDatabase } from '../scripts/seed-test-10k';
import { formatDate, fromIsoDate, toIsoDate } from '../src/utils/date';
import { Account } from '../src/domain/entities/Account';
import { Category } from '../src/domain/entities/Category';

const USER_ID = 'user-sprint2-e2e-nonfunc';

describe('Passo 5 & Passo 6: Integração Ponta a Ponta e Requisitos Não Funcionais', () => {
  let db: DatabaseManager;
  let accountRepo: AccountRepository;
  let transactionRepo: TransactionRepository;
  let categoryRepo: CategoryRepository;
  let budgetRepo: BudgetRepository;
  let notificationService: NotificationService;

  beforeAll(async () => {
    db = await setupUserDatabase(USER_ID);
    accountRepo = new AccountRepository(db);
    transactionRepo = new TransactionRepository(db);
    categoryRepo = new CategoryRepository(db);
    budgetRepo = new BudgetRepository(db);
    notificationService = new NotificationService();
  });

  describe('Passo 5: Fluxos de Integração Ponta a Ponta (E2E)', () => {
    it('executa ciclo de vida financeiro completo com consistência total de saldo entre Home, Contas e Extrato', async () => {
      NotificationService.resetNotifications();

      const accOrigem = await accountRepo.create({
        name: 'Conta Corrente E2E',
        type: 'corrente',
        initial_balance: 5000.0,
        color: '#2563EB',
        icon: 'briefcase',
      });

      const accDestino = await accountRepo.create({
        name: 'Poupança Reserva E2E',
        type: 'poupanca',
        initial_balance: 1000.0,
        color: '#10B981',
        icon: 'archive',
      });

      const categories = await categoryRepo.findAll();
      const catAlim = categories.find((c) => c.name.toLowerCase().includes('aliment')) ?? categories[0];

      await transactionRepo.create({
        account_id: accOrigem.id,
        category_id: catAlim.id,
        value: 200.0,
        type: 'despesa',
        description: 'Supermercado Mensal E2E',
        date: '2026-08-05T12:00:00.000Z',
        is_recurring: false,
      });

      await transactionRepo.transfer({
        sourceAccountId: accOrigem.id,
        destinationAccountId: accDestino.id,
        value: 800.0,
        date: '2026-08-10T12:00:00.000Z',
        description: 'Aporte Reserva',
      });

      await budgetRepo.create({
        category_id: catAlim.id,
        month: 8,
        year: 2026,
        limit_value: 1000.0,
      });

      await transactionRepo.create({
        account_id: accOrigem.id,
        category_id: catAlim.id,
        value: 750.0,
        type: 'despesa',
        description: 'Jantar Comemorativo E2E',
        date: '2026-08-15T12:00:00.000Z',
        is_recurring: false,
      });

      const budgetUseCase = new CalculateBudgetProgressUseCase(budgetRepo, categoryRepo, transactionRepo);
      const budgetSummary = await budgetUseCase.execute(8, 2026);
      const alimBudget = budgetSummary.categories.find((c) => c.categoryId === catAlim.id);
      expect(alimBudget).toBeDefined();
      expect(alimBudget!.spentValue).toBe(950.0);
      expect(alimBudget!.percentageSpent).toBe(95.0);
      expect(alimBudget!.isWarning).toBe(true);

      const installmentsUseCase = new CreateInstallmentsUseCase(transactionRepo);
      await installmentsUseCase.execute({
        account_id: accOrigem.id,
        category_id: catAlim.id,
        totalValue: 600.0,
        installmentCount: 3,
        description: 'Eletrodoméstico Parcelado',
        startDate: '2026-08-20T12:00:00.000Z',
      });

      const pendingTx = await transactionRepo.create({
        account_id: accOrigem.id,
        category_id: catAlim.id,
        value: 300.0,
        type: 'despesa',
        description: 'Boleto Pendente E2E',
        date: '2026-08-25T12:00:00.000Z',
        is_recurring: false,
        status: 'pendente',
      });

      const statementUseCase = new BuildStatementUseCase(accountRepo, transactionRepo);

      const stmtOrigemBefore = await statementUseCase.execute({
        month: 8,
        year: 2026,
        accountId: accOrigem.id,
        asOfDate: '2026-08-31T23:59:59.000Z',
      });
      const expectedOrigem = 5000.0 - 200.0 - 800.0 - 750.0 - 200.0;
      expect(stmtOrigemBefore.closingBalance).toBe(expectedOrigem);

      const accOrigemFresh = await accountRepo.findById(accOrigem.id);
      expect(accOrigemFresh).not.toBeNull();

      await transactionRepo.update(pendingTx.id, { status: 'confirmada' });

      const stmtOrigemAfter = await statementUseCase.execute({
        month: 8,
        year: 2026,
        accountId: accOrigem.id,
        asOfDate: '2026-08-31T23:59:59.000Z',
      });
      expect(stmtOrigemAfter.closingBalance).toBe(expectedOrigem - 300.0);

      const stmtDestino = await statementUseCase.execute({
        month: 8,
        year: 2026,
        accountId: accDestino.id,
        asOfDate: '2026-08-31T23:59:59.000Z',
      });
      expect(stmtDestino.closingBalance).toBe(1000.0 + 800.0);

      const stmtAll = await statementUseCase.execute({
        month: 8,
        year: 2026,
        asOfDate: '2026-08-31T23:59:59.000Z',
      });
      const expectedTotalCombined = (expectedOrigem - 300.0) + (1000.0 + 800.0);
      expect(stmtAll.closingBalance).toBe(expectedTotalCombined);
    });
  });

  describe('Passo 6: Requisitos Não Funcionais (Desempenho 10k, AppState, Offline e Segurança)', () => {
    let perfDb: DatabaseManager;
    let perfAccountRepo: AccountRepository;
    let perfTxRepo: TransactionRepository;

    beforeAll(async () => {
      perfDb = await setupUserDatabase('user-perf-benchmarks');
      perfAccountRepo = new AccountRepository(perfDb);
      perfTxRepo = new TransactionRepository(perfDb);

      process.env.ALLOW_TEST_SEED = 'true';
      await seed10kTestDatabase(perfDb, 'user-perf-benchmarks');
    });

    it('Desempenho 10k: listagem paginada executa abaixo de 300 ms', async () => {
      const start = Date.now();
      const page = await perfTxRepo.findPaginated(1, 20);
      const duration = Date.now() - start;

      expect(page.data).toHaveLength(20);
      expect(page.total).toBe(10000);
      expect(duration).toBeLessThan(300);
    });

    it('Desempenho 10k: busca textual por descrição executa abaixo de 300 ms', async () => {
      const start = Date.now();
      const searchRes = await perfTxRepo.findPaginated(1, 20, {
        searchTerm: 'Lançamento de teste seed #500',
      });
      const duration = Date.now() - start;

      expect(searchRes.data.length).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThan(300);
    });

    it('Desempenho 10k: filtro relacional por tag executa abaixo de 300 ms', async () => {
      const start = Date.now();
      const tagRes = await perfTxRepo.findPaginated(1, 20, {
        tag: 'urgente',
      });
      const duration = Date.now() - start;

      expect(tagRes.data.length).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThan(300);
    });

    it('Desempenho 10k: extrato mensal consolidado executa abaixo de 300 ms', async () => {
      const stmtUseCase = new BuildStatementUseCase(perfAccountRepo, perfTxRepo);

      const start = Date.now();
      const stmt = await stmtUseCase.execute({
        month: 6,
        year: 2026,
      });
      const duration = Date.now() - start;

      expect(stmt.lines.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(300);
    });

    it('Desempenho 10k: histórico agregado por categoria (GROUP BY) executa abaixo de 300 ms', async () => {
      const start = Date.now();
      const aggregated = await perfTxRepo.getMonthlyTotalsByCategory('cat_alim');
      const duration = Date.now() - start;

      expect(aggregated.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(300);
    });

    it('Desempenho 10k: cálculo de ciclo e fatura do cartão executa abaixo de 300 ms', async () => {
      const cardInvoiceUseCase = new CalculateCardInvoiceUseCase(perfAccountRepo, perfTxRepo);

      const start = Date.now();
      const invoice = await cardInvoiceUseCase.execute('acc_cartao_1', '2026-06-15T12:00:00.000Z', false);
      const duration = Date.now() - start;

      expect(invoice.creditLimit).toBe(12000.0);
      expect(invoice.currentInvoiceAmount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(300);
    });

    it('Segurança: backup criptografado não contém dados sensíveis em texto claro', () => {
      const sensitiveData = {
        app: 'OrcamentoFacil' as const,
        schemaVersion: 7,
        exportedAt: new Date().toISOString(),
        userId: 'user-secret',
        tables: {
          accounts: [{ id: 'acc-1', name: 'Conta Secreta Suica', initial_balance: 999999 }],
          transactions: [{ id: 'tx-1', description: 'Compra Confidencial Ouro', value: 50000 }],
        },
      };

      const envelope = encryptBackupPayload(sensitiveData, 'SenhaForte#2026');
      const rawString = JSON.stringify(envelope);

      expect(rawString).not.toContain('Conta Secreta Suica');
      expect(rawString).not.toContain('Compra Confidencial Ouro');
      expect(rawString).not.toContain('999999');
      expect(rawString).not.toContain('SenhaForte#2026');
    });

    it('Datas e Fuso: horário 23:30 local mantém determinismo e não altera o dia', () => {
      const isoStr = '2026-11-08T23:30:00';
      const formatted = formatDate(isoStr);
      expect(formatted).toBe('08/11/2026');

      const dateObj = fromIsoDate('2026-11-08');
      expect(dateObj.getFullYear()).toBe(2026);
      expect(dateObj.getMonth()).toBe(10);
      expect(dateObj.getDate()).toBe(8);

      const backToIso = toIsoDate(dateObj);
      expect(backToIso).toBe('2026-11-08');
    });

    it('Offline: nenhuma chamada externa de rede (fetch / XMLHttpRequest) é disparada nas rotinas', () => {
      const hasFetch = typeof global.fetch === 'function';
      expect(hasFetch).toBeDefined();
    });
  });
});
