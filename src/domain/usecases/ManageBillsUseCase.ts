import { generateUUID } from '../../utils/uuid';
import {
  RecurringBill,
  BillPayment,
  BillWithStatus,
  BillUrgencyStatus,
} from '../entities/RecurringBill';
import { Transaction } from '../entities/Transaction';
import { BillRepository } from '../../data/repositories/BillRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { CategoryRepository } from '../../data/repositories/CategoryRepository';
import { AccountRepository } from '../../data/repositories/AccountRepository';
import { NotificationService } from '../../services/NotificationService';

export function calculateBillStatusAndNextDue(
  bill: RecurringBill,
  referenceDate: Date = new Date(),
  payment?: BillPayment | null,
  targetMonth?: number,
  targetYear?: number
): BillWithStatus {
  const evalYear = targetYear ?? referenceDate.getFullYear();
  const evalMonth = targetMonth ?? (referenceDate.getMonth() + 1);

  const refStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  );

  const maxDayCurrent = new Date(evalYear, evalMonth, 0).getDate();
  const effectiveDueDayCurrent = Math.min(Math.max(1, bill.due_day), maxDayCurrent);
  const dueCurrentMonth = new Date(evalYear, evalMonth - 1, effectiveDueDayCurrent, 0, 0, 0, 0);

  if (payment) {
    const nextMonth = evalMonth === 12 ? 1 : evalMonth + 1;
    const nextYear = evalMonth === 12 ? evalYear + 1 : evalYear;
    const maxDayNext = new Date(nextYear, nextMonth, 0).getDate();
    const effectiveDueDayNext = Math.min(Math.max(1, bill.due_day), maxDayNext);
    const dueNextMonth = new Date(nextYear, nextMonth - 1, effectiveDueDayNext, 0, 0, 0, 0);
    const daysUntilNext = Math.round(
      (dueNextMonth.getTime() - refStart.getTime()) / (24 * 60 * 60 * 1000)
    );

    return {
      ...bill,
      status: 'paga',
      nextDueDateIso: dueNextMonth.toISOString(),
      daysUntilDue: daysUntilNext,
      isPaidInCurrentMonth: true,
      payment,
    };
  }

  const daysUntilDue = Math.round(
    (dueCurrentMonth.getTime() - refStart.getTime()) / (24 * 60 * 60 * 1000)
  );

  const urgentWindow = Math.max(3, bill.reminder_days_before);
  let status: BillUrgencyStatus = 'em_dia';
  if (daysUntilDue < 0) {
    status = 'vencida';
  } else if (daysUntilDue <= urgentWindow) {
    status = 'vence_em_breve';
  }

  return {
    ...bill,
    status,
    nextDueDateIso: dueCurrentMonth.toISOString(),
    daysUntilDue,
    isPaidInCurrentMonth: false,
  };
}

export function sortBillsByNearestDue(bills: BillWithStatus[]): BillWithStatus[] {
  return [...bills].sort((a, b) => {
    if (a.isPaidInCurrentMonth !== b.isPaidInCurrentMonth) {
      return a.isPaidInCurrentMonth ? 1 : -1;
    }
    if (a.daysUntilDue !== b.daysUntilDue) {
      return a.daysUntilDue - b.daysUntilDue;
    }
    if (a.due_day !== b.due_day) {
      return a.due_day - b.due_day;
    }
    return a.name.localeCompare(b.name);
  });
}

export interface CreateBillInput {
  name: string;
  value: number;
  due_day: number;
  reminder_days_before: number;
  category_id: string;
  account_id?: string;
  notes?: string;
  created_at?: string;
}

export class ManageBillsUseCase {
  private billRepo: BillRepository;
  private txRepo: TransactionRepository;
  private categoryRepo: CategoryRepository;
  private accountRepo: AccountRepository;
  private notificationService: NotificationService;

  constructor(
    billRepo?: BillRepository,
    txRepo?: TransactionRepository,
    categoryRepo?: CategoryRepository,
    accountRepo?: AccountRepository,
    notificationService?: NotificationService
  ) {
    this.billRepo = billRepo ?? new BillRepository();
    this.txRepo = txRepo ?? new TransactionRepository();
    this.categoryRepo = categoryRepo ?? new CategoryRepository();
    this.accountRepo = accountRepo ?? new AccountRepository();
    this.notificationService = notificationService ?? new NotificationService();
  }

  public async createBill(
    input: CreateBillInput,
    referenceDate: Date = new Date()
  ): Promise<RecurringBill> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('O nome da conta fixa é obrigatório.');
    }
    if (input.value <= 0 || Number.isNaN(input.value)) {
      throw new Error('O valor da conta fixa deve ser maior que zero.');
    }
    if (input.due_day < 1 || input.due_day > 31) {
      throw new Error('O dia de vencimento deve estar entre 1 e 31.');
    }
    if (input.reminder_days_before < 0 || input.reminder_days_before > 30) {
      throw new Error('A antecedência do lembrete deve estar entre 0 e 30 dias.');
    }

    const bill: RecurringBill = {
      id: generateUUID(),
      name: trimmedName,
      value: Number(input.value.toFixed(2)),
      due_day: Math.round(input.due_day),
      reminder_days_before: Math.round(input.reminder_days_before),
      category_id: input.category_id,
      account_id: input.account_id,
      notes: input.notes?.trim() || undefined,
      is_active: true,
      created_at: input.created_at ?? (referenceDate ?? new Date()).toISOString(),
    };

    await this.billRepo.create(bill);

    const month = referenceDate.getMonth() + 1;
    const year = referenceDate.getFullYear();

    await this.notificationService.scheduleMonthlyBillReminder({
      billId: bill.id,
      billName: bill.name,
      value: bill.value,
      dueDay: bill.due_day,
      reminderDaysBefore: bill.reminder_days_before,
      month,
      year,
    });

    const computed = calculateBillStatusAndNextDue(bill, referenceDate, null);
    await this.notificationService.checkAndNotifyBillDueReminder({
      billId: bill.id,
      billName: bill.name,
      value: bill.value,
      dueDay: bill.due_day,
      reminderDaysBefore: bill.reminder_days_before,
      month,
      year,
      daysUntilDue: computed.daysUntilDue,
      isPaid: false,
    });

    return bill;
  }

  public async updateBill(
    bill: RecurringBill,
    referenceDate: Date = new Date()
  ): Promise<void> {
    if (!bill.name.trim()) {
      throw new Error('O nome da conta fixa é obrigatório.');
    }
    if (bill.value <= 0) {
      throw new Error('O valor da conta fixa deve ser maior que zero.');
    }
    if (bill.due_day < 1 || bill.due_day > 31) {
      throw new Error('O dia de vencimento deve estar entre 1 e 31.');
    }

    await this.billRepo.update(bill);

    const month = referenceDate.getMonth() + 1;
    const year = referenceDate.getFullYear();
    const payment = await this.billRepo.findPayment(bill.id, month, year);

    if (!payment && bill.is_active) {
      await this.notificationService.scheduleMonthlyBillReminder({
        billId: bill.id,
        billName: bill.name,
        value: bill.value,
        dueDay: bill.due_day,
        reminderDaysBefore: bill.reminder_days_before,
        month,
        year,
      });
    } else {
      await this.notificationService.cancelBillReminderForMonth(bill.id, month, year);
    }
  }

  public async deleteBill(
    billId: string,
    referenceDate: Date = new Date()
  ): Promise<void> {
    const month = referenceDate.getMonth() + 1;
    const year = referenceDate.getFullYear();
    await this.notificationService.cancelBillReminderForMonth(billId, month, year);
    await this.billRepo.delete(billId);
  }

  public async listBillsForMonth(
    month: number,
    year: number,
    referenceDate?: Date
  ): Promise<BillWithStatus[]> {
    const today = referenceDate ?? new Date();

    const [bills, payments, categories, accounts] = await Promise.all([
      this.billRepo.findAllActive(),
      this.billRepo.findPaymentsByMonth(month, year),
      this.categoryRepo.findAll(),
      this.accountRepo.findAll(),
    ]);

    const paymentMap = new Map<string, BillPayment>();
    for (const p of payments) {
      paymentMap.set(p.bill_id, p);
    }

    const categoryMap = new Map<string, string>();
    for (const c of categories) {
      categoryMap.set(c.id, c.name);
    }

    const accountMap = new Map<string, string>();
    for (const a of accounts) {
      accountMap.set(a.id, a.name);
    }

    const enriched: BillWithStatus[] = [];

    for (const bill of bills) {
      const payment = paymentMap.get(bill.id) ?? null;

      if (!payment && bill.created_at) {
        const createdDate = new Date(bill.created_at);
        if (!Number.isNaN(createdDate.getTime())) {
          const createdYear = createdDate.getFullYear();
          const createdMonth = createdDate.getMonth() + 1;
          if (year < createdYear || (year === createdYear && month < createdMonth)) {
            continue;
          }
        }
      }

      const statusItem = calculateBillStatusAndNextDue(bill, today, payment, month, year);
      statusItem.categoryName = categoryMap.get(bill.category_id) ?? 'Geral';
      if (bill.account_id) {
        statusItem.accountName = accountMap.get(bill.account_id);
      }

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth);

      if (!payment && !isPastMonth) {
        await this.notificationService.scheduleMonthlyBillReminder({
          billId: bill.id,
          billName: bill.name,
          value: bill.value,
          dueDay: bill.due_day,
          reminderDaysBefore: bill.reminder_days_before,
          month,
          year,
        });

        await this.notificationService.checkAndNotifyBillDueReminder({
          billId: bill.id,
          billName: bill.name,
          value: bill.value,
          dueDay: bill.due_day,
          reminderDaysBefore: bill.reminder_days_before,
          month,
          year,
          daysUntilDue: statusItem.daysUntilDue,
          isPaid: false,
        });
      }

      enriched.push(statusItem);
    }

    return sortBillsByNearestDue(enriched);
  }

  public async markAsPaid(params: {
    billId: string;
    month: number;
    year: number;
    createExpenseTransaction?: boolean;
    accountId?: string;
    paidAtIso?: string;
  }): Promise<{ payment: BillPayment; createdTransaction?: Transaction }> {
    const bill = await this.billRepo.findById(params.billId);
    if (!bill) {
      throw new Error('Conta fixa não encontrada.');
    }

    const paidAt = params.paidAtIso ?? new Date().toISOString();
    let createdTx: Transaction | undefined;

    if (params.createExpenseTransaction) {
      let targetAccountId = params.accountId ?? bill.account_id;
      if (!targetAccountId) {
        const accounts = await this.accountRepo.findAll();
        if (accounts.length === 0) {
          throw new Error('Cadastre ao menos uma conta bancária para lançar a despesa.');
        }
        targetAccountId = accounts[0].id;
      }

      createdTx = await this.txRepo.create({
        account_id: targetAccountId,
        category_id: bill.category_id,
        value: bill.value,
        type: 'despesa',
        description: bill.name,
        date: paidAt,
        is_recurring: true,
        recurrence_day: bill.due_day,
        tags: ['conta-fixa'],
        notes: bill.notes,
        status: 'confirmada',
      });
    }

    const payment: BillPayment = {
      id: generateUUID(),
      bill_id: bill.id,
      month: params.month,
      year: params.year,
      paid_at: paidAt,
      transaction_id: createdTx?.id,
    };

    await this.billRepo.markBillPaid(payment);
    await this.notificationService.cancelBillReminderForMonth(
      bill.id,
      params.month,
      params.year
    );

    const nextMonth = params.month === 12 ? 1 : params.month + 1;
    const nextYear = params.month === 12 ? params.year + 1 : params.year;
    await this.notificationService.scheduleMonthlyBillReminder({
      billId: bill.id,
      billName: bill.name,
      value: bill.value,
      dueDay: bill.due_day,
      reminderDaysBefore: bill.reminder_days_before,
      month: nextMonth,
      year: nextYear,
    });

    return { payment, createdTransaction: createdTx };
  }

  public async unmarkAsPaid(
    billId: string,
    month: number,
    year: number
  ): Promise<void> {
    await this.billRepo.unmarkBillPaid(billId, month, year);
    const bill = await this.billRepo.findById(billId);
    if (bill && bill.is_active) {
      await this.notificationService.scheduleMonthlyBillReminder({
        billId: bill.id,
        billName: bill.name,
        value: bill.value,
        dueDay: bill.due_day,
        reminderDaysBefore: bill.reminder_days_before,
        month,
        year,
      });
    }
  }
}
