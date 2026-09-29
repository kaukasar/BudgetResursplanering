import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMonthActuals, personCapacity } from '../domain/calc';
import { sampleData } from '../domain/sample';
import { emptyData, type AppData } from '../domain/types';
import { DATA_STORAGE_KEY, useDataStore } from './store';

let counter = 0;
// Fast datum gör exemplets utfall (avslutade månader) oberoende av när testet körs.
const sample = () => sampleData(2026, () => `id-${++counter}`, new Date(2026, 8, 15));

beforeEach(() => {
  localStorage.clear();
  useDataStore.setState({ data: emptyData() });
});

describe('persistens', () => {
  it('sparar ändringar i localStorage och läser in dem igen', async () => {
    const store = useDataStore.getState();
    const sectionId = store.addSection('Sektion');
    const id = store.addProductOwner('Petra', sectionId);
    const stored = JSON.parse(localStorage.getItem(DATA_STORAGE_KEY)!) as { state: { data: AppData } };
    expect(stored.state.data.productOwners).toEqual([{ id, name: 'Petra', sectionId }]);

    useDataStore.setState({ data: emptyData() }, false);
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify({ state: { data: sample() }, version: 1 }));
    await useDataStore.persist.rehydrate();
    expect(useDataStore.getState().data.initiatives).toHaveLength(3);
  });

  it('startar tomt och sparar en backup om sparad data är trasig', async () => {
    const broken = JSON.stringify({ state: { data: { people: 'inte en lista' } }, version: 1 });
    localStorage.setItem(DATA_STORAGE_KEY, broken);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await useDataStore.persist.rehydrate();

    expect(useDataStore.getState().data).toEqual(emptyData());
    expect(localStorage.getItem(`${DATA_STORAGE_KEY}.backup`)).toBe(broken);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('exempeldatan är giltig och innehåller överallokering', () => {
    const d = sample();
    expect(d.people).toHaveLength(5);
    expect(d.productOwners).toHaveLength(2);
    expect(d.initiatives).toHaveLength(3);
    const overallocated = d.people
      .map((p) => [p.name, personCapacity(d, p, 2026).overallocated.flatMap((over, m) => (over ? [m] : []))] as const)
      .filter(([, months]) => months.length > 0);
    expect(overallocated).toEqual([
      ['Anna Andersson', [2]], // mars
      ['David Dahl', [9]], // oktober
    ]);
  });
});

describe('vyinställningar', () => {
  it('migrerar sparad sortering från äldre format utan att tappa övriga inställningar', async () => {
    const { DEFAULT_ADMIN_SORT, useUiStore } = await import('./ui');
    localStorage.setItem(
      'ekonomi.ui',
      JSON.stringify({
        state: {
          mode: 'admin',
          adminTab: 'people',
          year: 2027,
          adminSort: { sections: 'asc', people: 'desc', owners: 'asc', initiatives: 'asc' },
        },
        version: 1,
      }),
    );
    await useUiStore.persist.rehydrate();
    const state = useUiStore.getState();
    expect(state.adminSort).toEqual(DEFAULT_ADMIN_SORT);
    expect([state.mode, state.adminTab, state.year]).toEqual(['admin', 'people', 2027]);

    state.sortAdminBy('people', 'rate');
    state.sortAdminBy('people', 'rate');
    expect(useUiStore.getState().adminSort.people).toEqual({ key: 'rate', direction: 'desc' });
  });
});

describe('exempeldata', () => {
  it('har utfall för avslutade månader men inte för innevarande eller kommande', () => {
    const data = sample(); // "idag" = 15 september 2026
    const portal = data.initiatives.find((initiative) => initiative.name === 'Kundportal 2.0')!;
    const anna = data.people.find((person) => person.name === 'Anna Andersson')!;
    const actuals = getMonthActuals(data, portal.id, anna.id, 2026);
    expect(actuals.slice(0, 8).every((actual) => actual !== null)).toBe(true); // jan–aug
    expect(actuals.slice(8).every((actual) => actual === null)).toBe(true); // sep–dec
  });
});
