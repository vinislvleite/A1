export type BudgetPeriod = 'mensal' | 'anual';

export interface Budget {
  id: string;
  category_id: string;
  month: number;
  year: number;
  limit_value: number;
  period_type: BudgetPeriod;
}

export interface CreateBudgetDTO {
  category_id: string;
  month: number;
  year: number;
  limit_value: number;
  period_type?: BudgetPeriod;
}

export interface UpdateBudgetDTO {
  limit_value?: number;
  period_type?: BudgetPeriod;
}
