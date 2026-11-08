export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const MONTH_NAMES_LOWER = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

export const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const WEEKDAY_NAMES_SHORT = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
] as const;

export function fromIsoDate(iso: string): Date {
  const trimmed = iso.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10) - 1;
    const day = parseInt(dateOnlyMatch[3], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  return new Date(trimmed);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const str = String(dateInput).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const parsed = fromIsoDate(str);
  if (isNaN(parsed.getTime())) return str;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateDayMonth(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const formatted = formatDate(dateInput);
  const parts = formatted.split('/');
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return formatted;
}

export function formatDateTime(
  dateInput: string | Date | null | undefined,
  options?: { withAt?: boolean }
): string {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : fromIsoDate(String(dateInput));
  if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : '';
  const datePart = formatDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const separator = options?.withAt ? ' às ' : ' ';
  return `${datePart}${separator}${hours}:${minutes}`;
}

export function formatMonthYear(month: number, year: number): string {
  const index = month - 1;
  if (index >= 0 && index < MONTH_NAMES_LOWER.length) {
    return `${MONTH_NAMES_LOWER[index]} de ${year}`;
  }
  return `${month}/${year}`;
}

export function formatRelativeDay(
  dateInput: string | Date,
  referenceDate: Date = new Date()
): string {
  const targetDate = dateInput instanceof Date ? dateInput : fromIsoDate(String(dateInput));
  if (isNaN(targetDate.getTime())) return typeof dateInput === 'string' ? dateInput : '';
  const targetIso = toIsoDate(targetDate);
  const refIso = toIsoDate(referenceDate);
  if (targetIso === refIso) {
    return 'Hoje';
  }
  const yesterday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - 1,
    12,
    0,
    0
  );
  if (targetIso === toIsoDate(yesterday)) {
    return 'Ontem';
  }
  return formatDate(targetDate);
}

export function parseBrDate(dateStr: string): { valid: boolean; isoDate?: string; error?: string } {
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return { valid: false, error: 'Data deve estar no formato DD/MM/AAAA' };
  }
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (year < 1900 || year > 2100) {
    return { valid: false, error: 'Ano deve estar entre 1900 e 2100' };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Mês inválido (deve ser entre 01 e 12)' };
  }

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonths[month - 1];

  if (day < 1 || day > maxDay) {
    return {
      valid: false,
      error: `Dia inválido para o mês ${String(month).padStart(2, '0')} (máximo: ${maxDay})`,
    };
  }

  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { valid: true, isoDate };
}

export function formatDateInputMask(rawText: string): string {
  const digits = rawText.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  const formatted = value.toFixed(decimals).replace('.', ',');
  return `${formatted}%`;
}

export function formatCurrencyBRL(value: number): string {
  const isNegative = value < 0;
  const abs = Math.abs(value);
  const parts = abs.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = parts[1];
  return `${isNegative ? '-' : ''}R$ ${intPart},${decPart}`;
}

export function getNextOccurrenceForDay(day: number, fromDate: Date = new Date()): string {
  const targetDay = Math.min(Math.max(1, Math.trunc(day || 1)), 31);
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth();
  const currentDay = fromDate.getDate();

  const maxDayCurrent = new Date(year, month + 1, 0).getDate();
  if (currentDay <= targetDay) {
    const clampedDay = Math.min(targetDay, maxDayCurrent);
    return formatDate(new Date(year, month, clampedDay));
  }

  const nextMonthZero = month + 1;
  const targetYear = nextMonthZero > 11 ? year + 1 : year;
  const targetMonth = nextMonthZero > 11 ? 0 : nextMonthZero;
  const maxDayNext = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(targetDay, maxDayNext);
  return formatDate(new Date(targetYear, targetMonth, clampedDay));
}

export function extractDayFromBrDate(brDate: string): number | null {
  const parsed = parseBrDate(brDate);
  if (!parsed.valid || !parsed.isoDate) return null;
  const parts = parsed.isoDate.split('-');
  return parseInt(parts[2], 10);
}
