import { Account } from '../entities/Account';
import { Transaction } from '../entities/Transaction';
import { AccountRepository } from '../../data/repositories/AccountRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { NotificationService } from '../../services/NotificationService';

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

export function calculateCardInvoiceCycle(params: {
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  transactions: Transaction[];
  referenceDateIso?: string;
}): CardInvoiceCycleInfo {
  const refYmd = (params.referenceDateIso ?? new Date().toISOString()).substring(0, 10);
  const [refYear, refMonthOneBased, refDay] = refYmd.split('-').map(Number);
  const refMonthZero = refMonthOneBased - 1;

  const closingDay = Math.min(Math.max(1, Math.trunc(params.closingDay || 10)), 31);
  const dueDay = Math.min(Math.max(1, Math.trunc(params.dueDay || 17)), 31);
  const creditLimit = Math.max(0, Number(params.creditLimit || 0));

  const closingDayInRefMonth = Math.min(closingDay, getDaysInMonth(refYear, refMonthZero));

  let closeYear = refYear;
  let closeMonthZero = refMonthZero;

  if (refDay > closingDayInRefMonth) {
    closeMonthZero += 1;
    if (closeMonthZero > 11) {
      closeMonthZero = 0;
      closeYear += 1;
    }
  } else if (dueDay <= closingDay && refDay <= dueDay) {
    closeMonthZero -= 1;
    if (closeMonthZero < 0) {
      closeMonthZero = 11;
      closeYear -= 1;
    }
  }

  let prevCloseYear = closeYear;
  let prevCloseMonthZero = closeMonthZero - 1;
  if (prevCloseMonthZero < 0) {
    prevCloseMonthZero = 11;
    prevCloseYear -= 1;
  }

  const prevCloseYmd = formatYmd(prevCloseYear, prevCloseMonthZero, closingDay);
  const cycleStartDate = addDaysYmd(prevCloseYmd, 1);
  const cycleEndDate = formatYmd(closeYear, closeMonthZero, closingDay);

  let dueYear = closeYear;
  let dueMonthZero = closeMonthZero;
  if (dueDay <= closingDay) {
    dueMonthZero += 1;
    if (dueMonthZero > 11) {
      dueMonthZero = 0;
      dueYear += 1;
    }
  }
  const dueDate = formatYmd(dueYear, dueMonthZero, dueDay);

  const confirmedTxs = params.transactions.filter((tx) => tx.status === 'confirmada');

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
  const daysUntilDue = diffDaysYmd(refYmd, dueDate);
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3 && currentInvoiceAmount > 0;

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
      await this.notificationService.checkAndNotifyCardDueSoon({
        accountId: account.id,
        accountName: account.name,
        invoiceAmount: cycleInfo.currentInvoiceAmount,
        dueDateIso: cycleInfo.dueDate,
        daysUntilDue: cycleInfo.daysUntilDue,
      });
    }

    return {
      account,
      ...cycleInfo,
    };
  }
}
