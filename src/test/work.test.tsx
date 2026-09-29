import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from '../domain/operations';
import type { AppData } from '../domain/types';
import { DATA_STORAGE_KEY, useDataStore } from '../store/store';
import { cell, initiativeSection, renderApp, resetStores, seed, YEAR } from './helpers';

beforeEach(resetStores);

describe('arbetsläge', () => {
  it('räknar om summor och kostnader direkt vid inmatning', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(cell('Anna', 'januari', 'Portal'), '100');
    await user.type(cell('Anna', 'februari', 'Portal'), '7,5');
    await user.type(cell('Kalle', 'januari', 'Portal'), '10');

    const portal = initiativeSection('Portal');
    const rows = within(portal).getAllByRole('row');
    const annaRow = rows.find((r) => within(r).queryByText('Anna'))!;
    expect(annaRow).toHaveTextContent('107,5');
    expect(annaRow).toHaveTextContent('69 875 kr'); // 107,5 × 650

    const footer = rows.find((r) => within(r).queryByText('Summa'))!;
    expect(footer).toHaveTextContent('110'); // januari: 100 + 10
    expect(footer).toHaveTextContent('117,5');
    expect(footer).toHaveTextContent('79 875 kr'); // 69 875 + 10 × 1000

    // Sparas i localStorage.
    const stored = JSON.parse(localStorage.getItem(DATA_STORAGE_KEY)!) as { state: { data: AppData } };
    expect(stored.state.data.estimates.portal?.anna?.[YEAR]?.slice(0, 2)).toEqual([100, 7.5]);
  });

  it('markerar överallokering rött i alla initiativ där personen förekommer', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(cell('Anna', 'mars', 'Portal'), '100');
    await user.type(cell('Anna', 'mars', 'App'), '60');
    // 160 h = exakt normal arbetstid: inte överallokerad.
    expect(cell('Anna', 'mars', 'Portal').closest('td')).not.toHaveClass('over');

    await user.type(cell('Anna', 'mars', 'App'), '{Backspace}{Backspace}61');
    expect(cell('Anna', 'mars', 'Portal').closest('td')).toHaveClass('over');
    expect(cell('Anna', 'mars', 'App').closest('td')).toHaveClass('over');
    expect(cell('Anna', 'april', 'Portal').closest('td')).not.toHaveClass('over');
  });

  it('avvisar ogiltig inmatning utan att spara', async () => {
    const user = userEvent.setup();
    renderApp();

    const input = cell('Anna', 'januari', 'Portal');
    await user.type(input, '-5');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(useDataStore.getState().data.estimates.portal?.anna).toBeUndefined();
  });

  it('visar budget och förbrukad andel som uppdateras direkt vid inmatning', async () => {
    useDataStore.setState({ data: ops.updateInitiative(seed(), 'portal', { budget: 100_000 }) });
    const user = userEvent.setup();
    renderApp();

    const portal = initiativeSection('Portal');
    expect(portal).toHaveTextContent('Budget totalt100 000 kr');
    expect(within(portal).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    // Initiativ utan budget visar ingen budget.
    expect(initiativeSection('App')).not.toHaveTextContent('Budget');

    await user.type(cell('Kalle', 'januari', 'Portal'), '50'); // 50 × 1000 = 50 000
    expect(portal).toHaveTextContent('Prognos50 %');

    await user.type(cell('Anna', 'januari', 'Portal'), '100'); // + 65 000 = 115 000
    expect(portal).toHaveTextContent('Prognos115 %');
    expect(within(portal).getByRole('progressbar').closest('.budget')).toHaveClass('over-budget');
  });

  it('filtrerar på sektion, och produktägarlistan visar bara sektionens produktägare', async () => {
    let d = seed();
    d = ops.addProductOwner(d, { id: 'stina', name: 'Stina', sectionId: 's2' });
    d = ops.addInitiative(d, {
      id: 'lager',
      name: 'Lager',
      productOwnerId: 'stina',
      personIds: ['anna'],
      years: [YEAR],
    });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    const regions = () => screen.queryAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regions()).toEqual(['Initiativ App', 'Initiativ Lager', 'Initiativ Portal']);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sektion' }), 'Sektion 2');
    expect(regions()).toEqual(['Initiativ Lager']);
    const owners = within(screen.getByRole('combobox', { name: 'Produktägare' })).getAllByRole('option');
    expect(owners.map((o) => o.textContent)).toEqual(['Alla i Sektion 2', 'Stina']);

    // Anna tillhör Sektion 1 men är utlånad till Lager.
    expect(initiativeSection('Lager')).toHaveTextContent('från Sektion 1');
  });

  it('filtrerar på produktägare och år', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Initiativ App',
      'Initiativ Portal',
    ]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Produktägare' }), 'Olle');
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByText(/Olle har inga initiativ för 2026/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Produktägare' }), 'Petra');
    await user.click(screen.getByRole('button', { name: 'Nästa år' }));
    expect(screen.getByText(/Petra har inga initiativ för 2027/)).toBeInTheDocument();
  });
});
