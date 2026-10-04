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

  public async execute(
    month: number,
    year: number,
    includeAllCategories: boolean = false
  ): Promise<MonthlyBudgetProgressSummary> {
    try {
      const budgets = await this.budgetRepository.findAllByMonth(month, year);
      const categories = await this.categoryRepository.findAll();
      const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
      const budgetMap = new Map(budgets.map((b) => [b.category_id, b]));

      const startMonthStr = String(month).padStart(2, '0');
      const startDate = `${year}-${startMonthStr}-01T00:00:00.000Z`;
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = String(lastDay).padStart(2, '0');
      const endDate = `${year}-${startMonthStr}-${lastDayStr}T23:59:59.999Z`;

      const [monthlyTransactions, allConfirmedExpenses] = await Promise.all([
        this.transactionRepository.findAll({
          type: 'despesa',
          status: 'confirmada',
          startDate,
          endDate,
        }),
        this.transactionRepository.findAll({
          type: 'despesa',
          status: 'confirmada',
        }),
      ]);

      const spentByCategory = new Map<string, number>();
      const countedTxIds = new Set<string>();

      for (const tx of monthlyTransactions) {
        countedTxIds.add(tx.id);
        const currentSpent = spentByCategory.get(tx.category_id) ?? 0;
        spentByCategory.set(tx.category_id, currentSpent + tx.value);
      }

      for (const tx of allConfirmedExpenses) {
        if (tx.is_recurring && !countedTxIds.has(tx.id) && tx.date <= endDate) {
          const currentSpent = spentByCategory.get(tx.category_id) ?? 0;
          spentByCategory.set(tx.category_id, currentSpent + tx.value);
        }
      }

      let totalBudgeted = 0;
      let totalSpent = 0;
      const categoryProgressList: CategoryBudgetProgress[] = [];

      const targetCategories = includeAllCategories
        ? categories
        : budgets
            .map((b) => categoryMap.get(b.category_id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c));

      for (const category of targetCategories) {
        const budget = budgetMap.get(category.id);
        const categoryName = category.name;
        const categoryColor = category.color || '#6B7280';
        const categoryIcon = category.icon || 'grid';

        const spentValue = spentByCategory.get(category.id) ?? 0;
        const limitValue = budget ? budget.limit_value : 0;
        const remainingValue = limitValue > 0 ? limitValue - spentValue : 0;
        const percentageSpent =
          limitValue > 0 ? Number(((spentValue / limitValue) * 100).toFixed(2)) : 0;
        const isWarning = limitValue > 0 && percentageSpent >= 90 && percentageSpent <= 100;
        const isExceeded = limitValue > 0 && spentValue > limitValue;

        categoryProgressList.push({
          budgetId: budget ? budget.id : '',
          categoryId: category.id,
          categoryName,
          categoryColor,
          categoryIcon,
          month,
          year,
          limitValue,
          spentValue,
          remainingValue,
          percentageSpent,
          isWarning,
          isExceeded,
        });

        if (budget) {
          totalBudgeted += limitValue;
          totalSpent += spentValue;
        }
      }

      const overallPercentage =
        totalBudgeted > 0 ? Number(((totalSpent / totalBudgeted) * 100).toFixed(2)) : 0;

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
