import { Transaction, TransactionStatus, TransactionType } from '../entities/Transaction';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';
import { clampDayToMonth } from './GenerateRecurringTransactionsUseCase';
import { generateUUID } from '../../utils/uuid';

export interface InstallmentSplitItem {
  installmentNumber: number;
  installmentTotal: number;
  value: number;
  date: string;
}

export interface CreateInstallmentsInput {
  account_id: string;
  category_id: string;
  totalValue: number;
  installmentCount: number;
  description: string;
  startDate: string;
  type?: TransactionType;
  color_label?: string;
  tags?: string[];
  notes?: string;
  attachment_uri?: string;
  status?: TransactionStatus;
}

export function addMonthsClampedIso(startDateIso: string, monthOffset: number): string {
  const datePart = startDateIso.substring(0, 10);
  const timePart = startDateIso.length > 10 ? startDateIso.substring(10) : 'T12:00:00.000Z';
  const [rawY, rawM, rawD] = datePart.split('-').map(Number);

  const baseYear = rawY || new Date().getUTCFullYear();
  const baseMonth = rawM || 1;
  const desiredDay = rawD || 1;

  const totalMonthsZeroBased = (baseYear * 12 + (baseMonth - 1)) + monthOffset;
  const targetYear = Math.floor(totalMonthsZeroBased / 12);
  const targetMonth = (totalMonthsZeroBased % 12) + 1;
  const clampedDay = clampDayToMonth(targetYear, targetMonth, desiredDay);

  const yStr = String(targetYear).padStart(4, '0');
  const mStr = String(targetMonth).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}${timePart}`;
}

export function calculateInstallmentSplits(
  totalValue: number,
  installmentCount: number,
  startDateIso: string
): InstallmentSplitItem[] {
  if (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 48) {
    throw new Error('O número de parcelas deve ser um inteiro entre 2 e 48.');
  }
  if (totalValue <= 0) {
    throw new Error('O valor total do parcelamento deve ser maior que zero.');
  }

  const totalCents = Math.round(totalValue * 100);
  const baseCents = Math.floor(totalCents / installmentCount);
  const remainderCents = totalCents - baseCents * installmentCount;

  const splits: InstallmentSplitItem[] = [];
  for (let i = 0; i < installmentCount; i++) {
    const isLast = i === installmentCount - 1;
    const itemCents = isLast ? baseCents + remainderCents : baseCents;
    splits.push({
      installmentNumber: i + 1,
      installmentTotal: installmentCount,
      value: Number((itemCents / 100).toFixed(2)),
      date: addMonthsClampedIso(startDateIso, i),
    });
  }

  return splits;
}

export class CreateInstallmentsUseCase {
  private transactionRepository: TransactionRepository;

  constructor(transactionRepository: TransactionRepository = new TransactionRepository()) {
    this.transactionRepository = transactionRepository;
  }

  public async execute(input: CreateInstallmentsInput): Promise<{
    groupId: string;
    installments: Transaction[];
  }> {
    const splits = calculateInstallmentSplits(
      input.totalValue,
      input.installmentCount,
      input.startDate
    );

    const groupId = generateUUID();
    const baseDescription = input.description.trim();
    const installments: Transaction[] = [];

    for (const split of splits) {
      const tx = await this.transactionRepository.create({
        account_id: input.account_id,
        category_id: input.category_id,
        value: split.value,
        type: input.type ?? 'despesa',
        description: `${baseDescription} (${split.installmentNumber}/${split.installmentTotal})`,
        date: split.date,
        is_recurring: false,
        installment_group_id: groupId,
        installment_number: split.installmentNumber,
        installment_total: split.installmentTotal,
        color_label: input.color_label,
        tags: input.tags,
        notes: input.notes,
        attachment_uri: input.attachment_uri,
        status: input.status ?? 'confirmada',
      });
      installments.push(tx);
    }

    return {
      groupId,
      installments,
    };
  }
}
