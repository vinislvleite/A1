import { Account } from '../entities/Account';
import { AccountRepository } from '../../data/repositories/AccountRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';

export interface AccountBalanceDetail {
  account: Account;
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
}

export interface BalanceSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  accounts: AccountBalanceDetail[];
}

export class CalculateBalanceUseCase {
  private accountRepository: AccountRepository;
  private transactionRepository: TransactionRepository;

  constructor(
    accountRepository: AccountRepository = new AccountRepository(),
    transactionRepository: TransactionRepository = new TransactionRepository()
  ) {
    this.accountRepository = accountRepository;
    this.transactionRepository = transactionRepository;
  }

  public async execute(accountId?: string): Promise<BalanceSummary> {
    try {
      const allAccounts = accountId
        ? await this.fetchSingleAccountList(accountId)
        : await this.accountRepository.findAll();

      const accountTotals = await this.transactionRepository.getAggregateTotalsPerAccount();

      const accountDetails: AccountBalanceDetail[] = [];
      let overallTotalIncome = 0;
      let overallTotalExpense = 0;
      let overallTotalBalance = 0;

      for (const account of allAccounts) {
        const totals = accountTotals.get(account.id) ?? { income: 0, expense: 0 };
        const currentBalance = account.initial_balance + totals.income - totals.expense;

        accountDetails.push({
          account,
          currentBalance,
          totalIncome: totals.income,
          totalExpense: totals.expense,
        });

        overallTotalIncome += totals.income;
        overallTotalExpense += totals.expense;
        overallTotalBalance += currentBalance;
      }

      return {
        totalBalance: overallTotalBalance,
        totalIncome: overallTotalIncome,
        totalExpense: overallTotalExpense,
        accounts: accountDetails,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao calcular saldo: ${message}`);
    }
  }

  private async fetchSingleAccountList(accountId: string): Promise<Account[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error(`Conta não encontrada com o ID: ${accountId}`);
    }
    return [account];
  }
}

