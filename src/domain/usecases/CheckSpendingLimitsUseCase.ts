import { BudgetRepository } from '../../data/repositories/BudgetRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { NotificationService } from '../../services/NotificationService';

export interface TransactionLimitCheckResult {
  exceeded: boolean;
  maxLimit: number | null;
  transactionValue: number;
}

export interface DailyLimitCheckResult {
  exceeded: boolean;
  dayOfWeek: number;
  dailyLimit: number | null;
  totalDaySpent: number;
  notified: boolean;
}

export function evaluateTransactionLimit(
  value: number,
  maxLimit: number | null
): TransactionLimitCheckResult {
  if (maxLimit === null || maxLimit <= 0) {
    return {
      exceeded: false,
      maxLimit: null,
      transactionValue: value,
    };
  }
  return {
    exceeded: value > maxLimit,
    maxLimit,
    transactionValue: value,
  };
}

export function getWeekdayFromYmd(dateIso: string): number {
  const ymd = dateIso.substring(0, 10);
  const parts = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return dt.getUTCDay();
}

export class CheckSpendingLimitsUseCase {
  private budgetRepository: BudgetRepository;
  private transactionRepository: TransactionRepository;
  private notificationService: NotificationService;

  constructor(
    budgetRepository: BudgetRepository = new BudgetRepository(),
    transactionRepository: TransactionRepository = new TransactionRepository(),
    notificationService: NotificationService = new NotificationService()
  ) {
    this.budgetRepository = budgetRepository;
    this.transactionRepository = transactionRepository;
    this.notificationService = notificationService;
  }

  public async checkTransactionLimit(value: number): Promise<TransactionLimitCheckResult> {
    const maxLimit = await this.budgetRepository.getMaxTransactionLimit();
    return evaluateTransactionLimit(value, maxLimit);
  }

  public async checkDailyLimitAfterExpense(dateIso: string): Promise<DailyLimitCheckResult> {
    const dayYmd = dateIso.substring(0, 10);
    const dayOfWeek = getWeekdayFromYmd(dayYmd);
    const dailyLimit = await this.budgetRepository.getDailyLimitForDay(dayOfWeek);

    const periodTotals = await this.transactionRepository.getTotalsByPeriod(dayYmd, dayYmd);
    const totalDaySpent = Number(periodTotals.totalExpense.toFixed(2));

    if (dailyLimit === null || dailyLimit <= 0 || totalDaySpent <= dailyLimit) {
      return {
        exceeded: false,
        dayOfWeek,
        dailyLimit,
        totalDaySpent,
        notified: false,
      };
    }

    const notifyRes = await this.notificationService.checkAndNotifyDailyLimitExceeded({
      dateYmd: dayYmd,
      totalDaySpent,
      dailyLimit,
    });

    return {
      exceeded: true,
      dayOfWeek,
      dailyLimit,
      totalDaySpent,
      notified: notifyRes.shouldAlert,
    };
  }
}
