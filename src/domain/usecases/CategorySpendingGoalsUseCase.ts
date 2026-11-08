import { BudgetRepository } from '../../data/repositories/BudgetRepository';
import { CategoryRepository } from '../../data/repositories/CategoryRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { CategorySpendingGoal, SpendingGoalStatus } from '../entities/Budget';

export interface CategorySpendingGoalProgress {
  goal: CategorySpendingGoal;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  spentValue: number;
  maxMonthlyValue: number;
  percentageSpent: number;
  status: SpendingGoalStatus;
}

export function evaluateSpendingGoalStatus(
  spentValue: number,
  maxMonthlyValue: number
): { percentageSpent: number; status: SpendingGoalStatus } {
  if (maxMonthlyValue <= 0) {
    return { percentageSpent: 0, status: 'cumprida' };
  }
  const pct = Number(((spentValue / maxMonthlyValue) * 100).toFixed(2));
  if (spentValue > maxMonthlyValue) {
    return { percentageSpent: pct, status: 'estourada' };
  }
  if (pct >= 80) {
    return { percentageSpent: pct, status: 'em_risco' };
  }
  return { percentageSpent: pct, status: 'cumprida' };
}

export class CategorySpendingGoalsUseCase {
  private budgetRepository: BudgetRepository;
  private categoryRepository: CategoryRepository;
  private transactionRepository: TransactionRepository;

  constructor(
    budgetRepository: BudgetRepository = new BudgetRepository(),
    categoryRepository: CategoryRepository = new CategoryRepository(),
    transactionRepository: TransactionRepository = new TransactionRepository()
  ) {
    this.budgetRepository = budgetRepository;
    this.categoryRepository = categoryRepository;
    this.transactionRepository = transactionRepository;
  }

  public async execute(month: number, year: number): Promise<CategorySpendingGoalProgress[]> {
    const [goals, categories] = await Promise.all([
      this.budgetRepository.findAllCategorySpendingGoals(),
      this.categoryRepository.findAll(),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${monthStr}-01T00:00:00.000Z`;
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

    const expenses = await this.transactionRepository.findAll({
      type: 'despesa',
      status: 'confirmada',
      startDate,
      endDate,
      excludeEvents: true,
    });

    const spentMap = new Map<string, number>();
    for (const tx of expenses) {
      if (tx.event_id) continue;
      const cur = spentMap.get(tx.category_id) ?? 0;
      spentMap.set(tx.category_id, Number((cur + tx.value).toFixed(2)));
    }

    const result: CategorySpendingGoalProgress[] = [];
    for (const goal of goals) {
      const cat = catMap.get(goal.category_id);
      const spent = spentMap.get(goal.category_id) ?? 0;
      const { percentageSpent, status } = evaluateSpendingGoalStatus(
        spent,
        goal.max_monthly_value
      );
      result.push({
        goal,
        categoryName: cat?.name ?? 'Categoria',
        categoryColor: cat?.color ?? '#60A5FA',
        categoryIcon: cat?.icon ?? 'tag',
        spentValue: spent,
        maxMonthlyValue: goal.max_monthly_value,
        percentageSpent,
        status,
      });
    }

    return result;
  }
}
