import { BudgetRepository } from '../../data/repositories/BudgetRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { BudgetEvent } from '../entities/Budget';
import { Transaction } from '../entities/Transaction';

export interface EventBudgetProgress {
  event: BudgetEvent;
  spentValue: number;
  remainingValue: number;
  percentageSpent: number;
  isWarning: boolean;
  isExceeded: boolean;
  transactions: Transaction[];
}

export class EventBudgetUseCase {
  private budgetRepository: BudgetRepository;
  private transactionRepository: TransactionRepository;

  constructor(
    budgetRepository: BudgetRepository = new BudgetRepository(),
    transactionRepository: TransactionRepository = new TransactionRepository()
  ) {
    this.budgetRepository = budgetRepository;
    this.transactionRepository = transactionRepository;
  }

  public async createEvent(data: {
    name: string;
    limit_value: number;
    start_date: string;
    end_date: string;
  }): Promise<BudgetEvent> {
    if (!data.name.trim()) {
      throw new Error('Informe o nome do evento.');
    }
    if (data.limit_value <= 0) {
      throw new Error('Informe um orçamento limite maior que zero.');
    }
    return this.budgetRepository.createEvent(data);
  }

  public async listEventsWithProgress(): Promise<EventBudgetProgress[]> {
    const events = await this.budgetRepository.findAllEvents();
    const results: EventBudgetProgress[] = [];

    for (const ev of events) {
      const txs = await this.transactionRepository.findAll({
        eventId: ev.id,
        type: 'despesa',
        status: 'confirmada',
      });

      let spent = 0;
      for (const tx of txs) {
        spent = Number((spent + tx.value).toFixed(2));
      }

      const limit = Number(ev.limit_value.toFixed(2));
      const remaining = Number((limit - spent).toFixed(2));
      const pct = limit > 0 ? Number(((spent / limit) * 100).toFixed(2)) : 0;

      results.push({
        event: ev,
        spentValue: spent,
        remainingValue: remaining,
        percentageSpent: pct,
        isWarning: limit > 0 && pct >= 90 && pct <= 100,
        isExceeded: limit > 0 && spent > limit,
        transactions: txs,
      });
    }

    return results;
  }
}
