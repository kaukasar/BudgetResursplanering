// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { calculateBudgetStatus } from './budget';
import {
  getMonthActuals,
  getMonthValues,
  hoursLostByUpdate,
  personCapacity,
  storedHoursForInitiative,
  summarizeInitiative,
} from './calc';
import { calculateDeviation } from './comparison';
import * as ops from './operations';
import { parseAppData } from './serialization';
import type { AppData, Measure } from './types';

describe('utfall', () => {
  it('kan bara rapporteras för kopplade personer och initiativets år', () => {
    const d = domainFixture();
    expect(() => ops.setActual(d, 'i2', 'kalle', 2026, 0, 5)).toThrow(/inte kopplad/);
    expect(() => ops.setActual(d, 'i1', 'anna', 2027, 0, 5)).toThrow(/gäller inte 2027/);
    expect(() => ops.setActual(d, 'i1', 'anna', 2026, 0, -1)).toThrow(ops.DomainError);
  });

  it('skiljer på "inte rapporterat" (null) och rapporterade 0 h', () => {
    let d = domainFixture();
    expect(getMonthActuals(d, 'i1', 'anna', 2026)[0]).toBeNull();
    d = ops.setActual(d, 'i1', 'anna', 2026, 0, 0);
    expect(getMonthActuals(d, 'i1', 'anna', 2026)[0]).toBe(0);
    d = ops.setActual(d, 'i1', 'anna', 2026, 0, null);
    expect(getMonthActuals(d, 'i1', 'anna', 2026)[0]).toBeNull();
  });

  it('estimat och utfall är oberoende mått', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 100);
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 1, 100);
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 2, 100);
    d = ops.setActual(d, 'i1', 'anna', 2026, 0, 80);
    d = ops.setActual(d, 'i1', 'anna', 2026, 1, 0);
    const values = (m: Measure) => getMonthValues(d, 'i1', 'anna', 2026, m).slice(0, 3);
    expect(values('estimate')).toEqual([100, 100, 100]);
    expect(values('actual')).toEqual([80, 0, 0]);
    expect(summarizeInitiative(d, d.initiatives[0]!, 2026, 'estimate').totalCost).toBe(300 * 650);
    expect(summarizeInitiative(d, d.initiatives[0]!, 2026, 'actual').totalCost).toBe(80 * 650);
  });

  it('prognosen (estimerad kostnad) påverkas aldrig av utfall', () => {
    let d = ops.updateInitiative(domainFixture(), 'i1', { budget: 200_000 });
    d = ops.updateInitiative(d, 'i2', { budget: 50_000 });
    for (let m = 0; m < 12; m++) {
      d = ops.setEstimate(d, 'i1', 'anna', 2026, m, 10 + m);
      d = ops.setEstimate(d, 'i1', 'kalle', 2026, m, 5);
      d = ops.setEstimate(d, 'i2', 'anna', 2027, m, 3);
    }
    const snapshot = (x: AppData) => ({
      budgets: x.initiatives.map((i) => {
        const b = calculateBudgetStatus(x, i)!;
        return [b.plannedCost, b.plannedPercent, b.overBudget];
      }),
      estimateCost: x.initiatives.map((i) => i.years.map((y) => summarizeInitiative(x, i, y, 'estimate').totalCost)),
      capacity: x.people.map((p) => personCapacity(x, p, 2026, 'estimate').monthTotals),
    });
    const before = snapshot(d);

    // Deterministisk "slumpföljd" av utfall: över, under, 0, borttaget, långt över budget.
    const values = [0, 7.5, 300, null, 1, 999, null, 42];
    let step = 0;
    for (const [iid, pid, year] of [
      ['i1', 'anna', 2026],
      ['i1', 'kalle', 2026],
      ['i2', 'anna', 2027],
    ] as const) {
      for (let m = 0; m < 12; m++) {
        d = ops.setActual(d, iid, pid, year, m, values[step++ % values.length]!);
        expect(snapshot(d)).toEqual(before);
      }
    }
    // Utfallet självt har däremot ändrats – och kan överstiga budgeten utan att prognosen gör det.
    const b = calculateBudgetStatus(d, d.initiatives[0]!)!;
    expect(b.actualCost).toBeGreaterThan(b.budget);
    expect(b.overBudget).toBe(false);
    d = ops.fillActualsFromEstimate(d, 'i1', 'anna', 2026, 11);
    expect(snapshot(d)).toEqual(before);
  });

  it('avvikelse räknas bara på månader med rapporterat utfall', () => {
    const dev = calculateDeviation([100, 100, 100], [80, 110, null]);
    expect(dev).toEqual({ estimate: 200, actual: 190, diff: -10, percent: -5, reportedMonths: 2 });
    expect(calculateDeviation([0, 0], [5, null]).percent).toBeNull();
  });

  it('överallokering kan beräknas på utfall', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 100);
    d = ops.setActual(d, 'i1', 'anna', 2026, 0, 100);
    d = ops.setActual(d, 'i2', 'anna', 2026, 0, 70); // 170 h faktisk tid, 100 h planerat
    const anna = d.people[0]!;
    expect(personCapacity(d, anna, 2026, 'estimate').overallocated[0]).toBe(false);
    expect(personCapacity(d, anna, 2026, 'actual').overallocated[0]).toBe(true);
  });

  it('budget visar prognos (estimat) och utfall över initiativets alla år', () => {
    let d = ops.updateInitiative(domainFixture(), 'i2', { budget: 100_000 });
    d = ops.setEstimate(d, 'i2', 'anna', 2026, 0, 40); // 26 000
    d = ops.setEstimate(d, 'i2', 'anna', 2027, 0, 60); // 39 000
    d = ops.setActual(d, 'i2', 'anna', 2026, 0, 80); // 52 000
    expect(calculateBudgetStatus(d, d.initiatives[1]!)).toEqual({
      budget: 100_000,
      plannedCost: 65_000, // prognos = estimat för båda åren
      plannedPercent: 65,
      overBudget: false,
      actualCost: 52_000,
      actualPercent: 52,
      actualOverBudget: false,
    });
  });

  it('utfallet räknas som över budget från 101 % (avrundat som i gränssnittet), oberoende av prognosen', () => {
    // Kalle kostar 1 000 kr/h och budgeten är 100 000 kr, så 1 h = 1 %.
    let d = ops.updateInitiative(domainFixture(), 'i1', { budget: 100_000 });
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 200); // prognos 200 % – över budget
    const status = (hours: number) =>
      calculateBudgetStatus(ops.setActual(d, 'i1', 'kalle', 2026, 0, hours), d.initiatives[0]!)!;

    expect(status(50)).toMatchObject({ actualPercent: 50, actualOverBudget: false, overBudget: true });
    expect(status(100).actualOverBudget).toBe(false);
    expect(status(100.4).actualOverBudget).toBe(false); // visas som "100 %"
    expect(status(100.6).actualOverBudget).toBe(true); // visas som "101 %"
    expect(status(101).actualOverBudget).toBe(true);
    expect(status(250).actualOverBudget).toBe(true);
  });

  it('"fyll från estimat" fyller bara tomma månader t.o.m. angiven månad', () => {
    let d = domainFixture();
    [10, 20, 30, 40].forEach((h, m) => (d = ops.setEstimate(d, 'i1', 'anna', 2026, m, h)));
    d = ops.setActual(d, 'i1', 'anna', 2026, 1, 25);
    d = ops.fillActualsFromEstimate(d, 'i1', 'anna', 2026, 2);
    expect(getMonthActuals(d, 'i1', 'anna', 2026).slice(0, 4)).toEqual([10, 25, 30, null]);
  });

  it('raderas tillsammans med personen, initiativet, eller när personen/året tas bort', () => {
    let d = domainFixture();
    d = ops.setActual(d, 'i1', 'anna', 2026, 0, 10);
    d = ops.setActual(d, 'i1', 'kalle', 2026, 0, 5);
    d = ops.setActual(d, 'i2', 'anna', 2027, 0, 7);

    expect(hoursLostByUpdate(d, d.initiatives[0]!, { personIds: ['anna'], years: [2026] }).people).toEqual([
      { personId: 'kalle', estimate: 0, actual: 5 },
    ]);
    expect(storedHoursForInitiative(ops.updateInitiative(d, 'i1', { personIds: ['anna'] }), 'i1', 'actual')).toBe(10);
    expect(storedHoursForInitiative(ops.updateInitiative(d, 'i2', { years: [2026] }), 'i2', 'actual')).toBe(0);
    expect(storedHoursForInitiative(ops.deletePerson(d, 'anna'), 'i1', 'actual')).toBe(5);
    expect(ops.deleteInitiative(d, 'i1').actuals.i1).toBeUndefined();
  });

  it('sparas och läses in via JSON; äldre data utan utfall får tomt utfall', () => {
    let d = domainFixture();
    d = ops.setActual(d, 'i1', 'anna', 2026, 0, 0);
    d = ops.setActual(d, 'i1', 'anna', 2026, 1, 7.5);
    expect(parseAppData(JSON.parse(JSON.stringify(d)))).toEqual(d);

    const { actuals: _a, ...old } = d;
    expect(parseAppData(old).actuals).toEqual({});
    const broken = { ...d, actuals: { i1: { anna: { 2026: [-1, ...Array<null>(11).fill(null)] } } } };
    expect(() => parseAppData(broken)).toThrow(/utfall/);
  });
});
