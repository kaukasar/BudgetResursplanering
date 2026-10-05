// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { budgetStatuses, calculateBudgetStatus } from './budget';
import * as ops from './operations';
import { parseAppData } from './serialization';
import { EXTERNAL_STAFF_ID } from './types';

describe('budget', () => {
  it('intern och extern budget är frivilliga, oberoende och måste vara större än 0 om de anges', () => {
    const d = domainFixture();
    expect(d.initiatives[0]).toMatchObject({ internalBudget: null, externalBudget: null });
    expect(() => ops.updateInitiative(d, 'i1', { internalBudget: 0 })).toThrow(/Intern budget.*större än 0/);
    expect(() => ops.updateInitiative(d, 'i1', { externalBudget: -100 })).toThrow(/Extern budget.*större än 0/);

    const withBudgets = ops.updateInitiative(d, 'i1', { internalBudget: 50_000, externalBudget: 10_000 });
    expect(withBudgets.initiatives[0]).toMatchObject({ internalBudget: 50_000, externalBudget: 10_000 });
    // Budgetarna lämnas orörda när andra fält ändras, och kan tas bort var för sig.
    expect(ops.updateInitiative(withBudgets, 'i1', { name: 'Nytt namn' }).initiatives[0]).toMatchObject({
      internalBudget: 50_000,
      externalBudget: 10_000,
    });
    expect(ops.updateInitiative(withBudgets, 'i1', { externalBudget: null }).initiatives[0]).toMatchObject({
      internalBudget: 50_000,
      externalBudget: null,
    });
  });

  it('räknar förbrukad andel av planerad kostnad över initiativets alla år', () => {
    let d = ops.updateInitiative(domainFixture(), 'i2', { internalBudget: 100_000 });
    expect(budgetStatuses(d, d.initiatives[0]!)).toEqual([]); // i1 saknar budget

    d = ops.setEstimate(d, 'i2', 'anna', 2026, 0, 40); // 40 × 650 = 26 000
    d = ops.setEstimate(d, 'i2', 'anna', 2027, 0, 60); // 60 × 650 = 39 000
    expect(calculateBudgetStatus(d, d.initiatives[1]!, 'internal')).toMatchObject({
      part: 'internal',
      budget: 100_000,
      plannedCost: 65_000,
      plannedPercent: 65,
      overBudget: false,
    });

    d = ops.setEstimate(d, 'i2', 'anna', 2027, 1, 60); // + 39 000 = 104 000
    expect(calculateBudgetStatus(d, d.initiatives[1]!, 'internal')).toMatchObject({
      plannedPercent: 104,
      overBudget: true,
    });
  });

  it('den interna budgeten avser personal i sektionen och den externa Extern personal', () => {
    let d = ops.updateInitiative(domainFixture(), 'i1', {
      personIds: ['anna', 'kalle', EXTERNAL_STAFF_ID],
      internalBudget: 100_000,
      externalBudget: 10_000,
    });
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 40); // 40 × 650 = 26 000
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 20); // 20 × 1 000 = 20 000
    d = ops.setEstimate(d, 'i1', EXTERNAL_STAFF_ID, 2026, 0, 8); // 8 × 875 = 7 000
    d = ops.setActual(d, 'i1', EXTERNAL_STAFF_ID, 2026, 0, 12); // 12 × 875 = 10 500

    const [internal, external] = budgetStatuses(d, d.initiatives[0]!);
    expect(internal).toMatchObject({ part: 'internal', plannedCost: 46_000, plannedPercent: 46, actualCost: 0 });
    expect(external).toMatchObject({
      part: 'external',
      plannedCost: 7_000,
      plannedPercent: 70,
      actualCost: 10_500,
      actualOverBudget: true, // 105 %
    });
  });

  it('låst tid räknas mot den interna budgeten', () => {
    let d = ops.updateInitiative(domainFixture(), 'i1', { internalBudget: 100_000 });
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 40); // 26 000
    d = ops.deletePerson(d, 'anna');
    expect(calculateBudgetStatus(d, d.initiatives[0]!, 'internal')!.plannedCost).toBe(26_000);
  });

  it('påverkas av personalens timkostnad', () => {
    let d = ops.updateInitiative(domainFixture(), 'i1', { internalBudget: 10_000 });
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 5); // 5 × 1000
    expect(calculateBudgetStatus(d, d.initiatives[0]!, 'internal')!.plannedPercent).toBe(50);
    d = ops.updatePerson(d, 'kalle', { hourlyRate: 1500 });
    expect(calculateBudgetStatus(d, d.initiatives[0]!, 'internal')!.plannedPercent).toBe(75);
  });

  it('en budget från äldre versioner blir intern budget; data utan budget får ingen budget', () => {
    const d = domainFixture();
    const strip = ({ internalBudget: _i, externalBudget: _e, ...rest }: (typeof d.initiatives)[number]) => rest;
    const old = {
      ...d,
      initiatives: d.initiatives.map((i) => ({ ...strip(i), budget: i.id === 'i1' ? 80_000 : null })),
    };
    expect(parseAppData(old).initiatives.map((i) => [i.internalBudget, i.externalBudget])).toEqual([
      [80_000, null],
      [null, null],
    ]);
    const withoutBudget = { ...d, initiatives: d.initiatives.map(strip) };
    expect(parseAppData(withoutBudget).initiatives.map((i) => i.internalBudget)).toEqual([null, null]);

    const invalid = { ...d, initiatives: [{ ...d.initiatives[0]!, externalBudget: -5 }] };
    expect(() => parseAppData(invalid)).toThrow(/ogiltig extern budget/);
  });
});
