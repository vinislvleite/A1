import { Account } from '../entities/Account';
import { Transaction } from '../entities/Transaction';
import { AccountRepository } from '../../data/repositories/AccountRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { NotificationService } from '../../services/NotificationService';
import { fromIsoDate, toIsoDate } from '../../utils/date';

export interface ClosedInvoiceInfo {
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  amount: number;
  daysUntilDue: number;
  isDueSoon: boolean;
}

export interface CardInvoiceCycleInfo {
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  daysUntilDue: number;
  isDueSoon: boolean;
  currentInvoiceAmount: number;
  creditLimit: number;
  usedLimit: number;
  availableLimit: number;
  cycleTransactions: Transaction[];
  recentTransactions: Transaction[];
  closedInvoice?: ClosedInvoiceInfo | null;
}

export interface CalculateCardInvoiceResult extends CardInvoiceCycleInfo {
  account: Account;
}

function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

function formatYmd(year: number, monthZeroIndexed: number, day: number): string {
  const maxDay = getDaysInMonth(year, monthZeroIndexed);
  const clampedDay = Math.min(Math.max(1, day), maxDay);
  const m = String(monthZeroIndexed + 1).padStart(2, '0');
  const d = String(clampedDay).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const parts = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDaysYmd(fromYmd: string, toYmd: string): number {
  const p1 = fromYmd.substring(0, 10).split('-').map(Number);
  const p2 = toYmd.substring(0, 10).split('-').map(Number);
  const utc1 = Date.UTC(p1[0], p1[1] - 1, p1[2]);
  const utc2 = Date.UTC(p2[0], p2[1] - 1, p2[2]);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

function calculateDueDate(
  closeYear: number,
  closeMonthZero: number,
  closingDay: number,
  dueDay: number
): string {
  let dueYear = closeYear;
  let dueMonthZero = closeMonthZero;
  if (dueDay <= closingDay) {
    dueMonthZero += 1;
    if (dueMonthZero > 11) {
      dueMonthZero = 0;
      dueYear += 1;
    }
  }
  return formatYmd(dueYear, dueMonthZero, dueDay);
}

export function calculateCardInvoiceCycle(params: {
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  transactions: Transaction[];
  referenceDateIso?: string;
}): CardInvoiceCycleInfo {
  const refDate = params.referenceDateIso ? fromIsoDate(params.referenceDateIso) : new Date();
  const refYmd = toIsoDate(refDate);
  const [refYear, refMonthOneBased, refDay] = refYmd.split('-').map(Number);
  const refMonthZero = refMonthOneBased - 1;

  const closingDay = Math.min(Math.max(1, Math.trunc(params.closingDay || 10)), 31);
  const dueDay = Math.min(Math.max(1, Math.trunc(params.dueDay || 17)), 31);
  const creditLimit = Math.max(0, Number(params.creditLimit || 0));

  let closeYear = refYear;
  let closeMonthZero = refMonthZero;

  if (refDay > closingDay) {
    closeMonthZero += 1;
    if (closeMonthZero > 11) {
      closeMonthZero = 0;
      closeYear += 1;
    }
  }

  const cycleEndDate = formatYmd(closeYear, closeMonthZero, closingDay);

  let prevCloseYear = closeYear;
  let prevCloseMonthZero = closeMonthZero - 1;
  if (prevCloseMonthZero < 0) {
    prevCloseMonthZero = 11;
    prevCloseYear -= 1;
  }
  const prevCloseEndDate = formatYmd(prevCloseYear, prevCloseMonthZero, closingDay);
  const cycleStartDate = addDaysYmd(prevCloseEndDate, 1);

  const dueDate = calculateDueDate(closeYear, closeMonthZero, closingDay, dueDay);

  let prevPrevCloseYear = prevCloseYear;
  let prevPrevCloseMonthZero = prevCloseMonthZero - 1;
  if (prevPrevCloseMonthZero < 0) {
    prevPrevCloseMonthZero = 11;
    prevPrevCloseYear -= 1;
  }
  const prevPrevCloseEndDate = formatYmd(prevPrevCloseYear, prevPrevCloseMonthZero, closingDay);
  const prevCycleStartDate = addDaysYmd(prevPrevCloseEndDate, 1);
  const prevDueDate = calculateDueDate(prevCloseYear, prevCloseMonthZero, closingDay, dueDay);

  const confirmedTxs = params.transactions.filter(
    (tx) => (tx.status ?? 'confirmada') === 'confirmada'
  );

  const cycleTransactions = confirmedTxs
    .filter((tx) => {
      const txDay = tx.date.substring(0, 10);
      return txDay >= cycleStartDate && txDay <= cycleEndDate;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  let cycleExpense = 0;
  let cycleIncome = 0;
  for (const tx of cycleTransactions) {
    if (tx.type === 'despesa') {
      cycleExpense += tx.value;
    } else {
      cycleIncome += tx.value;
    }
  }

  const currentInvoiceAmount = Number(Math.max(0, cycleExpense - cycleIncome).toFixed(2));

  let closedInvoice: ClosedInvoiceInfo | null = null;
  const isBetweenClosingAndDue = refYmd > prevCloseEndDate && refYmd <= prevDueDate;
  if (isBetweenClosingAndDue) {
    const closedTxs = confirmedTxs.filter((tx) => {
      const txDay = tx.date.substring(0, 10);
      return txDay >= prevCycleStartDate && txDay <= prevCloseEndDate;
    });
    let closedExpense = 0;
    let closedIncome = 0;
    for (const tx of closedTxs) {
      if (tx.type === 'despesa') {
        closedExpense += tx.value;
      } else {
        closedIncome += tx.value;
      }
    }
    const closedInvoiceAmount = Number(Math.max(0, closedExpense - closedIncome).toFixed(2));
    const closedDaysUntilDue = diffDaysYmd(refYmd, prevDueDate);
    const closedIsDueSoon =
      closedDaysUntilDue >= 0 && closedDaysUntilDue <= 3 && closedInvoiceAmount > 0;

    closedInvoice = {
      cycleStartDate: prevCycleStartDate,
      cycleEndDate: prevCloseEndDate,
      dueDate: prevDueDate,
      amount: closedInvoiceAmount,
      daysUntilDue: closedDaysUntilDue,
      isDueSoon: closedIsDueSoon,
    };
  }

  let totalConfirmedExpense = 0;
  let totalConfirmedIncome = 0;
  for (const tx of confirmedTxs) {
    if (tx.type === 'despesa') {
      totalConfirmedExpense += tx.value;
    } else {
      totalConfirmedIncome += tx.value;
    }
  }

  const usedLimit = Number(Math.max(0, totalConfirmedExpense - totalConfirmedIncome).toFixed(2));
  const availableLimit = Number(Math.max(0, creditLimit - usedLimit).toFixed(2));

  let daysUntilDue = diffDaysYmd(refYmd, dueDate);
  let isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3 && currentInvoiceAmount > 0;

  if (closedInvoice && closedInvoice.amount > 0) {
    daysUntilDue = closedInvoice.daysUntilDue;
    isDueSoon = closedInvoice.isDueSoon;
  }

  const recentTransactions = [...confirmedTxs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  return {
    cycleStartDate,
    cycleEndDate,
    dueDate,
    daysUntilDue,
    isDueSoon,
    currentInvoiceAmount,
    creditLimit,
    usedLimit,
    availableLimit,
    cycleTransactions,
    recentTransactions,
    closedInvoice,
  };
}

export class CalculateCardInvoiceUseCase {
  private accountRepository: AccountRepository;
  private transactionRepository: TransactionRepository;
  private notificationService: NotificationService;

  constructor(
    accountRepository: AccountRepository = new AccountRepository(),
    transactionRepository: TransactionRepository = new TransactionRepository(),
    notificationService: NotificationService = new NotificationService()
  ) {
    this.accountRepository = accountRepository;
    this.transactionRepository = transactionRepository;
    this.notificationService = notificationService;
  }

  public async execute(
    accountId: string,
    referenceDateIso?: string,
    notifyIfDueSoon: boolean = true
  ): Promise<CalculateCardInvoiceResult> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error(`Cartão não encontrado com ID: ${accountId}`);
    }

    const transactions = await this.transactionRepository.findByAccountId(accountId);
    const cycleInfo = calculateCardInvoiceCycle({
      creditLimit: account.credit_limit ?? 0,
      closingDay: account.closing_day ?? 10,
      dueDay: account.due_day ?? 17,
      transactions,
      referenceDateIso,
    });

    if (notifyIfDueSoon && cycleInfo.isDueSoon) {
      const targetDueDate =
        cycleInfo.closedInvoice && cycleInfo.closedInvoice.isDueSoon
          ? cycleInfo.closedInvoice.dueDate
          : cycleInfo.dueDate;
      const targetAmount =
        cycleInfo.closedInvoice && cycleInfo.closedInvoice.isDueSoon
          ? cycleInfo.closedInvoice.amount
          : cycleInfo.currentInvoiceAmount;

      await this.notificationService.checkAndNotifyCardDueSoon({
        accountId: account.id,
        accountName: account.name,
        invoiceAmount: targetAmount,
        dueDateIso: targetDueDate,
        daysUntilDue: cycleInfo.daysUntilDue,
      });
    }

    return {
      account,
      ...cycleInfo,
    };
  }
}
