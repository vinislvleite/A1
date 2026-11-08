import { Transaction } from '../entities/Transaction';
import { AccountRepository } from '../../data/repositories/AccountRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';

export interface StatementLine {
  transaction: Transaction;
  signedValue: number;
  runningBalance: number;
  accountName: string;
}

export interface StatementResult {
  month: number;
  year: number;
  accountId?: string;
  accountName: string;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpense: number;
  lines: StatementLine[];
}

export function buildStatementLines(params: {
  openingBalance: number;
  transactions: Transaction[];
  accountNames?: Map<string, string>;
}): {
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpense: number;
  lines: StatementLine[];
} {
  const sorted = [...params.transactions].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const createdCmp = (a.created_at ?? '').localeCompare(b.created_at ?? '');
    if (createdCmp !== 0) return createdCmp;
    return a.id.localeCompare(b.id);
  });

  const openingBalance = Number(params.openingBalance.toFixed(2));
  let running = openingBalance;
  let totalIncome = 0;
  let totalExpense = 0;

  const lines: StatementLine[] = [];

  for (const tx of sorted) {
    if (tx.status !== 'confirmada') {
      continue;
    }
    const signedValue = tx.type === 'receita' ? Number(tx.value) : -Number(tx.value);
    if (tx.type === 'receita') {
      totalIncome = Number((totalIncome + tx.value).toFixed(2));
    } else {
      totalExpense = Number((totalExpense + tx.value).toFixed(2));
    }
    running = Number((running + signedValue).toFixed(2));
    lines.push({
      transaction: tx,
      signedValue: Number(signedValue.toFixed(2)),
      runningBalance: running,
      accountName: params.accountNames?.get(tx.account_id) ?? 'Conta',
    });
  }

  return {
    openingBalance,
    closingBalance: running,
    totalIncome,
    totalExpense,
    lines,
  };
}

export class BuildStatementUseCase {
  private accountRepository: AccountRepository;
  private transactionRepository: TransactionRepository;

  constructor(
    accountRepository: AccountRepository = new AccountRepository(),
    transactionRepository: TransactionRepository = new TransactionRepository()
  ) {
    this.accountRepository = accountRepository;
    this.transactionRepository = transactionRepository;
  }

  public async execute(params: {
    month: number;
    year: number;
    accountId?: string;
    asOfDate?: string;
  }): Promise<StatementResult> {
    const monthStr = String(params.month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(params.year, params.month, 0)).getUTCDate();
    const startDate = `${params.year}-${monthStr}-01`;
    const endOfMonthDate = `${params.year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const cutoffDay = (params.asOfDate ?? new Date().toISOString()).substring(0, 10);
    const effectiveEndDate = endOfMonthDate <= cutoffDay ? endOfMonthDate : cutoffDay;

    const allAccounts = await this.accountRepository.findAll();
    const accountNames = new Map<string, string>();
    for (const acc of allAccounts) {
      accountNames.set(acc.id, acc.name);
    }

    let initialBalanceSum = 0;
    let selectedAccountName = 'Todas as contas';

    if (params.accountId) {
      const target = allAccounts.find((a) => a.id === params.accountId);
      if (!target) {
        throw new Error(`Conta não encontrada com ID: ${params.accountId}`);
      }
      initialBalanceSum = Number(target.initial_balance ?? 0);
      selectedAccountName = target.name;
    } else {
      for (const acc of allAccounts) {
        initialBalanceSum += Number(acc.initial_balance ?? 0);
      }
    }

    const priorCutoff = startDate <= cutoffDay ? startDate : addOneDay(cutoffDay);
    const priorTotals = await this.transactionRepository.getTotalsBeforeDate(
      priorCutoff,
      params.accountId
    );
    const openingBalance = Number((initialBalanceSum + priorTotals.netDelta).toFixed(2));

    const monthTransactions =
      startDate <= effectiveEndDate
        ? await this.transactionRepository.findStatementTransactions({
            startDate,
            endDate: effectiveEndDate,
            accountId: params.accountId,
          })
        : [];

    const statement = buildStatementLines({
      openingBalance,
      transactions: monthTransactions,
      accountNames,
    });

    return {
      month: params.month,
      year: params.year,
      accountId: params.accountId,
      accountName: selectedAccountName,
      ...statement,
    };
  }
}

function addOneDay(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
