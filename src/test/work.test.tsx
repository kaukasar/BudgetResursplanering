import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from '../domain/operations';
import type { AppData } from '../domain/types';
import { DATA_STORAGE_KEY, useDataStore } from '../store/store';
import { cell, initiativeSection, renderApp, resetStores, seed, withSecondSection, YEAR } from './helpers';

beforeEach(resetStores);

describe('arbetsläge', () => {
  it('räknar om summor och kostnader direkt vid inmatning', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(cell('Anna', 'januari', 'Portal'), '100');
    await user.type(cell('Anna', 'februari', 'Portal'), '8');
    await user.type(cell('Kalle', 'januari', 'Portal'), '10');

    const portal = initiativeSection('Portal');
    const rows = within(portal).getAllByRole('row');
    const annaRow = rows.find((r) => within(r).queryByText('Anna'))!;
    expect(annaRow).toHaveTextContent('108');
    expect(annaRow).toHaveTextContent('70 200 kr'); // 108 × 650

    const footer = rows.find((r) => within(r).queryByText('Summa'))!;
    expect(footer).toHaveTextContent('110'); // januari: 100 + 10
    expect(footer).toHaveTextContent('118');
    expect(footer).toHaveTextContent('80 200 kr'); // 70 200 + 10 × 1000

    // Sparas i localStorage.
    const stored = JSON.parse(localStorage.getItem(DATA_STORAGE_KEY)!) as { state: { data: AppData } };
    expect(stored.state.data.estimates.portal?.anna?.[YEAR]?.slice(0, 2)).toEqual([100, 8]);
  });

  it('tar bara emot heltal: decimaler markeras som ogiltiga och sparas inte', async () => {
    // Cellen sparar medan man skriver: "7" sparas, "7," och "7,5" är ogiltiga och sparas inte.
    const user = userEvent.setup();
    renderApp();

    const input = cell('Anna', 'januari', 'Portal');
    await user.type(input, '7,5');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('title', 'Ange ett heltal som är 0 eller större');
    expect(useDataStore.getState().data.estimates.portal?.anna?.[YEAR]?.[0]).toBe(7);

    // När cellen lämnas visas det sparade heltalet igen.
    await user.tab();
    expect(input).toHaveValue('7');
    expect(input).not.toHaveAttribute('aria-invalid');
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
    useDataStore.setState({ data: ops.updateInitiative(seed(), 'portal', { internalBudget: 100_000 }) });
    const user = userEvent.setup();
    renderApp();

    const portal = initiativeSection('Portal');
    expect(portal).toHaveTextContent('Intern budget100 000 kr');
    expect(portal).not.toHaveTextContent('Extern budget'); // ingen extern budget angiven
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
    d = withSecondSection(d);
    d = ops.addInitiative(d, {
      id: 'lager',
      name: 'Lager',
      productOwnerId: 'stina',
      personIds: ['sara'],
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

    // Lager bemannas av personal i sin egen sektion.
    expect(initiativeSection('Lager')).toHaveTextContent('Sara');
  });

  it('filtrerar på tajmaklass till höger om produktägare, även initiativ utan tajmaklass', async () => {
    let d = ops.updateInitiative(seed(), 'portal', { tajmaClass: 'IMM' });
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 10);
    d = ops.setEstimate(d, 'app', 'anna', YEAR, 0, 20);
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    const filters = screen.getAllByRole('combobox').map((select) => select.getAttribute('aria-label'));
    expect(filters.slice(1, 4)).toEqual(['Sektion', 'Produktägare', 'Tajmaklass']);
    const tajma = screen.getByRole('combobox', { name: 'Tajmaklass' });
    expect(
      within(tajma)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Alla tajmaklasser', 'IMM', 'Vidareutveckling', 'Drift', 'Ingen tajmaklass']);

    const regions = () => screen.queryAllByRole('region').map((r) => r.getAttribute('aria-label'));
    await user.selectOptions(tajma, 'IMM');
    expect(regions()).toEqual(['Initiativ Portal']);
    // Nyckeltalen följer filtret: bara Portals 10 h.
    expect(
      screen.getByText(`Planerade timmar ${YEAR}`, { selector: '.stat .label' }).nextElementSibling,
    ).toHaveTextContent('10 h');

    await user.selectOptions(tajma, 'Ingen tajmaklass');
    expect(regions()).toEqual(['Initiativ App']);

    await user.selectOptions(tajma, 'Drift');
    expect(regions()).toEqual([]);
    expect(screen.getByText(`Det finns inga initiativ med tajmaklass Drift för ${YEAR}.`)).toBeInTheDocument();
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

describe('nyckeltalen intern och extern budget', () => {
  const statLabels = () => [...document.querySelectorAll('.stat .label')].map((l) => l.textContent);
  const internalFigure = () => [...document.querySelectorAll('.stat')].at(-2)!;
  const externalFigure = () => [...document.querySelectorAll('.stat')].at(-1)!;

  it('visas längst till höger i alla vyer och summerar budgeten för de visade initiativen', async () => {
    let d = seed();
    d = ops.updateInitiative(d, 'portal', { internalBudget: 300_000, externalBudget: 40_000 });
    d = ops.updateInitiative(d, 'app', { internalBudget: 200_000 });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    for (const view of ['Estimat', 'Utfall', 'Jämförelse']) {
      await user.click(screen.getByRole('button', { name: view }));
      expect(statLabels().slice(-2)).toEqual(['Intern budget', 'Extern budget']);
      expect(internalFigure()).toHaveTextContent('500 000 kr');
      expect(externalFigure()).toHaveTextContent('40 000 kr');
    }
    expect(internalFigure()).toHaveAttribute(
      'title',
      'Summan av den interna budgeten för de visade initiativen. 2 av 2 initiativ har intern budget.',
    );
    expect(externalFigure()).toHaveAttribute(
      'title',
      'Summan av den externa budgeten för de visade initiativen. 1 av 2 initiativ har extern budget.',
    );
  });

  it('följer filtret, räknar inte initiativ utan budget och anger när budgeten gäller flera år', async () => {
    let d = seed();
    d = ops.updateInitiative(d, 'portal', { internalBudget: 300_000, years: [YEAR, YEAR + 1] });
    d = withSecondSection(d);
    d = ops.addInitiative(d, {
      id: 'lager',
      name: 'Lager',
      productOwnerId: 'stina',
      personIds: ['sara'],
      years: [YEAR],
    });
    d = ops.updateInitiative(d, 'lager', { internalBudget: 50_000 });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    // Portal gäller två år och har intern budget; ingen har extern budget.
    expect(statLabels().slice(-2)).toEqual(['Intern budget (alla år)', 'Extern budget']);
    expect(internalFigure()).toHaveTextContent('350 000 kr'); // App saknar budget
    expect(externalFigure()).toHaveTextContent('–');
    expect(internalFigure()).toHaveAttribute(
      'title',
      'Summan av den interna budgeten för de visade initiativen. 2 av 3 initiativ har intern budget.',
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sektion' }), 'Sektion 2');
    expect(statLabels().slice(-2)).toEqual(['Intern budget', 'Extern budget']);
    expect(internalFigure()).toHaveTextContent('50 000 kr');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sektion' }), 'Sektion 1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Produktägare' }), 'Petra');
    d = ops.updateInitiative(useDataStore.getState().data, 'portal', { internalBudget: null });
    useDataStore.setState({ data: d });
    await waitFor(() => expect(internalFigure()).toHaveTextContent('–')); // ingen budget alls
    expect(externalFigure()).toHaveTextContent('–');
  });
});
