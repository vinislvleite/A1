import { BudgetRepository } from '../../data/repositories/BudgetRepository';
import { ZeroBasedAllocation, ZeroBasedGroupType } from '../entities/Budget';

export interface ZeroBasedSummary {
  expectedIncome: number;
  totalAllocated: number;
  gastosTotal: number;
  poupancaTotal: number;
  investimentosTotal: number;
  remainingToAllocate: number;
  isZeroBalanced: boolean;
  isOverAllocated: boolean;
}

export function calculateZeroBasedSummary(
  expectedIncome: number,
  items: Array<{ group_type: ZeroBasedGroupType; allocated_value: number }>
): ZeroBasedSummary {
  const safeIncome = Number(Math.max(0, expectedIncome).toFixed(2));
  let gastosTotal = 0;
  let poupancaTotal = 0;
  let investimentosTotal = 0;

  for (const item of items) {
    const val = Number(Math.max(0, Number(item.allocated_value || 0)).toFixed(2));
    if (item.group_type === 'gastos') {
      gastosTotal = Number((gastosTotal + val).toFixed(2));
    } else if (item.group_type === 'poupanca') {
      poupancaTotal = Number((poupancaTotal + val).toFixed(2));
    } else if (item.group_type === 'investimentos') {
      investimentosTotal = Number((investimentosTotal + val).toFixed(2));
    }
  }

  const totalAllocated = Number((gastosTotal + poupancaTotal + investimentosTotal).toFixed(2));
  const remainingToAllocate = Number((safeIncome - totalAllocated).toFixed(2));
  const isZeroBalanced = safeIncome > 0 && Math.abs(remainingToAllocate) < 0.005;
  const isOverAllocated = remainingToAllocate < -0.005;

  return {
    expectedIncome: safeIncome,
    totalAllocated,
    gastosTotal,
    poupancaTotal,
    investimentosTotal,
    remainingToAllocate,
    isZeroBalanced,
    isOverAllocated,
  };
}

export class ZeroBasedBudgetUseCase {
  private budgetRepository: BudgetRepository;

  constructor(budgetRepository: BudgetRepository = new BudgetRepository()) {
    this.budgetRepository = budgetRepository;
  }

  public async loadMonth(
    month: number,
    year: number
  ): Promise<{ allocations: ZeroBasedAllocation[]; summary: ZeroBasedSummary }> {
    const allocations = await this.budgetRepository.findZeroBasedAllocations(month, year);
    const expectedIncome = allocations.length > 0 ? allocations[0].expected_income : 0;
    const summary = calculateZeroBasedSummary(expectedIncome, allocations);
    return { allocations, summary };
  }

  public async saveMonth(params: {
    month: number;
    year: number;
    expectedIncome: number;
    items: Array<{
      group_type: ZeroBasedGroupType;
      category_name: string;
      category_id?: string | null;
      allocated_value: number;
    }>;
    syncExpenseBudgets?: boolean;
  }): Promise<{ allocations: ZeroBasedAllocation[]; summary: ZeroBasedSummary }> {
    const allocations = await this.budgetRepository.saveZeroBasedAllocations(
      params.month,
      params.year,
      params.expectedIncome,
      params.items
    );

    if (params.syncExpenseBudgets) {
      for (const item of params.items) {
        if (item.group_type === 'gastos' && item.category_id && item.allocated_value > 0) {
          await this.budgetRepository.setCategoryBudget(
            item.category_id,
            params.month,
            params.year,
            item.allocated_value,
            { periodType: 'mensal', budgetMode: 'fixo' }
          );
        }
      }
    }

    const summary = calculateZeroBasedSummary(params.expectedIncome, allocations);
    return { allocations, summary };
  }
}
