export type TransactionType = 'receita' | 'despesa';
export type TransactionStatus = 'confirmada' | 'pendente';

export const TRANSACTION_COLOR_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#64748B',
] as const;

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string;
  value: number;
  type: TransactionType;
  description: string;
  date: string;
  is_recurring: boolean;
  recurrence_day?: number;
  recurrence_parent_id?: string;
  installment_group_id?: string;
  installment_number?: number;
  installment_total?: number;
  is_extra_income?: boolean;
  income_source?: string;
  color_label?: string;
  event_id?: string;
  tags: string[];
  notes?: string;
  attachment_uri?: string;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionDTO {
  account_id: string;
  category_id: string;
  value: number;
  type: TransactionType;
  description: string;
  date: string;
  is_recurring: boolean;
  recurrence_day?: number;
  recurrence_parent_id?: string;
  installment_group_id?: string;
  installment_number?: number;
  installment_total?: number;
  is_extra_income?: boolean;
  income_source?: string;
  color_label?: string;
  event_id?: string;
  tags?: string[];
  notes?: string;
  attachment_uri?: string;
  status?: TransactionStatus;
}

export interface UpdateTransactionDTO {
  account_id?: string;
  category_id?: string;
  value?: number;
  type?: TransactionType;
  description?: string;
  date?: string;
  is_recurring?: boolean;
  recurrence_day?: number;
  recurrence_parent_id?: string;
  installment_group_id?: string;
  installment_number?: number;
  installment_total?: number;
  is_extra_income?: boolean;
  income_source?: string;
  color_label?: string;
  event_id?: string;
  tags?: string[];
  notes?: string;
  attachment_uri?: string;
  status?: TransactionStatus;
}

export interface TransactionFilter {
  accountId?: string;
  categoryId?: string;
  categoryIds?: string[];
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  maxEffectiveDate?: string;
  searchTerm?: string;
  minValue?: number;
  maxValue?: number;
  isExtraIncome?: boolean;
  tag?: string;
  tags?: string[];
  installmentGroupId?: string;
  recurrenceParentId?: string;
  eventId?: string;
  excludeEvents?: boolean;
}

export interface CategoryMonthlyTotal {
  yearMonth: string;
  total: number;
  count: number;
}

export type TransactionSortField = 'date' | 'value' | 'category';
export type SortDirection = 'ASC' | 'DESC';

export interface TransactionSortOptions {
  field?: TransactionSortField;
  direction?: SortDirection;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
