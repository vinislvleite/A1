import { BudgetRepository } from '../../data/repositories/BudgetRepository';
import { CategoryRepository } from '../../data/repositories/CategoryRepository';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { BudgetMode, BudgetPeriod } from '../entities/Budget';

export interface CategoryBudgetProgress {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  month: number;
  year: number;
  periodType?: BudgetPeriod;
  budgetMode?: BudgetMode;
  percentageValue?: number | null;
  missingIncomeWarning?: boolean;
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
  periodType?: BudgetPeriod;
  monthlyIncome?: number;
  totalBudgeted: number;
  totalSpent: number;
  overallPercentage: number;
  categories: CategoryBudgetProgress[];
}

export function calculateEffectiveFlexibleLimit(params: {
  budgetMode: BudgetMode;
  fixedLimit: number;
  percentageValue?: number | null;
  monthlyIncome: number;
}): { effectiveLimit: number; missingIncomeWarning: boolean } {
  if (params.budgetMode === 'percentual') {
    const pct = Number(params.percentageValue ?? 0);
    if (params.monthlyIncome <= 0) {
      return {
        effectiveLimit: 0,
        missingIncomeWarning: true,
      };
    }
    const calc = Number(((params.monthlyIncome * pct) / 100).toFixed(2));
    return {
      effectiveLimit: calc,
      missingIncomeWarning: false,
    };
  }

  return {
    effectiveLimit: Number(params.fixedLimit.toFixed(2)),
    missingIncomeWarning: false,
  };
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

      const [monthlyTransactions, allConfirmedExpenses, periodTotals] = await Promise.all([
        this.transactionRepository.findAll({
          type: 'despesa',
          status: 'confirmada',
          startDate,
          endDate,
          excludeEvents: true,
        }),
        this.transactionRepository.findAll({
          type: 'despesa',
          status: 'confirmada',
          excludeEvents: true,
        }),
        this.transactionRepository.getTotalsByPeriod(startDate, endDate),
      ]);

      const monthlyIncome = periodTotals.totalIncome;

      const spentByCategory = new Map<string, number>();
      const countedTxIds = new Set<string>();
      const countedRecurringParentIds = new Set<string>();

      for (const tx of monthlyTransactions) {
        if (tx.event_id) continue;
        countedTxIds.add(tx.id);
        if (tx.is_recurring || tx.recurrence_parent_id) {
          countedRecurringParentIds.add(tx.recurrence_parent_id ?? tx.id);
        }
        const currentSpent = spentByCategory.get(tx.category_id) ?? 0;
        spentByCategory.set(tx.category_id, Number((currentSpent + tx.value).toFixed(2)));
      }

      for (const tx of allConfirmedExpenses) {
        if (tx.event_id) continue;
        const rootParentId = tx.recurrence_parent_id ?? tx.id;
        if (
          tx.is_recurring &&
          !tx.recurrence_parent_id &&
          !countedTxIds.has(tx.id) &&
          !countedRecurringParentIds.has(rootParentId) &&
          tx.date <= endDate
        ) {
          countedRecurringParentIds.add(rootParentId);
          const currentSpent = spentByCategory.get(tx.category_id) ?? 0;
          spentByCategory.set(tx.category_id, Number((currentSpent + tx.value).toFixed(2)));
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
        const mode: BudgetMode = budget?.budget_mode ?? 'fixo';
        const pctValue = budget?.percentage_value ?? null;

        const { effectiveLimit, missingIncomeWarning } = budget
          ? calculateEffectiveFlexibleLimit({
              budgetMode: mode,
              fixedLimit: budget.limit_value,
              percentageValue: pctValue,
              monthlyIncome,
            })
          : { effectiveLimit: 0, missingIncomeWarning: false };

        const limitValue = effectiveLimit;
        const remainingValue = limitValue > 0 ? Number((limitValue - spentValue).toFixed(2)) : 0;
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
          periodType: 'mensal',
          budgetMode: mode,
          percentageValue: pctValue,
          missingIncomeWarning,
          limitValue,
          spentValue,
          remainingValue,
          percentageSpent,
          isWarning,
          isExceeded,
        });

        if (budget) {
          totalBudgeted = Number((totalBudgeted + limitValue).toFixed(2));
          totalSpent = Number((totalSpent + spentValue).toFixed(2));
        }
      }

      const overallPercentage =
        totalBudgeted > 0 ? Number(((totalSpent / totalBudgeted) * 100).toFixed(2)) : 0;

      return {
        month,
        year,
        periodType: 'mensal',
        monthlyIncome,
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

  public async executeAnnual(
    year: number,
    includeAllCategories: boolean = false
  ): Promise<MonthlyBudgetProgressSummary> {
    try {
      const annualBudgets = await this.budgetRepository.findAllAnnualByYear(year);
      const categories = await this.categoryRepository.findAll();
      const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
      const budgetMap = new Map(annualBudgets.map((b) => [b.category_id, b]));

      const startDate = `${year}-01-01T00:00:00.000Z`;
      const endDate = `${year}-12-31T23:59:59.999Z`;

      const annualTransactions = await this.transactionRepository.findAll({
        type: 'despesa',
        status: 'confirmada',
        startDate,
        endDate,
        excludeEvents: true,
      });

      const spentByCategory = new Map<string, number>();
      for (const tx of annualTransactions) {
        if (tx.event_id) continue;
        const currentSpent = spentByCategory.get(tx.category_id) ?? 0;
        spentByCategory.set(tx.category_id, Number((currentSpent + tx.value).toFixed(2)));
      }

      let totalBudgeted = 0;
      let totalSpent = 0;
      const categoryProgressList: CategoryBudgetProgress[] = [];

      const targetCategories = includeAllCategories
        ? categories
        : annualBudgets
            .map((b) => categoryMap.get(b.category_id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c));

      for (const category of targetCategories) {
        const budget = budgetMap.get(category.id);
        const spentValue = spentByCategory.get(category.id) ?? 0;
        const limitValue = budget ? Number(budget.limit_value.toFixed(2)) : 0;
        const remainingValue = limitValue > 0 ? Number((limitValue - spentValue).toFixed(2)) : 0;
        const percentageSpent =
          limitValue > 0 ? Number(((spentValue / limitValue) * 100).toFixed(2)) : 0;
        const isWarning = limitValue > 0 && percentageSpent >= 90 && percentageSpent <= 100;
        const isExceeded = limitValue > 0 && spentValue > limitValue;

        categoryProgressList.push({
          budgetId: budget ? budget.id : '',
          categoryId: category.id,
          categoryName: category.name,
          categoryColor: category.color || '#6B7280',
          categoryIcon: category.icon || 'grid',
          month: 0,
          year,
          periodType: 'anual',
          budgetMode: 'fixo',
          percentageValue: null,
          missingIncomeWarning: false,
          limitValue,
          spentValue,
          remainingValue,
          percentageSpent,
          isWarning,
          isExceeded,
        });

        if (budget) {
          totalBudgeted = Number((totalBudgeted + limitValue).toFixed(2));
          totalSpent = Number((totalSpent + spentValue).toFixed(2));
        }
      }

      const overallPercentage =
        totalBudgeted > 0 ? Number(((totalSpent / totalBudgeted) * 100).toFixed(2)) : 0;

      return {
        month: 0,
        year,
        periodType: 'anual',
        totalBudgeted,
        totalSpent,
        overallPercentage,
        categories: categoryProgressList,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao calcular progresso de orçamento anual: ${message}`);
    }
  }
}
