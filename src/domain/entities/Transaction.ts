export type TransactionType = 'receita' | 'despesa';
export type TransactionStatus = 'confirmada' | 'pendente';

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
  searchTerm?: string;
  minValue?: number;
  maxValue?: number;
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
