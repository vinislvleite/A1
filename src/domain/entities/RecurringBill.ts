export type BillUrgencyStatus = 'vencida' | 'vence_em_breve' | 'em_dia' | 'paga';

export interface RecurringBill {
  id: string;
  name: string;
  value: number;
  due_day: number;
  reminder_days_before: number;
  category_id: string;
  account_id?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface BillPayment {
  id: string;
  bill_id: string;
  month: number;
  year: number;
  paid_at: string;
  transaction_id?: string;
}

export interface BillWithStatus extends RecurringBill {
  status: BillUrgencyStatus;
  nextDueDateIso: string;
  daysUntilDue: number;
  isPaidInCurrentMonth: boolean;
  payment?: BillPayment;
  categoryName?: string;
  accountName?: string;
}
