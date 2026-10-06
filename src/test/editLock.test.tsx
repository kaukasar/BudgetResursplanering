import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { EDIT_LOCK_STORAGE_KEY, useEditLockStore } from '../store/editLock';
import { useDataStore } from '../store/store';
import { useUiStore } from '../store/ui';
import { cell, renderApp, resetStores } from './helpers';

beforeEach(() => {
  resetStores();
  // Utgångsläget i en ny flik: redigering avstängd.
  useEditLockStore.setState(useEditLockStore.getInitialState());
});

const toggle = () => screen.getByRole('switch', { name: /Redigering/ });
const openTab = async (user: ReturnType<typeof userEvent.setup>, name: RegExp | string) =>
  user.click(screen.getByRole('tab', { name }));

describe('spärr mot oavsiktliga ändringar i adminläget', () => {
  it('är avstängd som standard: allt som ändrar data är låst, men listor och export fungerar', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    expect(useEditLockStore.getInitialState().editingEnabled).toBe(false);
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(toggle()).toHaveTextContent('🔒');

    await openTab(user, /Sektioner/);
    expect(screen.getByRole('textbox', { name: 'Namn på ny sektion' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Lägg till' })).toBeDisabled();
    expect(
      within(screen.getByRole('row', { name: /Sektion 1/ })).getByRole('button', { name: 'Byt namn' }),
    ).toBeDisabled();

    await openTab(user, /Personal/);
    expect(screen.getByRole('button', { name: '+ Ny person' })).toBeDisabled();
    const anna = screen.getByRole('row', { name: /Anna/ });
    expect(within(anna).getByRole('button', { name: 'Redigera' })).toBeDisabled();
    expect(within(anna).getByRole('button', { name: 'Radera' })).toBeDisabled();
    // Ingen förklarande ledtext på de låsta knapparna.
    expect(within(anna).getByRole('button', { name: 'Redigera' })).not.toHaveAttribute('title');
    // Sortering är läsning och fungerar som vanligt.
    expect(screen.getByRole('button', { name: /Timkostnad, sortera/ })).toBeEnabled();

    await openTab(user, /Produktägare/);
    expect(screen.getByRole('textbox', { name: 'Namn på ny produktägare' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Sektion för ny produktägare' })).toBeDisabled();
    expect(within(screen.getByRole('row', { name: /Petra/ })).getByRole('button', { name: 'Radera' })).toBeDisabled();

    await openTab(user, /Initiativ/);
    expect(screen.getByRole('button', { name: '+ Nytt initiativ' })).toBeDisabled();
    expect(
      within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }),
    ).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Filtrera på produktägare' })).toBeEnabled();

    await openTab(user, 'Inställningar');
    const rate = within(screen.getByRole('region', { name: 'Anställd' })).getByRole('textbox', { name: 'Timkostnad' });
    expect(rate).toHaveAttribute('readonly');
    await user.type(rate, '9');
    expect(useDataStore.getState().data.settings.employee.hourlyRate).toBe(650);

    await openTab(user, 'Export');
    expect(screen.getByRole('button', { name: 'Exportera CSV' })).toBeEnabled();
  });

  it('slås på och av med växeln, och påslagen redigering markeras', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await openTab(user, /Personal/);
    const admin = toggle().closest('.admin')!;
    expect(admin).not.toHaveClass('editing-enabled');

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(toggle()).toHaveTextContent('🔓');
    expect(admin).toHaveClass('editing-enabled');
    expect(screen.getByRole('button', { name: '+ Ny person' })).toBeEnabled();
    expect(within(screen.getByRole('row', { name: /Anna/ })).getByRole('button', { name: 'Radera' })).toBeEnabled();

    await user.click(toggle());
    expect(toggle()).toHaveTextContent('🔒');
    expect(screen.getByRole('button', { name: '+ Ny person' })).toBeDisabled();
  });

  it('gäller per webbläsarflik: överlever omladdning men inte en ny flik', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(toggle());

    // Sparas i sessionStorage (per flik), inte i localStorage (delas mellan flikar).
    expect(sessionStorage.getItem(EDIT_LOCK_STORAGE_KEY)).toContain('"editingEnabled":true');
    expect(localStorage.getItem(EDIT_LOCK_STORAGE_KEY)).toBeNull();

    // Omladdning i samma flik: minnet nollställs, men värdet läses in igen från sessionStorage.
    const saved = sessionStorage.getItem(EDIT_LOCK_STORAGE_KEY)!;
    useEditLockStore.setState({ editingEnabled: false });
    sessionStorage.setItem(EDIT_LOCK_STORAGE_KEY, saved);
    await useEditLockStore.persist.rehydrate();
    expect(useEditLockStore.getState().editingEnabled).toBe(true);
  });

  it('påverkar inte arbetsläget', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ mode: 'work' });
    renderApp();
    await user.type(cell('Anna', 'januari', 'Portal'), '40');
    expect(useDataStore.getState().data.estimates.portal?.anna?.[2026]?.[0]).toBe(40);
  });
});
