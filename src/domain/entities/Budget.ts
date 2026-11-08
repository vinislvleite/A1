export type BudgetPeriod = 'mensal' | 'anual';
export type BudgetMode = 'fixo' | 'percentual';
export type ZeroBasedGroupType = 'gastos' | 'poupanca' | 'investimentos';
export type SpendingGoalStatus = 'cumprida' | 'em_risco' | 'estourada';

export interface Budget {
  id: string;
  category_id: string;
  month: number;
  year: number;
  limit_value: number;
  period_type: BudgetPeriod;
  budget_mode?: BudgetMode;
  percentage_value?: number | null;
}

export interface CreateBudgetDTO {
  category_id: string;
  month: number;
  year: number;
  limit_value: number;
  period_type?: BudgetPeriod;
  budget_mode?: BudgetMode;
  percentage_value?: number | null;
}

export interface UpdateBudgetDTO {
  limit_value?: number;
  period_type?: BudgetPeriod;
  budget_mode?: BudgetMode;
  percentage_value?: number | null;
}

export interface ZeroBasedAllocation {
  id: string;
  month: number;
  year: number;
  group_type: ZeroBasedGroupType;
  category_name: string;
  category_id?: string | null;
  allocated_value: number;
  expected_income: number;
}

export interface BudgetEvent {
  id: string;
  name: string;
  limit_value: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface DailySpendingLimit {
  day_of_week: number;
  limit_value: number;
}

export interface CategorySpendingGoal {
  id: string;
  category_id: string;
  max_monthly_value: number;
  created_at: string;
}
