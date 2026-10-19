import { MONTHS_LONG } from './types';

/** Värdet för "alla månader" i månadsväljaren. */
export const ALL_MONTHS = null;

/**
 * Den period i valt år som arbetsläget summerar: en månad (0 = januari … 11 = december) eller hela
 * året. Tabellerna visar alltid alla tolv månader, men summor och nyckeltal avser bara perioden.
 */
export type MonthFilter = number | typeof ALL_MONTHS;

export const isMonthFilter = (value: unknown): value is MonthFilter =>
  value === ALL_MONTHS || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 11);

/** Om månaden ingår i perioden. Med alla månader valda ingår alla. */
export const isInPeriod = (month: number, period: MonthFilter) => period === ALL_MONTHS || month === period;

/** Antal månader i perioden: 12 för hela året, annars 1. */
export const monthsInPeriod = (period: MonthFilter) => (period === ALL_MONTHS ? 12 : 1);

/** Summan av värdena för periodens månader. Värden som saknas (`null`) räknas som 0. */
export const sumInPeriod = (values: readonly (number | null)[], period: MonthFilter) =>
  values.reduce<number>((total, value, month) => (isInPeriod(month, period) ? total + (value ?? 0) : total), 0);

/** Behåller bara markeringarna för periodens månader, t.ex. överallokering. */
export const flagsInPeriod = (flags: readonly boolean[], period: MonthFilter) =>
  flags.map((flag, month) => flag && isInPeriod(month, period));

/** Perioden i text, t.ex. "2026" eller "mars 2026". */
export const periodLabel = (year: number, period: MonthFilter) =>
  period === ALL_MONTHS ? String(year) : `${MONTHS_LONG[period]} ${year}`;
