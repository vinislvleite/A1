import { Transaction } from '../entities/Transaction';
import { TransactionRepository } from '../../data/repositories/TransactionRepository';

export interface YearMonthSlot {
  year: number;
  month: number;
  yearMonth: string;
}

export function clampDayToMonth(year: number, month1To12: number, desiredDay: number): number {
  const safeDesired = Math.max(1, Math.min(31, Math.floor(desiredDay)));
  const lastDayOfMonth = new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
  return Math.min(safeDesired, lastDayOfMonth);
}

export function buildRecurringDateIso(year: number, month1To12: number, desiredDay: number): string {
  const day = clampDayToMonth(year, month1To12, desiredDay);
  const yStr = String(year).padStart(4, '0');
  const mStr = String(month1To12).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}T12:00:00.000Z`;
}

export function listElapsedYearMonths(startDateIso: string, targetDateIso: string): YearMonthSlot[] {
  const startPrefix = startDateIso.substring(0, 7);
  const targetPrefix = targetDateIso.substring(0, 7);

  const [startY, startM] = startPrefix.split('-').map(Number);
  const [targetY, targetM] = targetPrefix.split('-').map(Number);

  if (!startY || !startM || !targetY || !targetM) {
    return [];
  }

  const slots: YearMonthSlot[] = [];
  let curY = startY;
  let curM = startM + 1;
  if (curM > 12) {
    curM = 1;
    curY += 1;
  }

  while (curY < targetY || (curY === targetY && curM <= targetM)) {
    const yearMonth = `${String(curY).padStart(4, '0')}-${String(curM).padStart(2, '0')}`;
    slots.push({ year: curY, month: curM, yearMonth });
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
  }

  return slots;
}

export class GenerateRecurringTransactionsUseCase {
  private transactionRepository: TransactionRepository;

  constructor(transactionRepository: TransactionRepository = new TransactionRepository()) {
    this.transactionRepository = transactionRepository;
  }

  public async execute(
    referenceDateIso?: string
  ): Promise<{ generatedCount: number; generatedTransactions: Transaction[] }> {
    const refIso = referenceDateIso ?? new Date().toISOString();
    const refDay = refIso.substring(0, 10);

    const allTransactions = await this.transactionRepository.findAll();

    const existingPeriodKeys = new Set<string>();
    for (const tx of allTransactions) {
      const parentId = tx.recurrence_parent_id ?? (tx.is_recurring ? tx.id : undefined);
      if (parentId) {
        const ym = tx.date.substring(0, 7);
        existingPeriodKeys.add(`${parentId}:${ym}`);
      }
    }

    const rootTemplates = allTransactions.filter(
      (tx) => tx.is_recurring && !tx.recurrence_parent_id
    );

    const generatedTransactions: Transaction[] = [];

    for (const template of rootTemplates) {
      const fallbackDay = Number(template.date.substring(8, 10)) || 1;
      const desiredDay = template.recurrence_day ?? fallbackDay;
      const slots = listElapsedYearMonths(template.date, refIso);

      for (const slot of slots) {
        const periodKey = `${template.id}:${slot.yearMonth}`;
        if (existingPeriodKeys.has(periodKey)) {
          continue;
        }

        const occurrenceIso = buildRecurringDateIso(slot.year, slot.month, desiredDay);
        const occurrenceDay = occurrenceIso.substring(0, 10);

        if (occurrenceDay > refDay) {
          continue;
        }

        existingPeriodKeys.add(periodKey);

        const created = await this.transactionRepository.create({
          account_id: template.account_id,
          category_id: template.category_id,
          value: template.value,
          type: template.type,
          description: template.description,
          date: occurrenceIso,
          is_recurring: true,
          recurrence_day: desiredDay,
          recurrence_parent_id: template.id,
          is_extra_income: template.is_extra_income,
          income_source: template.income_source,
          color_label: template.color_label,
          tags: template.tags,
          notes: template.notes,
          status: 'confirmada',
        });

        generatedTransactions.push(created);
      }
    }

    return {
      generatedCount: generatedTransactions.length,
      generatedTransactions,
    };
  }
}
