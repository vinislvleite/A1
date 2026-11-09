import {
  formatDate,
  formatDateDayMonth,
  formatDateTime,
  formatMonthYear,
  formatRelativeDay,
  parseBrDate,
  fromIsoDate,
  toIsoDate,
  formatDateInputMask,
  formatPercent,
  formatCurrencyBRL,
  getNextOccurrenceForDay,
  extractDayFromBrDate,
  MONTH_NAMES,
  MONTH_NAMES_LOWER,
  MONTH_NAMES_SHORT,
  WEEKDAY_NAMES,
  WEEKDAY_NAMES_SHORT,
} from '../src/utils/date';
import { calculateCardInvoiceCycle } from '../src/domain/usecases/CalculateCardInvoiceUseCase';
import { Transaction } from '../src/domain/entities/Transaction';

describe('Central Date & Localization Utility', () => {
  describe('Constants', () => {
    it('defines 12 months correctly in capitalized form', () => {
      expect(MONTH_NAMES).toHaveLength(12);
      expect(MONTH_NAMES[0]).toBe('Janeiro');
      expect(MONTH_NAMES[8]).toBe('Setembro');
      expect(MONTH_NAMES[11]).toBe('Dezembro');
    });

    it('defines 12 months correctly in lowercase form', () => {
      expect(MONTH_NAMES_LOWER).toHaveLength(12);
      expect(MONTH_NAMES_LOWER[0]).toBe('janeiro');
      expect(MONTH_NAMES_LOWER[8]).toBe('setembro');
      expect(MONTH_NAMES_LOWER[11]).toBe('dezembro');
    });

    it('defines 12 short months correctly', () => {
      expect(MONTH_NAMES_SHORT).toHaveLength(12);
      expect(MONTH_NAMES_SHORT[0]).toBe('Jan');
      expect(MONTH_NAMES_SHORT[8]).toBe('Set');
      expect(MONTH_NAMES_SHORT[11]).toBe('Dez');
    });

    it('defines 7 weekdays correctly', () => {
      expect(WEEKDAY_NAMES).toHaveLength(7);
      expect(WEEKDAY_NAMES[0]).toBe('Domingo');
      expect(WEEKDAY_NAMES[6]).toBe('Sábado');
      expect(WEEKDAY_NAMES_SHORT).toHaveLength(7);
      expect(WEEKDAY_NAMES_SHORT[0]).toBe('Dom');
      expect(WEEKDAY_NAMES_SHORT[6]).toBe('Sáb');
    });
  });

  describe('fromIsoDate & toIsoDate', () => {
    it('parses date-only string as local date without UTC previous-day shift', () => {
      const parsed = fromIsoDate('2026-09-10');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(8);
      expect(parsed.getDate()).toBe(10);
    });

    it('converts local date to ISO date string YYYY-MM-DD', () => {
      const d = new Date(2026, 8, 10, 23, 30, 0);
      expect(toIsoDate(d)).toBe('2026-09-10');
    });

    it('preserves date at 23:30 without advancing to the next day', () => {
      const lateNight = new Date(2026, 8, 10, 23, 30, 0);
      expect(toIsoDate(lateNight)).toBe('2026-09-10');
      expect(formatDate(lateNight)).toBe('10/09/2026');
      expect(formatDateTime(lateNight)).toBe('10/09/2026 23:30');
    });

    it('preserves date at 00:05 without rolling back to the previous day', () => {
      const earlyMorning = new Date(2026, 8, 10, 0, 5, 0);
      expect(toIsoDate(earlyMorning)).toBe('2026-09-10');
      expect(formatDate(earlyMorning)).toBe('10/09/2026');
      expect(formatDateTime(earlyMorning)).toBe('10/09/2026 00:05');
    });
  });

  describe('formatDate', () => {
    it('formats Date instance to DD/MM/AAAA', () => {
      const d = new Date(2026, 8, 10);
      expect(formatDate(d)).toBe('10/09/2026');
    });

    it('formats ISO date-only string to DD/MM/AAAA', () => {
      expect(formatDate('2026-09-10')).toBe('10/09/2026');
    });

    it('formats end of month correctly', () => {
      expect(formatDate('2026-01-31')).toBe('31/01/2026');
    });

    it('formats leap year day 29/02/2024 correctly', () => {
      expect(formatDate('2024-02-29')).toBe('29/02/2024');
    });

    it('formats year boundary / virada de ano correctly', () => {
      expect(formatDate('2026-12-31')).toBe('31/12/2026');
      expect(formatDate('2027-01-01')).toBe('01/01/2027');
    });

    it('returns empty string for null, undefined or empty input', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('')).toBe('');
    });

    it('keeps already formatted DD/MM/AAAA unchanged', () => {
      expect(formatDate('10/09/2026')).toBe('10/09/2026');
    });
  });

  describe('formatDateDayMonth', () => {
    it('formats date as DD/MM', () => {
      expect(formatDateDayMonth('2026-09-10')).toBe('10/09');
      expect(formatDateDayMonth(new Date(2026, 8, 10))).toBe('10/09');
    });

    it('returns empty string for falsy input', () => {
      expect(formatDateDayMonth(null)).toBe('');
      expect(formatDateDayMonth('')).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time in 24-hour clock DD/MM/AAAA HH:mm', () => {
      const d = new Date(2026, 8, 10, 14, 5, 0);
      expect(formatDateTime(d)).toBe('10/09/2026 14:05');
    });

    it('supports withAt option for "DD/MM/AAAA às HH:mm"', () => {
      const d = new Date(2026, 8, 10, 9, 30, 0);
      expect(formatDateTime(d, { withAt: true })).toBe('10/09/2026 às 09:30');
    });

    it('returns empty string for null or undefined', () => {
      expect(formatDateTime(null)).toBe('');
      expect(formatDateTime(undefined)).toBe('');
    });
  });

  describe('formatMonthYear', () => {
    it('formats month and year in lowercase pt-BR', () => {
      expect(formatMonthYear(9, 2026)).toBe('setembro de 2026');
      expect(formatMonthYear(1, 2026)).toBe('janeiro de 2026');
      expect(formatMonthYear(12, 2026)).toBe('dezembro de 2026');
    });
  });

  describe('formatRelativeDay', () => {
    it('returns "Hoje" for current date', () => {
      const ref = new Date(2026, 8, 10, 15, 0, 0);
      const target = new Date(2026, 8, 10, 9, 30, 0);
      expect(formatRelativeDay(target, ref)).toBe('Hoje');
      expect(formatRelativeDay('2026-09-10', ref)).toBe('Hoje');
    });

    it('returns "Ontem" for previous date', () => {
      const ref = new Date(2026, 8, 10, 15, 0, 0);
      const target = new Date(2026, 8, 9, 23, 0, 0);
      expect(formatRelativeDay(target, ref)).toBe('Ontem');
      expect(formatRelativeDay('2026-09-09', ref)).toBe('Ontem');
    });

    it('returns full formatted date for older dates', () => {
      const ref = new Date(2026, 8, 10, 15, 0, 0);
      expect(formatRelativeDay('2026-09-08', ref)).toBe('08/09/2026');
      expect(formatRelativeDay('2026-09-11', ref)).toBe('11/09/2026');
    });
  });

  describe('parseBrDate', () => {
    it('parses valid Brazilian date into ISO date string', () => {
      const result = parseBrDate('10/09/2026');
      expect(result).toEqual({ valid: true, isoDate: '2026-09-10' });
    });

    it('accepts leap year February 29 on valid leap year', () => {
      const result = parseBrDate('29/02/2024');
      expect(result).toEqual({ valid: true, isoDate: '2024-02-29' });
    });

    it('rejects leap year February 29 on non-leap year', () => {
      const result = parseBrDate('29/02/2025');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Dia inválido para o mês 02');
    });

    it('rejects day 31 in months with 30 days', () => {
      const april = parseBrDate('31/04/2026');
      expect(april.valid).toBe(false);
      expect(april.error).toContain('máximo: 30');

      const june = parseBrDate('31/06/2026');
      expect(june.valid).toBe(false);

      const september = parseBrDate('31/09/2026');
      expect(september.valid).toBe(false);

      const november = parseBrDate('31/11/2026');
      expect(november.valid).toBe(false);
    });

    it('rejects out of bounds day', () => {
      const resultZero = parseBrDate('00/05/2026');
      expect(resultZero.valid).toBe(false);

      const resultHigh = parseBrDate('32/01/2026');
      expect(resultHigh.valid).toBe(false);
    });

    it('rejects out of bounds month', () => {
      const monthZero = parseBrDate('15/00/2026');
      expect(monthZero.valid).toBe(false);
      expect(monthZero.error).toContain('Mês inválido');

      const month13 = parseBrDate('15/13/2026');
      expect(month13.valid).toBe(false);
      expect(month13.error).toContain('Mês inválido');
    });

    it('rejects out of bounds year', () => {
      const yearOld = parseBrDate('15/05/1850');
      expect(yearOld.valid).toBe(false);
      expect(yearOld.error).toContain('Ano deve estar entre 1900 e 2100');

      const yearFuture = parseBrDate('15/05/2150');
      expect(yearFuture.valid).toBe(false);
    });

    it('rejects malformed date strings', () => {
      expect(parseBrDate('2026-09-10').valid).toBe(false);
      expect(parseBrDate('10-09-2026').valid).toBe(false);
      expect(parseBrDate('invalido').valid).toBe(false);
      expect(parseBrDate('1/9/2026').valid).toBe(false);
    });
  });

  describe('formatDateInputMask', () => {
    it('applies DD/MM/AAAA mask incrementally as user types digits', () => {
      expect(formatDateInputMask('1')).toBe('1');
      expect(formatDateInputMask('10')).toBe('10');
      expect(formatDateInputMask('100')).toBe('10/0');
      expect(formatDateInputMask('1009')).toBe('10/09');
      expect(formatDateInputMask('10092')).toBe('10/09/2');
      expect(formatDateInputMask('10092026')).toBe('10/09/2026');
    });

    it('strips non-digits and truncates at 8 digits', () => {
      expect(formatDateInputMask('10/09/2026 extra')).toBe('10/09/2026');
      expect(formatDateInputMask('1009202699999')).toBe('10/09/2026');
    });
  });

  describe('formatPercent', () => {
    it('formats percentages with Brazilian comma separator', () => {
      expect(formatPercent(12.5)).toBe('12,5%');
      expect(formatPercent(80, 0)).toBe('80%');
      expect(formatPercent(99.99, 2)).toBe('99,99%');
    });
  });

  describe('formatCurrencyBRL', () => {
    it('formats positive values deterministically with thousand dots and decimal comma', () => {
      expect(formatCurrencyBRL(1234.56)).toBe('R$ 1.234,56');
      expect(formatCurrencyBRL(0)).toBe('R$ 0,00');
      expect(formatCurrencyBRL(1000000)).toBe('R$ 1.000.000,00');
    });

    it('formats negative values deterministically', () => {
      expect(formatCurrencyBRL(-50.2)).toBe('-R$ 50,20');
      expect(formatCurrencyBRL(-1234.56)).toBe('-R$ 1.234,56');
    });
  });

  describe('EventsScreen Date Validation & Display (US35)', () => {
    it('validates Brazilian start and end dates and prevents end date before start date', () => {
      const startInput = '10/09/2026';
      const endInputEarlier = '05/09/2026';
      const endInputValid = '20/09/2026';

      const parsedStart = parseBrDate(startInput);
      const parsedEndEarlier = parseBrDate(endInputEarlier);
      const parsedEndValid = parseBrDate(endInputValid);

      expect(parsedStart.valid).toBe(true);
      expect(parsedEndEarlier.valid).toBe(true);
      expect(parsedEndValid.valid).toBe(true);

      expect(parsedEndEarlier.isoDate! < parsedStart.isoDate!).toBe(true);
      expect(parsedEndValid.isoDate! >= parsedStart.isoDate!).toBe(true);
    });

    it('formats stored ISO event dates back to Brazilian DD/MM/AAAA display format', () => {
      const storedEvent = {
        start_date: '2026-09-10',
        end_date: '2026-09-20',
      };

      const startDisplay = formatDate(storedEvent.start_date);
      const endDisplay = formatDate(storedEvent.end_date);

      expect(startDisplay).toBe('10/09/2026');
      expect(endDisplay).toBe('20/09/2026');
      expect(`${startDisplay} até ${endDisplay}`).toBe('10/09/2026 até 20/09/2026');
    });
  });

  describe('getNextOccurrenceForDay', () => {
    it('returns day in current month when reference date is earlier than day', () => {
      const ref = new Date(2026, 10, 8);
      expect(getNextOccurrenceForDay(17, ref)).toBe('17/11/2026');
    });

    it('returns day in next month when reference date is past day', () => {
      const ref = new Date(2026, 10, 8);
      expect(getNextOccurrenceForDay(5, ref)).toBe('05/12/2026');
    });

    it('returns same day when reference date is exactly on that day', () => {
      const ref = new Date(2026, 10, 10);
      expect(getNextOccurrenceForDay(10, ref)).toBe('10/11/2026');
    });

    it('clamps to last day of February on non-leap year (28/02)', () => {
      const ref = new Date(2026, 1, 15);
      expect(getNextOccurrenceForDay(31, ref)).toBe('28/02/2026');
    });

    it('clamps to last day of February on leap year (29/02)', () => {
      const ref = new Date(2024, 1, 15);
      expect(getNextOccurrenceForDay(31, ref)).toBe('29/02/2024');
    });

    it('advances across year boundary from December to January', () => {
      const ref = new Date(2026, 11, 20);
      expect(getNextOccurrenceForDay(10, ref)).toBe('10/01/2027');
    });
  });

  describe('extractDayFromBrDate', () => {
    it('extracts day number from valid DD/MM/AAAA string', () => {
      expect(extractDayFromBrDate('17/11/2026')).toBe(17);
      expect(extractDayFromBrDate('05/12/2026')).toBe(5);
    });

    it('returns null for invalid dates', () => {
      expect(extractDayFromBrDate('31/02/2026')).toBeNull();
      expect(extractDayFromBrDate('invalido')).toBeNull();
    });
  });

  describe('Credit Card Cycle Calculation (US29)', () => {
    it('returns cycle 11/10/2026 to 10/11/2026 for reference 08/11/2026 and closing 10', () => {
      const result = calculateCardInvoiceCycle({
        creditLimit: 7000,
        closingDay: 10,
        dueDay: 17,
        transactions: [],
        referenceDateIso: '2026-11-08T12:00:00',
      });
      expect(formatDate(result.cycleStartDate)).toBe('11/10/2026');
      expect(formatDate(result.cycleEndDate)).toBe('10/11/2026');
      expect(formatDate(result.dueDate)).toBe('17/11/2026');
    });

    it('returns cycle 11/10/2026 to 10/11/2026 for reference 10/11/2026 (inclusive closing)', () => {
      const result = calculateCardInvoiceCycle({
        creditLimit: 7000,
        closingDay: 10,
        dueDay: 17,
        transactions: [],
        referenceDateIso: '2026-11-10T23:59:00',
      });
      expect(formatDate(result.cycleStartDate)).toBe('11/10/2026');
      expect(formatDate(result.cycleEndDate)).toBe('10/11/2026');
    });

    it('returns cycle 11/11/2026 to 10/12/2026 for reference 11/11/2026 and closing 10', () => {
      const result = calculateCardInvoiceCycle({
        creditLimit: 7000,
        closingDay: 10,
        dueDay: 17,
        transactions: [],
        referenceDateIso: '2026-11-11T00:01:00',
      });
      expect(formatDate(result.cycleStartDate)).toBe('11/11/2026');
      expect(formatDate(result.cycleEndDate)).toBe('10/12/2026');
    });

    it('handles year boundary on 05/01/2027 returning cycle 11/12/2026 to 10/01/2027', () => {
      const result = calculateCardInvoiceCycle({
        creditLimit: 7000,
        closingDay: 10,
        dueDay: 17,
        transactions: [],
        referenceDateIso: '2027-01-05T12:00:00',
      });
      expect(formatDate(result.cycleStartDate)).toBe('11/12/2026');
      expect(formatDate(result.cycleEndDate)).toBe('10/01/2027');
      expect(formatDate(result.dueDate)).toBe('17/01/2027');
    });

    it('clamps closing day 31 in February to the last day of the month', () => {
      const resultNonLeap = calculateCardInvoiceCycle({
        creditLimit: 5000,
        closingDay: 31,
        dueDay: 10,
        transactions: [],
        referenceDateIso: '2026-02-15T12:00:00',
      });
      expect(formatDate(resultNonLeap.cycleEndDate)).toBe('28/02/2026');

      const resultLeap = calculateCardInvoiceCycle({
        creditLimit: 5000,
        closingDay: 31,
        dueDay: 10,
        transactions: [],
        referenceDateIso: '2024-02-15T12:00:00',
      });
      expect(formatDate(resultLeap.cycleEndDate)).toBe('29/02/2024');
    });

    it('ensures due date is strictly posterior to closing date', () => {
      const sameDayDue = calculateCardInvoiceCycle({
        creditLimit: 5000,
        closingDay: 10,
        dueDay: 10,
        transactions: [],
        referenceDateIso: '2026-11-08T12:00:00',
      });
      expect(formatDate(sameDayDue.dueDate)).toBe('10/12/2026');

      const earlierDue = calculateCardInvoiceCycle({
        creditLimit: 5000,
        closingDay: 20,
        dueDay: 5,
        transactions: [],
        referenceDateIso: '2026-11-08T12:00:00',
      });
      expect(formatDate(earlierDue.dueDate)).toBe('05/12/2026');

      const laterDue = calculateCardInvoiceCycle({
        creditLimit: 5000,
        closingDay: 10,
        dueDay: 17,
        transactions: [],
        referenceDateIso: '2026-11-08T12:00:00',
      });
      expect(formatDate(laterDue.dueDate)).toBe('17/11/2026');
    });

    it('includes purchase on closing day in closing invoice and purchase on day after in next invoice', () => {
      const closingDayPurchase: Transaction = {
        id: 't-close',
        account_id: 'card-1',
        category_id: 'cat-1',
        value: 100,
        type: 'despesa',
        description: 'Compra no dia do fechamento',
        date: '2026-11-10T15:00:00',
        tags: [],
        status: 'confirmada',
        is_recurring: false,
        created_at: '',
        updated_at: '',
      };

      const nextDayPurchase: Transaction = {
        id: 't-next',
        account_id: 'card-1',
        category_id: 'cat-1',
        value: 200,
        type: 'despesa',
        description: 'Compra no dia seguinte',
        date: '2026-11-11T10:00:00',
        tags: [],
        status: 'confirmada',
        is_recurring: false,
        created_at: '',
        updated_at: '',
      };

      const resultClosingCycle = calculateCardInvoiceCycle({
        creditLimit: 5000,
        closingDay: 10,
        dueDay: 17,
        transactions: [closingDayPurchase, nextDayPurchase],
        referenceDateIso: '2026-11-10T18:00:00',
      });
      expect(resultClosingCycle.currentInvoiceAmount).toBe(100);

      const resultNextCycle = calculateCardInvoiceCycle({
        creditLimit: 5000,
        closingDay: 10,
        dueDay: 17,
        transactions: [closingDayPurchase, nextDayPurchase],
        referenceDateIso: '2026-11-11T09:00:00',
      });
      expect(resultNextCycle.currentInvoiceAmount).toBe(200);
    });

    it('calculates Nubank invoice with 4 transactions summing R$ 299,53 and excludes future installments', () => {
      const nubankTransactions: Transaction[] = [
        {
          id: 'n-1',
          account_id: 'nubank',
          category_id: 'lazer',
          value: 58.0,
          type: 'despesa',
          description: 'Cinema',
          date: '2026-11-05T20:00:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'n-2',
          account_id: 'nubank',
          category_id: 'mercado',
          value: 185.4,
          type: 'despesa',
          description: 'Supermercado',
          date: '2026-11-06T14:30:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'n-3',
          account_id: 'nubank',
          category_id: 'transporte',
          value: 22.8,
          type: 'despesa',
          description: 'Transporte',
          date: '2026-11-07T08:15:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'n-4',
          account_id: 'nubank',
          category_id: 'compras',
          value: 33.33,
          type: 'despesa',
          description: 'Tênis Esportivo (1/3)',
          date: '2026-11-08T11:00:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          installment_group_id: 'grp-tenis',
          installment_number: 1,
          installment_total: 3,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'n-5',
          account_id: 'nubank',
          category_id: 'compras',
          value: 33.33,
          type: 'despesa',
          description: 'Tênis Esportivo (2/3)',
          date: '2026-12-08T11:00:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          installment_group_id: 'grp-tenis',
          installment_number: 2,
          installment_total: 3,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'n-6',
          account_id: 'nubank',
          category_id: 'compras',
          value: 33.34,
          type: 'despesa',
          description: 'Tênis Esportivo (3/3)',
          date: '2027-01-08T11:00:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          installment_group_id: 'grp-tenis',
          installment_number: 3,
          installment_total: 3,
          created_at: '',
          updated_at: '',
        },
      ];

      const result = calculateCardInvoiceCycle({
        creditLimit: 7000.0,
        closingDay: 10,
        dueDay: 17,
        transactions: nubankTransactions,
        referenceDateIso: '2026-11-08T12:00:00',
      });

      expect(formatDate(result.cycleStartDate)).toBe('11/10/2026');
      expect(formatDate(result.cycleEndDate)).toBe('10/11/2026');
      expect(formatDate(result.dueDate)).toBe('17/11/2026');
      expect(result.currentInvoiceAmount).toBe(299.53);
      expect(result.usedLimit).toBe(366.2);
      expect(result.availableLimit).toBe(6633.8);
    });

    it('deducts all unquittled card expenses including future installments from available limit', () => {
      const priorConfirmedExpenses: Transaction[] = [
        {
          id: 'seed-1',
          account_id: 'nubank',
          category_id: 'cat',
          value: 1399.2,
          type: 'despesa',
          description: 'Gastos anteriores',
          date: '2026-10-01T10:00:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'seed-2',
          account_id: 'nubank',
          category_id: 'cat',
          value: 100.0,
          type: 'despesa',
          description: 'Total das 3 parcelas do tênis',
          date: '2026-11-08T10:00:00',
          tags: [],
          status: 'confirmada',
          is_recurring: false,
          created_at: '',
          updated_at: '',
        },
      ];

      const result = calculateCardInvoiceCycle({
        creditLimit: 7000.0,
        closingDay: 10,
        dueDay: 17,
        transactions: priorConfirmedExpenses,
        referenceDateIso: '2026-11-08T12:00:00',
      });

      expect(result.usedLimit).toBe(1499.2);
      expect(result.availableLimit).toBe(5500.8);
    });
  });
});
