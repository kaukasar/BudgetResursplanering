// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { countOverallocatedMonths, personCapacity, summarizeInitiative } from './calc';
import { compareInitiative } from './comparison';
import * as ops from './operations';
import { ALL_MONTHS, flagsInPeriod, isMonthFilter, periodLabel, sumInPeriod } from './period';

const MARCH = 2;

describe('period: hela året eller en månad', () => {
  it('summerar bara periodens månader', () => {
    const values = [1, 2, 3, null, 5, 0, 0, 0, 0, 0, 0, 4];
    expect(sumInPeriod(values, ALL_MONTHS)).toBe(15);
    expect(sumInPeriod(values, MARCH)).toBe(3);
    expect(sumInPeriod(values, 3)).toBe(0); // inget värde räknas som 0
  });

  it('behåller bara markeringar i perioden och beskriver perioden i text', () => {
    const flags = [true, false, true, ...Array<boolean>(9).fill(false)];
    expect(flagsInPeriod(flags, MARCH)).toEqual([false, false, true, ...Array<boolean>(9).fill(false)]);
    expect(periodLabel(2026, ALL_MONTHS)).toBe('2026');
    expect(periodLabel(2026, MARCH)).toBe('mars 2026');
  });

  it('godtar bara alla månader eller en månad 0–11', () => {
    expect([ALL_MONTHS, 0, 11].every(isMonthFilter)).toBe(true);
    expect([-1, 12, 1.5, '3', undefined].some(isMonthFilter)).toBe(false);
  });
});

describe('summor för en vald månad', () => {
  // Anna (650 kr/h, 160 h/mån) och Kalle (1 000 kr/h, 100 h/mån) på Portal (i1) 2026.
  let data = domainFixture();
  data = ops.setEstimate(data, 'i1', 'anna', 2026, 0, 200);
  data = ops.setEstimate(data, 'i1', 'anna', 2026, MARCH, 40);
  data = ops.setEstimate(data, 'i1', 'kalle', 2026, MARCH, 10);
  data = ops.setActual(data, 'i1', 'anna', 2026, 0, 180);
  data = ops.setActual(data, 'i1', 'anna', 2026, MARCH, 50);
  const portal = data.initiatives.find((initiative) => initiative.id === 'i1')!;

  it('initiativets totaler avser bara månaden, men alla månader finns kvar i raderna', () => {
    const march = summarizeInitiative(data, portal, 2026, 'estimate', MARCH);
    expect([march.totalHours, march.totalCost]).toEqual([50, 40 * 650 + 10 * 1000]);
    expect(march.rows.find((row) => row.person.id === 'anna')?.totalHours).toBe(40);
    expect(march.monthTotals[0]).toBe(200);
    expect(summarizeInitiative(data, portal, 2026).totalHours).toBe(250);
  });

  it('avvikelsen och estimatet i jämförelsen avser bara månaden', () => {
    const march = compareInitiative(data, portal, 2026, MARCH);
    expect(march.estimateTotal).toBe(50);
    expect(march.deviation).toMatchObject({ estimate: 40, actual: 50, diff: 10, reportedMonths: 1 });
    expect(compareInitiative(data, portal, 2026).deviation).toMatchObject({ actual: 230, reportedMonths: 2 });
  });

  it('överallokerade månader räknas bara i perioden', () => {
    const anna = data.people.find((person) => person.id === 'anna')!;
    const capacity = personCapacity(data, anna, 2026);
    expect(countOverallocatedMonths(capacity)).toBe(1); // januari: 200 av 160 h
    expect(countOverallocatedMonths(capacity, MARCH)).toBe(0);
  });
});
