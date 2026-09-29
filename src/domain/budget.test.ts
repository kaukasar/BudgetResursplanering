// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { calculateBudgetStatus } from './budget';
import * as ops from './operations';
import { parseAppData } from './serialization';

describe('budget', () => {
  it('är frivillig och måste vara större än 0 om den anges', () => {
    const d = domainFixture();
    expect(d.initiatives[0]!.budget).toBeNull();
    expect(() => ops.updateInitiative(d, 'i1', { budget: 0 })).toThrow(/större än 0/);
    expect(() => ops.updateInitiative(d, 'i1', { budget: -100 })).toThrow(/större än 0/);
    expect(ops.updateInitiative(d, 'i1', { budget: 50_000 }).initiatives[0]!.budget).toBe(50_000);
    // Budgeten kan tas bort igen, och lämnas orörd när andra fält ändras.
    const withBudget = ops.updateInitiative(d, 'i1', { budget: 50_000 });
    expect(ops.updateInitiative(withBudget, 'i1', { name: 'Nytt namn' }).initiatives[0]!.budget).toBe(50_000);
    expect(ops.updateInitiative(withBudget, 'i1', { budget: null }).initiatives[0]!.budget).toBeNull();
  });

  it('räknar förbrukad andel av planerad kostnad över initiativets alla år', () => {
    let d = ops.updateInitiative(domainFixture(), 'i2', { budget: 100_000 });
    expect(calculateBudgetStatus(d, d.initiatives[0]!)).toBeNull(); // i1 saknar budget

    d = ops.setEstimate(d, 'i2', 'anna', 2026, 0, 40); // 40 × 650 = 26 000
    d = ops.setEstimate(d, 'i2', 'anna', 2027, 0, 60); // 60 × 650 = 39 000
    expect(calculateBudgetStatus(d, d.initiatives[1]!)).toMatchObject({
      budget: 100_000,
      plannedCost: 65_000,
      plannedPercent: 65,
      overBudget: false,
    });

    d = ops.setEstimate(d, 'i2', 'anna', 2027, 1, 60); // + 39 000 = 104 000
    expect(calculateBudgetStatus(d, d.initiatives[1]!)).toMatchObject({ plannedPercent: 104, overBudget: true });
  });

  it('påverkas av personalens timkostnad', () => {
    let d = ops.updateInitiative(domainFixture(), 'i1', { budget: 10_000 });
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 5); // 5 × 1000
    expect(calculateBudgetStatus(d, d.initiatives[0]!)!.plannedPercent).toBe(50);
    d = ops.updatePerson(d, 'kalle', { hourlyRate: 1500 });
    expect(calculateBudgetStatus(d, d.initiatives[0]!)!.plannedPercent).toBe(75);
  });

  it('data utan budget från äldre versioner läses in som "ingen budget"', () => {
    const d = domainFixture();
    const old = { ...d, initiatives: d.initiatives.map(({ budget: _b, ...rest }) => rest) };
    expect(parseAppData(old).initiatives.map((i) => i.budget)).toEqual([null, null]);
    const invalid = { ...d, initiatives: [{ ...d.initiatives[0]!, budget: -5 }] };
    expect(() => parseAppData(invalid)).toThrow(/ogiltig budget/);
  });
});
