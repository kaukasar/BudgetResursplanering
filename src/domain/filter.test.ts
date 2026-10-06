// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import {
  ALL_OWNERS,
  ALL_SECTIONS,
  ALL_TAJMA_CLASSES,
  filterInitiatives,
  NO_TAJMA_CLASS,
  resolveFilter,
  selectableYears,
  type InitiativeFilter,
  type TajmaClassFilter,
} from './filter';
import * as ops from './operations';

const ALL: InitiativeFilter = {
  year: 2026,
  sectionId: ALL_SECTIONS,
  ownerId: ALL_OWNERS,
  tajmaClass: ALL_TAJMA_CLASSES,
};

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
    const ids = (filter: Partial<InitiativeFilter>) =>
      filterInitiatives(data, { ...ALL, ...filter }).map((initiative) => initiative.id);

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
      filterInitiatives(data, { ...ALL, year, tajmaClass }).map((initiative) => initiative.id);

    expect(ids(ALL_TAJMA_CLASSES)).toEqual(['i1', 'i2']);
    expect(ids('IMM')).toEqual(['i1']);
    expect(ids('Drift')).toEqual([]);
    expect(ids(NO_TAJMA_CLASS)).toEqual(['i2']);
    expect(ids('IMM', 2027)).toEqual([]); // Portal gäller inte 2027
  });
});

describe('sparat filter', () => {
  it('behåller val som fortfarande finns', () => {
    const saved: InitiativeFilter = { year: 2027, sectionId: 's1', ownerId: 'po1', tajmaClass: 'Drift' };
    expect(resolveFilter(domainFixture(), saved)).toEqual(saved);
  });

  it('visar alla i stället för en raderad sektion, en produktägare utanför sektionen och en okänd tajmaklass', () => {
    const data = domainFixture(); // Petra (po1) tillhör s1
    expect(resolveFilter(data, { ...ALL, sectionId: 'raderad' }).sectionId).toBe(ALL_SECTIONS);
    expect(resolveFilter(data, { ...ALL, sectionId: 's2', ownerId: 'po1' }).ownerId).toBe(ALL_OWNERS);
    expect(resolveFilter(data, { ...ALL, ownerId: 'raderad' }).ownerId).toBe(ALL_OWNERS);
    const unknownTajmaClass = { ...ALL, tajmaClass: 'Okänd' } as unknown as InitiativeFilter;
    expect(resolveFilter(data, unknownTajmaClass).tajmaClass).toBe(ALL_TAJMA_CLASSES);
  });
});

describe('år i årsväljaren', () => {
  it('innehåller initiativens år samt innevarande och valt år, stigande och utan dubbletter', () => {
    const data = domainFixture(); // initiativ 2026 och 2026–2027
    expect(selectableYears(data, 2030, 2026)).toEqual([2026, 2027, 2030]);
    expect(selectableYears(data, 2026, 2025)).toEqual([2025, 2026, 2027]);
  });
});
