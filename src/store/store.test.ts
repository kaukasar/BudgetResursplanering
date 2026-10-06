import { beforeEach, describe, expect, it, vi } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { emptyData, type AppData } from '../domain/types';
import { DATA_STORAGE_KEY, useDataStore } from './store';

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
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify({ state: { data: domainFixture() }, version: 1 }));
    await useDataStore.persist.rehydrate();
    expect(useDataStore.getState().data).toEqual(domainFixture());
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

  it('öppnar fliken Export för den som senast var på den tidigare fliken Data, och behåller sorteringen', async () => {
    const { useUiStore } = await import('./ui');
    const adminSort = { ...useUiStore.getState().adminSort, people: { key: 'rate', direction: 'desc' } };
    localStorage.setItem(
      'ekonomi.ui',
      JSON.stringify({ state: { mode: 'admin', adminTab: 'data', adminSort }, version: 2 }),
    );
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().adminTab).toBe('export');
    expect(useUiStore.getState().adminSort).toEqual(adminSort);
  });
});
