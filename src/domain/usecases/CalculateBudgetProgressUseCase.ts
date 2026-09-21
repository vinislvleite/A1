import { BudgetRepository } from '../../data/repositories/BudgetRepository';
import { CategoryRepository } from '../../data/repositories/CategoryRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';

export interface CategoryBudgetProgress {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  month: number;
  year: number;
  limitValue: number;
  spentValue: number;
  remainingValue: number;
  percentageSpent: number;
  isWarning: boolean;
  isExceeded: boolean;
}

export interface MonthlyBudgetProgressSummary {
  month: number;
  year: number;
  totalBudgeted: number;
  totalSpent: number;
  overallPercentage: number;
  categories: CategoryBudgetProgress[];
}

export class CalculateBudgetProgressUseCase {
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

  public async execute(month: number, year: number): Promise<MonthlyBudgetProgressSummary> {
    try {
      const budgets = await this.budgetRepository.findAllByMonth(month, year);
      const categories = await this.categoryRepository.findAll();
      const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

      const startMonthStr = String(month).padStart(2, '0');
      const startDate = `${year}-${startMonthStr}-01T00:00:00.000Z`;
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = String(lastDay).padStart(2, '0');
      const endDate = `${year}-${startMonthStr}-${lastDayStr}T23:59:59.999Z`;

      const monthlyTransactions = await this.transactionRepository.findAll({
        type: 'despesa',
        status: 'confirmada',
        startDate,
        endDate,
      });

      const spentByCategory = new Map<string, number>();
      for (const tx of monthlyTransactions) {
        const currentSpent = spentByCategory.get(tx.category_id) ?? 0;
        spentByCategory.set(tx.category_id, currentSpent + tx.value);
      }

      let totalBudgeted = 0;
      let totalSpent = 0;
      const categoryProgressList: CategoryBudgetProgress[] = [];

      for (const budget of budgets) {
        const category = categoryMap.get(budget.category_id);
        const categoryName = category ? category.name : 'Desconhecida';
        const categoryColor = category ? category.color : '#6B7280';
        const categoryIcon = category ? category.icon : 'grid';

        const spentValue = spentByCategory.get(budget.category_id) ?? 0;
        const limitValue = budget.limit_value;
        const remainingValue = limitValue - spentValue;
        const percentageSpent = limitValue > 0 ? Number(((spentValue / limitValue) * 100).toFixed(2)) : 0;
        const isWarning = percentageSpent >= 90 && percentageSpent < 100;
        const isExceeded = spentValue > limitValue;

        categoryProgressList.push({
          budgetId: budget.id,
          categoryId: budget.category_id,
          categoryName,
          categoryColor,
          categoryIcon,
          month: budget.month,
          year: budget.year,
          limitValue,
          spentValue,
          remainingValue,
          percentageSpent,
          isWarning,
          isExceeded,
        });

        totalBudgeted += limitValue;
        totalSpent += spentValue;
      }

      const overallPercentage = totalBudgeted > 0
        ? Number(((totalSpent / totalBudgeted) * 100).toFixed(2))
        : 0;

      return {
        month,
        year,
        totalBudgeted,
        totalSpent,
        overallPercentage,
        categories: categoryProgressList,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao calcular progresso de orçamentos: ${message}`);
    }
  }
}
