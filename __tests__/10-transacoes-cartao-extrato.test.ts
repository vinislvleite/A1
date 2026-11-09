import { DatabaseManager } from '../src/data/database/SQLiteDatabase';
import { setupUserDatabase, isoDate } from './helpers/db';
import { AccountRepository } from '../src/data/repositories/AccountRepository';
import { TransactionRepository } from '../src/data/repositories/TransactionRepository';
import { CategoryRepository } from '../src/data/repositories/CategoryRepository';
import {
  GenerateRecurringTransactionsUseCase,
  buildRecurringDateIso,
  clampDayToMonth,
  listElapsedYearMonths,
} from '../src/domain/usecases/GenerateRecurringTransactionsUseCase';
import {
  CreateInstallmentsUseCase,
  calculateInstallmentSplits,
  addMonthsClampedIso,
} from '../src/domain/usecases/CreateInstallmentsUseCase';
import {
  CalculateCardInvoiceUseCase,
  calculateCardInvoiceCycle,
} from '../src/domain/usecases/CalculateCardInvoiceUseCase';
import {
  BuildStatementUseCase,
  buildStatementLines,
} from '../src/domain/usecases/BuildStatementUseCase';
import {
  CalculateRevolvingInterestUseCase,
  calculateRevolvingInterest,
} from '../src/domain/usecases/CalculateRevolvingInterestUseCase';
import { Account } from '../src/domain/entities/Account';
import { Category } from '../src/domain/entities/Category';

const USER_ID = 'user-sprint2-tx-card-stmt';

describe('Sprint 2: Transações, Cartão de Crédito e Extrato Bancário', () => {
  let db: DatabaseManager;
  let accountRepo: AccountRepository;
  let transactionRepo: TransactionRepository;
  let categoryRepo: CategoryRepository;
  let defaultCategory: Category;

  beforeAll(async () => {
    db = await setupUserDatabase(USER_ID);
    accountRepo = new AccountRepository(db);
    transactionRepo = new TransactionRepository(db);
    categoryRepo = new CategoryRepository(db);

    const categories = await categoryRepo.findAll();
    const alimentacao = categories.find((c) => c.name.toLowerCase().includes('alimentação'));
    defaultCategory = alimentacao ?? categories[0];
  });




  describe('US27: Transações Recorrentes Automáticas', () => {
    it('clampDayToMonth ajusta dias para meses mais curtos (ex: dia 31 em fevereiro)', () => {
      expect(clampDayToMonth(2026, 2, 31)).toBe(28);
      expect(clampDayToMonth(2024, 2, 31)).toBe(29);
      expect(clampDayToMonth(2026, 4, 31)).toBe(30);
      expect(clampDayToMonth(2026, 5, 31)).toBe(31);
    });

    it('listElapsedYearMonths calcula corretamente os meses decorridos até a data de referência', () => {
      const slots = listElapsedYearMonths('2026-01-15T12:00:00.000Z', '2026-03-20T12:00:00.000Z');
      expect(slots.map((s) => s.yearMonth)).toEqual(['2026-02', '2026-03']);
    });

    it('projeta e duplica transações recorrentes no mês seguinte com vínculo ao template pai', async () => {
      const account = await accountRepo.create({
        name: 'Conta Corrente US27',
        type: 'corrente',
        initial_balance: 2000,
        color: '#2563EB',
        icon: 'briefcase',
      });


      const template = await transactionRepo.create({
        account_id: account.id,
        category_id: defaultCategory.id,
        value: 120.5,
        type: 'despesa',
        description: 'Assinatura Streaming Recorrente',
        date: isoDate(2026, 1, 15),
        is_recurring: true,
        recurrence_day: 15,
      });

      expect(template.is_recurring).toBe(true);
      expect(template.recurrence_parent_id).toBeUndefined();

      const useCase = new GenerateRecurringTransactionsUseCase(transactionRepo);


      const febResult = await useCase.execute(isoDate(2026, 2, 20));
      expect(febResult.generatedCount).toBe(1);

      const generatedFeb = febResult.generatedTransactions[0];
      expect(generatedFeb.recurrence_parent_id).toBe(template.id);
      expect(generatedFeb.value).toBe(120.5);
      expect(generatedFeb.description).toBe('Assinatura Streaming Recorrente');
      expect(generatedFeb.date.substring(0, 10)).toBe('2026-02-15');
      expect(generatedFeb.account_id).toBe(account.id);
      expect(generatedFeb.category_id).toBe(defaultCategory.id);


      const rerun = await useCase.execute(isoDate(2026, 2, 20));
      expect(rerun.generatedCount).toBe(0);


      const marResult = await useCase.execute(isoDate(2026, 3, 20));
      expect(marResult.generatedCount).toBe(1);
      expect(marResult.generatedTransactions[0].date.substring(0, 10)).toBe('2026-03-15');
      expect(marResult.generatedTransactions[0].recurrence_parent_id).toBe(template.id);
    });

    it('catch-up após vários meses sem abrir o app gera todas as parcelas retroativas pendentes', async () => {
      const account = await accountRepo.create({
        name: 'Conta Catchup US27',
        type: 'corrente',
        initial_balance: 1000,
        color: '#2563EB',
        icon: 'briefcase',
      });

      const template = await transactionRepo.create({
        account_id: account.id,
        category_id: defaultCategory.id,
        value: 50.0,
        type: 'despesa',
        description: 'Serviço Recorrente Mensal',
        date: isoDate(2026, 1, 10),
        is_recurring: true,
        recurrence_day: 10,
      });

      const useCase = new GenerateRecurringTransactionsUseCase(transactionRepo);
      const catchupRes = await useCase.execute(isoDate(2026, 5, 20));
      const forThisTemplate = catchupRes.generatedTransactions.filter(
        (t) => t.recurrence_parent_id === template.id
      );
      expect(forThisTemplate).toHaveLength(4);
      const dates = forThisTemplate.map((t) => t.date.substring(0, 7));
      expect(dates).toEqual(['2026-02', '2026-03', '2026-04', '2026-05']);
    });

    it('desativar recorrência no template preserva histórico e cessa novas gerações', async () => {
      const account = await accountRepo.create({
        name: 'Conta Stop US27',
        type: 'corrente',
        initial_balance: 1000,
        color: '#2563EB',
        icon: 'briefcase',
      });

      const template = await transactionRepo.create({
        account_id: account.id,
        category_id: defaultCategory.id,
        value: 75.0,
        type: 'despesa',
        description: 'Assinatura Cancelada',
        date: isoDate(2026, 1, 5),
        is_recurring: true,
        recurrence_day: 5,
      });

      const useCase = new GenerateRecurringTransactionsUseCase(transactionRepo);
      await useCase.execute(isoDate(2026, 2, 10));

      await transactionRepo.update(template.id, { is_recurring: false });

      const resAfterCancel = await useCase.execute(isoDate(2026, 6, 10));
      const generatedForThis = resAfterCancel.generatedTransactions.filter(
        (t) => t.recurrence_parent_id === template.id
      );
      expect(generatedForThis).toHaveLength(0);

      const pastTxs = await transactionRepo.findAll({ accountId: account.id });
      expect(pastTxs.some((t) => t.id === template.id)).toBe(true);
      expect(pastTxs.some((t) => t.recurrence_parent_id === template.id)).toBe(true);
    });
  });




  describe('US28: Parcelamento Inteligente de Despesas', () => {
    it('calculateInstallmentSplits divide o valor total e atribui resto de centavos na última parcela', () => {

      const splits3 = calculateInstallmentSplits(100.0, 3, '2026-01-10T12:00:00.000Z');
      expect(splits3).toHaveLength(3);
      expect(splits3[0].value).toBe(33.33);
      expect(splits3[1].value).toBe(33.33);
      expect(splits3[2].value).toBe(33.34);
      expect(splits3.reduce((acc, s) => acc + s.value, 0)).toBeCloseTo(100.0, 2);


      const splits7 = calculateInstallmentSplits(250.0, 7, '2026-01-15T12:00:00.000Z');
      expect(splits7).toHaveLength(7);
      const sum7 = splits7.reduce((acc, s) => acc + s.value, 0);
      expect(sum7).toBeCloseTo(250.0, 2);
    });

    it('addMonthsClampedIso avança meses respeitando o último dia de meses com menos dias', () => {

      expect(addMonthsClampedIso('2026-01-31T12:00:00.000Z', 1).substring(0, 10)).toBe('2026-02-28');
      expect(addMonthsClampedIso('2026-01-31T12:00:00.000Z', 2).substring(0, 10)).toBe('2026-03-31');
      expect(addMonthsClampedIso('2026-01-31T12:00:00.000Z', 3).substring(0, 10)).toBe('2026-04-30');
    });

    it('rejeita parcelamento com menos de 2 ou mais de 48 parcelas', () => {
      expect(() => calculateInstallmentSplits(100, 1, '2026-01-01T12:00:00.000Z')).toThrow(
        'O número de parcelas deve ser um inteiro entre 2 e 48.'
      );
      expect(() => calculateInstallmentSplits(100, 50, '2026-01-01T12:00:00.000Z')).toThrow(
        'O número de parcelas deve ser um inteiro entre 2 e 48.'
      );
    });

    it('persiste parcelas com mesmo installment_group_id, numeração (1/N..N/N) e datas corretas', async () => {
      const account = await accountRepo.create({
        name: 'Cartão US28',
        type: 'cartao_credito',
        initial_balance: 0,
        credit_limit: 3000,
        closing_day: 5,
        due_day: 12,
        color: '#8B5CF6',
        icon: 'credit-card',
      });

      const useCase = new CreateInstallmentsUseCase(transactionRepo);
      const res = await useCase.execute({
        account_id: account.id,
        category_id: defaultCategory.id,
        totalValue: 300.0,
        installmentCount: 3,
        description: 'Notebook Usado',
        startDate: '2026-01-31T12:00:00.000Z',
      });

      expect(res.groupId).toBeDefined();
      expect(res.installments).toHaveLength(3);

      const dbTxs = (await transactionRepo.findAll({ installmentGroupId: res.groupId })).sort(
        (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0)
      );
      expect(dbTxs).toHaveLength(3);

      expect(dbTxs[0].installment_number).toBe(1);
      expect(dbTxs[0].installment_total).toBe(3);
      expect(dbTxs[0].description).toBe('Notebook Usado (1/3)');
      expect(dbTxs[0].value).toBe(100.0);
      expect(dbTxs[0].date.substring(0, 10)).toBe('2026-01-31');

      expect(dbTxs[1].installment_number).toBe(2);
      expect(dbTxs[1].description).toBe('Notebook Usado (2/3)');
      expect(dbTxs[1].value).toBe(100.0);
      expect(dbTxs[1].date.substring(0, 10)).toBe('2026-02-28');

      expect(dbTxs[2].installment_number).toBe(3);
      expect(dbTxs[2].description).toBe('Notebook Usado (3/3)');
      expect(dbTxs[2].value).toBe(100.0);
      expect(dbTxs[2].date.substring(0, 10)).toBe('2026-03-31');
    });

    it('filtra parcelas futuras ao buscar transações recentes com maxEffectiveDate', async () => {
      const account = await accountRepo.create({
        name: 'Cartão US28 Recent',
        type: 'cartao_credito',
        initial_balance: 0,
        credit_limit: 3000,
        closing_day: 5,
        due_day: 12,
        color: '#8B5CF6',
        icon: 'credit-card',
      });

      const useCase = new CreateInstallmentsUseCase(transactionRepo);
      await useCase.execute({
        account_id: account.id,
        category_id: defaultCategory.id,
        totalValue: 300.0,
        installmentCount: 3,
        description: 'Tênis Esportivo',
        startDate: '2026-11-08T12:00:00.000Z',
      });

      const recentTxs = await transactionRepo.findPaginated(1, 10, {
        maxEffectiveDate: '2026-11-08',
      });

      const tenisTxs = recentTxs.data.filter((t) => t.description.includes('Tênis Esportivo'));
      expect(tenisTxs).toHaveLength(1);
      expect(tenisTxs[0].description).toBe('Tênis Esportivo (1/3)');
    });

    it('calculateInstallmentSplits divide R$ 0,01 em 3 parcelas (0,00, 0,00 e 0,01)', () => {
      const splits = calculateInstallmentSplits(0.01, 3, '2026-01-10T12:00:00.000Z');
      expect(splits).toHaveLength(3);
      expect(splits[0].value).toBe(0.00);
      expect(splits[1].value).toBe(0.00);
      expect(splits[2].value).toBe(0.01);
      expect(splits.reduce((acc, s) => acc + s.value, 0)).toBe(0.01);
    });

    it('virada de ano em parcelamento incrementa corretamente o ano', () => {
      const splits = calculateInstallmentSplits(300.0, 3, '2026-11-15T12:00:00.000Z');
      expect(splits[0].date.substring(0, 10)).toBe('2026-11-15');
      expect(splits[1].date.substring(0, 10)).toBe('2026-12-15');
      expect(splits[2].date.substring(0, 10)).toBe('2027-01-15');
    });

    it('exclui apenas esta parcela ou esta e as futuras no grupo', async () => {
      const account = await accountRepo.create({
        name: 'Conta Grupo US28',
        type: 'corrente',
        initial_balance: 5000,
        color: '#2563EB',
        icon: 'briefcase',
      });

      const useCase = new CreateInstallmentsUseCase(transactionRepo);
      const res = await useCase.execute({
        account_id: account.id,
        category_id: defaultCategory.id,
        totalValue: 400.0,
        installmentCount: 4,
        description: 'Sofá Parcelado',
        startDate: '2026-01-10T12:00:00.000Z',
      });

      const allInstallments = await transactionRepo.findAll({ installmentGroupId: res.groupId });
      expect(allInstallments).toHaveLength(4);

      const thirdInstallment = allInstallments.find((t) => t.installment_number === 3);
      expect(thirdInstallment).toBeDefined();

      await transactionRepo.deleteInstallmentGroup(thirdInstallment!.id, 'future');
      const remaining = await transactionRepo.findAll({ installmentGroupId: res.groupId });
      expect(remaining).toHaveLength(2);
      expect(remaining.map((t) => t.installment_number).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2]);
    });
  });




  describe('US29: Gestão Integral de Fatura de Cartão de Crédito', () => {
    it('calcula o ciclo de fatura, limite disponível e total gasto com base na data de fechamento e vencimento', async () => {
      const card = await accountRepo.create({
        name: 'Nubank US29',
        type: 'cartao_credito',
        initial_balance: 0,
        credit_limit: 5000.0,
        closing_day: 10,
        due_day: 17,
        color: '#820AD1',
        icon: 'credit-card',
      });


      await transactionRepo.create({
        account_id: card.id,
        category_id: defaultCategory.id,
        value: 450.0,
        type: 'despesa',
        description: 'Supermercado Ciclo 1',
        date: '2026-04-20T12:00:00.000Z',
        is_recurring: false,
      });

      await transactionRepo.create({
        account_id: card.id,
        category_id: defaultCategory.id,
        value: 150.0,
        type: 'despesa',
        description: 'Farmácia Ciclo 1',
        date: '2026-05-02T12:00:00.000Z',
        is_recurring: false,
      });


      await transactionRepo.create({
        account_id: card.id,
        category_id: defaultCategory.id,
        value: 200.0,
        type: 'despesa',
        description: 'Jantar Ciclo 2',
        date: '2026-05-12T12:00:00.000Z',
        is_recurring: false,
      });

      const useCase = new CalculateCardInvoiceUseCase(accountRepo, transactionRepo);


      const resultMay5 = await useCase.execute(card.id, '2026-05-05T12:00:00.000Z', false);

      expect(resultMay5.creditLimit).toBe(5000.0);
      expect(resultMay5.cycleEndDate).toBe('2026-05-10');
      expect(resultMay5.dueDate).toBe('2026-05-17');

      expect(resultMay5.currentInvoiceAmount).toBe(600.0);

      expect(resultMay5.usedLimit).toBe(800.0);
      expect(resultMay5.availableLimit).toBe(4200.0);
      expect(resultMay5.daysUntilDue).toBe(12);


      const resultMay15 = await useCase.execute(card.id, '2026-05-15T12:00:00.000Z', false);
      expect(resultMay15.cycleEndDate).toBe('2026-06-10');
      expect(resultMay15.dueDate).toBe('2026-06-17');
      expect(resultMay15.currentInvoiceAmount).toBe(200.0);
    });

    it('identifica fatura vencendo em breve quando faltam 3 dias ou menos', () => {
      const cycle = calculateCardInvoiceCycle({
        creditLimit: 2000,
        closingDay: 25,
        dueDay: 5,
        transactions: [
          {
            id: 'tx-1',
            account_id: 'c1',
            category_id: 'cat-1',
            value: 300,
            type: 'despesa',
            description: 'Compra no ciclo anterior',
            date: '2026-04-10T12:00:00.000Z',
            tags: [],
            status: 'confirmada',
            is_recurring: false,
            created_at: '',
            updated_at: '',
          },
        ],
        referenceDateIso: '2026-05-03T12:00:00.000Z',
      });

      expect(cycle.closedInvoice).not.toBeNull();
      expect(cycle.closedInvoice?.dueDate).toBe('2026-05-05');
      expect(cycle.closedInvoice?.amount).toBe(300);
      expect(cycle.closedInvoice?.daysUntilDue).toBe(2);
      expect(cycle.daysUntilDue).toBe(2);
      expect(cycle.isDueSoon).toBe(true);
    });
  });





  describe('US30 & US31: Extrato filtrado e Extrato consolidado com saldo acumulado', () => {
    let accountA: Account;
    let accountB: Account;

    beforeAll(async () => {
      accountA = await accountRepo.create({
        name: 'Inter Saldo US31',
        type: 'corrente',
        initial_balance: 1000.0,
        color: '#F97316',
        icon: 'briefcase',
      });

      accountB = await accountRepo.create({
        name: 'Poupança Caixa US31',
        type: 'poupanca',
        initial_balance: 500.0,
        color: '#0284C7',
        icon: 'archive',
      });



      await transactionRepo.create({
        account_id: accountA.id,
        category_id: defaultCategory.id,
        value: 400.0,
        type: 'receita',
        description: 'Pix Recebido Cliente',
        date: '2026-03-01T10:00:00.000Z',
        is_recurring: false,
      });


      await transactionRepo.create({
        account_id: accountA.id,
        category_id: defaultCategory.id,
        value: 150.0,
        type: 'despesa',
        description: 'Supermercado Inter',
        date: '2026-03-05T12:00:00.000Z',
        is_recurring: false,
      });


      await transactionRepo.create({
        account_id: accountB.id,
        category_id: defaultCategory.id,
        value: 100.0,
        type: 'receita',
        description: 'Aporte Poupança',
        date: '2026-03-10T14:00:00.000Z',
        is_recurring: false,
      });


      await transactionRepo.create({
        account_id: accountA.id,
        category_id: defaultCategory.id,
        value: 50.0,
        type: 'despesa',
        description: 'Lanche Pendente',
        date: '2026-03-15T15:00:00.000Z',
        is_recurring: false,
        status: 'pendente',
      });
    });

    it('US30: filtra extrato por conta específica isolando saldo inicial e final', async () => {
      const useCase = new BuildStatementUseCase(accountRepo, transactionRepo);
      const stmtA = await useCase.execute({
        month: 3,
        year: 2026,
        accountId: accountA.id,
        asOfDate: '2026-03-31T23:59:59.000Z',
      });

      expect(stmtA.accountId).toBe(accountA.id);
      expect(stmtA.accountName).toBe('Inter Saldo US31');
      expect(stmtA.openingBalance).toBe(1000.0);
      expect(stmtA.totalIncome).toBe(400.0);
      expect(stmtA.totalExpense).toBe(150.0);
      expect(stmtA.closingBalance).toBe(1250.0);
      expect(stmtA.lines).toHaveLength(2);
      expect(stmtA.lines[0].transaction.description).toBe('Pix Recebido Cliente');
      expect(stmtA.lines[1].transaction.description).toBe('Supermercado Inter');
    });

    it('US31: gera extrato consolidado combinando contas com saldo acumulado linha a linha', async () => {
      const useCase = new BuildStatementUseCase(accountRepo, transactionRepo);
      const stmtConsolidated = await useCase.execute({
        month: 3,
        year: 2026,
        asOfDate: '2026-03-31T23:59:59.000Z',
      });

      expect(stmtConsolidated.accountId).toBeUndefined();
      expect(stmtConsolidated.accountName).toBe('Todas as contas');
      const opening = stmtConsolidated.openingBalance;
      expect(opening).toBeGreaterThan(0);
      expect(stmtConsolidated.lines.length).toBeGreaterThanOrEqual(3);


      let runningExpected = opening;
      for (const line of stmtConsolidated.lines) {
        runningExpected = Number((runningExpected + line.signedValue).toFixed(2));
        expect(line.runningBalance).toBe(runningExpected);
      }

      expect(stmtConsolidated.closingBalance).toBe(runningExpected);
      expect(stmtConsolidated.closingBalance).toBe(
        Number((opening + stmtConsolidated.totalIncome - stmtConsolidated.totalExpense).toFixed(2))
      );
    });

    it('buildStatementLines garante cálculo aritmético sem arredondamento com float estranho', () => {
      const mockLines = buildStatementLines({
        openingBalance: 0.1,
        transactions: [
          {
            id: '1',
            account_id: 'a',
            category_id: 'c',
            value: 0.2,
            type: 'receita',
            description: 'Rec',
            date: '2026-01-01T10:00:00Z',
            tags: [],
            status: 'confirmada',
            is_recurring: false,
            created_at: '',
            updated_at: '',
          },
        ],
      });

      expect(mockLines.closingBalance).toBe(0.3);
      expect(mockLines.lines[0].runningBalance).toBe(0.3);
    });

    it('mês sem movimento retorna saldo inicial igual ao saldo final', async () => {
      const useCase = new BuildStatementUseCase(accountRepo, transactionRepo);
      const stmtEmpty = await useCase.execute({
        month: 12,
        year: 2029,
        accountId: accountA.id,
      });

      expect(stmtEmpty.lines).toHaveLength(0);
      expect(stmtEmpty.totalIncome).toBe(0);
      expect(stmtEmpty.totalExpense).toBe(0);
      expect(stmtEmpty.openingBalance).toBe(stmtEmpty.closingBalance);
    });

    it('transferência entre contas não altera o total geral em todas as contas e gera saída e entrada', async () => {
      const transferAmount = 250.0;
      await transactionRepo.transfer({
        sourceAccountId: accountA.id,
        destinationAccountId: accountB.id,
        value: transferAmount,
        date: '2026-03-20T10:00:00.000Z',
        description: 'Transferência A para B',
      });

      const useCase = new BuildStatementUseCase(accountRepo, transactionRepo);

      const stmtA = await useCase.execute({
        month: 3,
        year: 2026,
        accountId: accountA.id,
        asOfDate: '2026-03-31T23:59:59.000Z',
      });
      const hasOut = stmtA.lines.some((l) => l.transaction.type === 'despesa' && l.transaction.value === transferAmount);
      expect(hasOut).toBe(true);

      const stmtB = await useCase.execute({
        month: 3,
        year: 2026,
        accountId: accountB.id,
        asOfDate: '2026-03-31T23:59:59.000Z',
      });
      const hasIn = stmtB.lines.some((l) => l.transaction.type === 'receita' && l.transaction.value === transferAmount);
      expect(hasIn).toBe(true);

      const stmtAll = await useCase.execute({
        month: 3,
        year: 2026,
        asOfDate: '2026-03-31T23:59:59.000Z',
      });
      const inCount = stmtAll.lines.filter((l) => l.transaction.description?.includes('Transferência') && l.transaction.type === 'receita').length;
      const outCount = stmtAll.lines.filter((l) => l.transaction.description?.includes('Transferência') && l.transaction.type === 'despesa').length;
      expect(inCount).toBe(outCount);
    });
  });




  describe('US44: Renda Extra e Fontes de Receita Variável', () => {
    it('persiste is_extra_income e income_source permitindo segregação contábil', async () => {
      const account = await accountRepo.create({
        name: 'Conta Salário US44',
        type: 'corrente',
        initial_balance: 0,
        color: '#10B981',
        icon: 'briefcase',
      });


      const salary = await transactionRepo.create({
        account_id: account.id,
        category_id: defaultCategory.id,
        value: 5000.0,
        type: 'receita',
        description: 'Salário Mensal CLT',
        date: '2026-04-05T12:00:00.000Z',
        is_recurring: false,
        is_extra_income: false,
      });


      const freelance = await transactionRepo.create({
        account_id: account.id,
        category_id: defaultCategory.id,
        value: 1200.0,
        type: 'receita',
        description: 'Desenvolvimento Landing Page',
        date: '2026-04-18T12:00:00.000Z',
        is_recurring: false,
        is_extra_income: true,
        income_source: 'Freelance Tech',
      });

      expect(salary.is_extra_income).toBe(false);
      expect(salary.income_source).toBeUndefined();

      expect(freelance.is_extra_income).toBe(true);
      expect(freelance.income_source).toBe('Freelance Tech');


      const extraList = await transactionRepo.findAll({
        isExtraIncome: true,
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T23:59:59.000Z',
      });

      expect(extraList).toHaveLength(1);
      expect(extraList[0].id).toBe(freelance.id);
      expect(extraList[0].income_source).toBe('Freelance Tech');


      const totals = await transactionRepo.getTotalsByPeriod(
        '2026-04-01T00:00:00.000Z',
        '2026-04-30T23:59:59.000Z'
      );
      expect(totals.totalIncome).toBe(6200.0);
      expect(totals.fixedIncome).toBe(5000.0);
      expect(totals.extraIncome).toBe(1200.0);
    });
  });




  describe('US45: Cartão de Crédito Rotativo e Simulação de Juros', () => {
    it('calcula juros rotativos compostos, prestação (Price) e tabela de amortização completa', () => {
      const useCase = new CalculateRevolvingInterestUseCase();
      const res = useCase.execute({
        balance: 1000.0,
        monthlyRatePercent: 12.0,
        months: 6,
      });

      expect(res.balance).toBe(1000.0);
      expect(res.monthlyRatePercent).toBe(12.0);
      expect(res.months).toBe(6);
      expect(res.firstMonthInterest).toBe(120.0);


      expect(res.installmentAmount).toBeGreaterThan(240);
      expect(res.totalPaid).toBeGreaterThan(1400);
      expect(res.totalInterest).toBe(Number((res.totalPaid - 1000.0).toFixed(2)));


      expect(res.schedule).toHaveLength(6);
      expect(res.schedule[0].monthNumber).toBe(1);
      expect(res.schedule[0].interest).toBe(120.0);

      expect(res.schedule[5].remainingBalance).toBe(0.0);
    });

    it('rejeita valores de entrada inválidos com mensagens amigáveis', () => {
      expect(() =>
        calculateRevolvingInterest({
          balance: 0,
          monthlyRatePercent: 10,
          months: 6,
        })
      ).toThrow('O saldo devedor deve ser maior que zero.');

      expect(() =>
        calculateRevolvingInterest({
          balance: 1000,
          monthlyRatePercent: -2,
          months: 6,
        })
      ).toThrow('A taxa mensal não pode ser negativa.');

      expect(() =>
        calculateRevolvingInterest({
          balance: 1000,
          monthlyRatePercent: 5,
          months: 0,
        })
      ).toThrow('O número de meses deve estar entre 1 e 120.');
    });

    it('funciona com taxa 0% distribuindo linearmente sem juros', () => {
      const res = calculateRevolvingInterest({
        balance: 600.0,
        monthlyRatePercent: 0,
        months: 6,
      });
      expect(res.totalInterest).toBe(0);
      expect(res.installmentAmount).toBe(100.0);
      expect(res.totalPaid).toBe(600.0);
    });

    it('caso numérico exato: saldo R$ 1.000,00, taxa 10% ao mês, 3 meses', () => {
      const res = calculateRevolvingInterest({
        balance: 1000.0,
        monthlyRatePercent: 10.0,
        months: 3,
      });

      expect(res.installmentAmount).toBe(402.11);
      expect(res.totalPaid).toBe(1206.34);
      expect(res.totalInterest).toBe(206.34);
      expect(res.schedule).toHaveLength(3);
    });
  });
});
