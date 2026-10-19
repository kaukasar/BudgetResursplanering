import { isInPeriod, type MonthFilter } from '../../domain/period';

/**
 * Klassnamn för en månadscell. Månader utanför vald period får `outside-period` och visas gråa,
 * eftersom de inte ingår i summorna.
 */
export const monthClass = (month: number, period: MonthFilter, className = '') =>
  [className, !isInPeriod(month, period) && 'outside-period'].filter(Boolean).join(' ') || undefined;
