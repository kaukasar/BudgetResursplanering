// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import {
  countOverallocatedMonths,
  effectiveMonthlyHours,
  effectiveRate,
  filterInitiatives,
  lastCompletedMonth,
  personCapacity,
  summarizeInitiative,
  ALL_TAJMA_CLASSES,
  NO_TAJMA_CLASS,
  type TajmaClassFilter,
} from './calc';
import * as ops from './operations';
import { emptyData } from './types';

describe('ekonomiberäkning', () => {
  it('har förifyllda standardvärden: anställd 625 kr/h, konsult 1 130 kr/h, båda 160 h/mån', () => {
    expect(emptyData().settings).toEqual({
      employee: { hourlyRate: 625, monthlyHours: 160 },
      consultant: { hourlyRate: 1130, monthlyHours: 160 },
    });
  });

  it('ärver timkostnad och arbetstid från typen om personen saknar egna värden', () => {
    const d = domainFixture();
    const anna = d.people.find((p) => p.id === 'anna')!;
    const kalle = d.people.find((p) => p.id === 'kalle')!;
    expect(effectiveRate(anna, d.settings)).toBe(650);
    expect(effectiveMonthlyHours(anna, d.settings)).toBe(160);
    expect(effectiveRate(kalle, d.settings)).toBe(1000);
    expect(effectiveMonthlyHours(kalle, d.settings)).toBe(100);
  });

  it('ändrad global inställning slår igenom på personer utan egna värden', () => {
    const d = ops.updateTypeSettings(domainFixture(), 'employee', { hourlyRate: 700 });
    expect(effectiveRate(d.people[0]!, d.settings)).toBe(700);
  });

  it('summerar timmar och kostnad per person, månad och initiativ', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 1, 20);
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 5);
    const s = summarizeInitiative(d, d.initiatives[0]!, 2026);

    expect(s.rows.map((r) => [r.person.name, r.totalHours, r.totalCost])).toEqual([
      ['Anna', 30, 30 * 650],
      ['Kalle', 5, 5 * 1000],
    ]);
    expect(s.monthTotals.slice(0, 3)).toEqual([15, 20, 0]);
    expect(s.totalHours).toBe(35);
    expect(s.totalCost).toBe(30 * 650 + 5 * 1000);
  });

  it('håller isär timmar för olika år', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i2', 'anna', 2026, 5, 40);
    d = ops.setEstimate(d, 'i2', 'anna', 2027, 5, 80);
    expect(summarizeInitiative(d, d.initiatives[1]!, 2026).totalHours).toBe(40);
    expect(summarizeInitiative(d, d.initiatives[1]!, 2027).totalHours).toBe(80);
  });
});

describe('överallokering', () => {
  it('summerar en persons timmar över alla initiativ och flaggar månader över arbetstiden', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 2, 100);
    d = ops.setEstimate(d, 'i2', 'anna', 2026, 2, 60); // 160 = exakt normal arbetstid, ej över
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 3, 100);
    d = ops.setEstimate(d, 'i2', 'anna', 2026, 3, 61); // 161 > 160
    const anna = d.people[0]!;

    expect(personCapacity(d, anna, 2026).monthTotals.slice(2, 4)).toEqual([160, 161]);
    const flags = personCapacity(d, anna, 2026).overallocated;
    expect(flags[2]).toBe(false);
    expect(flags[3]).toBe(true);
    expect(flags.filter(Boolean)).toHaveLength(1);
  });

  it('använder personens egen arbetstid när den finns', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 101);
    expect(personCapacity(d, d.people[1]!, 2026).overallocated[0]).toBe(true);
  });

  it('räknar initiativ hos alla produktägare', () => {
    let d = domainFixture();
    d = ops.addInitiative(d, { id: 'i3', name: 'Annat', productOwnerId: 'po2', personIds: ['anna'], years: [2026] });
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 100);
    d = ops.setEstimate(d, 'i3', 'anna', 2026, 0, 100);
    expect(personCapacity(d, d.people[0]!, 2026).overallocated[0]).toBe(true);
  });
});

describe('kapacitet', () => {
  it('räknar total tid, normal arbetstid och överallokerade månader per person', () => {
    let data = domainFixture();
    data = ops.setEstimate(data, 'i1', 'kalle', 2026, 0, 60);
    data = ops.setEstimate(data, 'i1', 'kalle', 2026, 1, 101); // Kalle har 100 h/mån
    const capacity = personCapacity(data, data.people[1]!, 2026);
    expect(capacity.capacity).toBe(100);
    expect(capacity.monthTotals.slice(0, 3)).toEqual([60, 101, 0]);
    expect(capacity.overallocated.slice(0, 3)).toEqual([false, true, false]);
    expect(countOverallocatedMonths(capacity)).toBe(1);
  });
});

describe('filtrering av initiativ', () => {
  it('filtrerar på år, sektion och produktägare', () => {
    let data = domainFixture(); // Portal (Petra, 2026), App (Petra, 2026–2027); Olle saknar initiativ
    data = ops.addProductOwner(data, { id: 'po3', name: 'Stina', sectionId: 's2' });
    data = ops.addPerson(data, {
      id: 'bo',
      name: 'Bo',
      type: 'employee',
      sectionId: 's2',
      hourlyRate: null,
      monthlyHours: null,
    });
    data = ops.addInitiative(data, {
      id: 'i3',
      name: 'Lager',
      productOwnerId: 'po3',
      personIds: ['bo'],
      years: [2026],
    });
    const ids = (filter: { year: number; sectionId?: string; ownerId?: string }) =>
      filterInitiatives(data, { sectionId: '', ownerId: '', ...filter }).map((initiative) => initiative.id);

    expect(ids({ year: 2026 })).toEqual(['i1', 'i2', 'i3']);
    expect(ids({ year: 2027 })).toEqual(['i2']);
    expect(ids({ year: 2026, sectionId: 's2' })).toEqual(['i3']);
    expect(ids({ year: 2026, ownerId: 'po1' })).toEqual(['i1', 'i2']);
    expect(ids({ year: 2026, ownerId: 'po2' })).toEqual([]);
  });

  it('filtrerar på tajmaklass, även initiativ utan tajmaklass, och kombinerat med övriga filter', () => {
    let data = domainFixture(); // Portal (i1, 2026), App (i2, 2026–2027)
    data = ops.updateInitiative(data, 'i1', { tajmaClass: 'IMM' });
    const ids = (tajmaClass: TajmaClassFilter, year = 2026) =>
      filterInitiatives(data, { year, sectionId: '', ownerId: '', tajmaClass }).map((initiative) => initiative.id);

    expect(ids(ALL_TAJMA_CLASSES)).toEqual(['i1', 'i2']);
    expect(ids('IMM')).toEqual(['i1']);
    expect(ids('Drift')).toEqual([]);
    expect(ids(NO_TAJMA_CLASS)).toEqual(['i2']);
    expect(ids('IMM', 2027)).toEqual([]); // Portal gäller inte 2027
  });
});

describe('sista avslutade månad', () => {
  it('är föregående månad under innevarande år', () => {
    expect(lastCompletedMonth(2026, new Date(2026, 3, 15))).toBe(2); // april → mars
    expect(lastCompletedMonth(2026, new Date(2026, 0, 31))).toBe(-1); // januari → ingen
  });

  it('är december för passerade år och ingen för kommande år', () => {
    expect(lastCompletedMonth(2025, new Date(2026, 3, 15))).toBe(11);
    expect(lastCompletedMonth(2027, new Date(2026, 3, 15))).toBe(-1);
  });
});
