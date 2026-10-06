import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from '../domain/operations';
import { emptyData } from '../domain/types';
import { useDataStore } from '../store/store';
import { initiativeSection, renderApp, resetStores, seed, topDialog, withSecondSection, YEAR } from './helpers';

beforeEach(resetStores);

describe('adminläge', () => {
  it('raderar en person efter bekräftelse; tiden finns kvar men låses', async () => {
    useDataStore.setState({ data: ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 40) });
    const user = userEvent.setup();
    renderApp('admin');

    const annaRow = screen.getByRole('row', { name: /Anna/ });
    await user.click(within(annaRow).getByRole('button', { name: 'Radera' }));

    const dialog = topDialog();
    expect(dialog).toHaveTextContent('låses och kan inte ändras');
    expect(dialog).toHaveTextContent('Portal: 40 h estimat');
    await user.click(within(dialog).getByRole('button', { name: 'Radera' }));

    const data = useDataStore.getState().data;
    expect(data.people.find((p) => p.id === 'anna')?.deleted).toBe(true);
    expect(data.estimates.portal?.anna?.[YEAR]?.[0]).toBe(40);
    expect(data.initiatives.map((i) => [i.id, i.personIds.includes('anna')])).toEqual([
      ['portal', true], // har tid → låst
      ['app', false], // saknar tid → bortkopplad
    ]);
    // Raderad personal visas inte i listan men märks i initiativlistan.
    expect(screen.queryByRole('row', { name: /Anna/ })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Personal (1)' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    expect(screen.getByRole('row', { name: /^Portal/ })).toHaveTextContent('Anna (raderad), Kalle');
  });

  it('kräver att produktägarens initiativ får en ny produktägare innan den kan raderas', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Produktägare/ }));

    const petraRow = screen.getByRole('row', { name: /Petra/ });
    await user.click(within(petraRow).getByRole('button', { name: 'Radera' }));

    const dialog = topDialog();
    expect(dialog).toHaveTextContent('har initiativ som först måste få en ny produktägare i Sektion 1');
    const deleteOwner = within(dialog).getByRole('button', { name: 'Radera produktägare' });
    expect(deleteOwner).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Radera initiativ' })).toBeNull();

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Ny produktägare för Portal' }), 'Olle');
    expect(deleteOwner).toBeDisabled();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Ny produktägare för App' }), 'Olle');
    expect(deleteOwner).toBeEnabled();
    await user.click(deleteOwner);

    const data = useDataStore.getState().data;
    expect(data.productOwners.map((o) => o.name)).toEqual(['Olle']);
    expect(data.initiatives.map((i) => [i.name, i.productOwnerId])).toEqual([
      ['Portal', 'olle'],
      ['App', 'olle'],
    ]);
  });

  it('hänvisar till att skapa en ny produktägare när det inte finns någon annan i sektionen', async () => {
    useDataStore.setState({ data: ops.deleteProductOwner(seed(), 'olle') });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Produktägare/ }));
    await user.click(within(screen.getByRole('row', { name: /Petra/ })).getByRole('button', { name: 'Radera' }));
    expect(topDialog()).toHaveTextContent('Det finns ingen annan produktägare i Sektion 1');
  });

  it('produktägare med initiativ kan byta sektion först när initiativen fått en ny produktägare', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Produktägare/ }));
    await user.click(within(screen.getByRole('row', { name: /Petra/ })).getByRole('button', { name: 'Redigera' }));

    const dialog = topDialog();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Sektion' }), 'Sektion 2');
    const save = within(dialog).getByRole('button', { name: 'Spara' });
    expect(save).toBeDisabled();
    expect(dialog).toHaveTextContent('Initiativen stannar i Sektion 1 med sin personal');

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Ny produktägare för Portal' }), 'Olle');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Ny produktägare för App' }), 'Olle');
    expect(save).toBeEnabled();
    await user.click(save);

    const data = useDataStore.getState().data;
    expect(data.productOwners.find((o) => o.id === 'petra')?.sectionId).toBe('s2');
    expect(data.initiatives.every((i) => i.productOwnerId === 'olle')).toBe(true);
  });

  it('sorterar på namn stigande och fallande i flikarna sektioner, personal, produktägare och initiativ', async () => {
    let d = seed();
    d = ops.addSection(d, { id: 's3', name: 'Ärendehantering' });
    d = ops.addPerson(d, {
      id: 'bo',
      name: 'Östen',
      type: 'employee',
      sectionId: 's2',
      hourlyRate: null,
      monthlyHours: null,
    });
    d = ops.addProductOwner(d, { id: 'asa', name: 'Åsa', sectionId: 's2' });
    d = ops.addInitiative(d, { id: 'b', name: 'Beta', productOwnerId: 'asa', personIds: ['bo'], years: [YEAR] });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp('admin');

    const names = () =>
      [...document.querySelectorAll('table.table tbody tr')].map(
        (r) => (r as HTMLTableRowElement).cells[0]!.textContent,
      );
    const nameHeader = () => screen.getByRole('columnheader', { name: /Namn/ });
    const tabs: [RegExp, string[]][] = [
      [/Sektioner/, ['Sektion 1', 'Sektion 2', 'Ärendehantering']],
      [/Personal/, ['Anna', 'Kalle', 'Östen']],
      [/Produktägare/, ['Olle', 'Petra', 'Åsa']],
      [/Initiativ/, ['App', 'Beta', 'Portal']],
    ];

    for (const [tab, ascending] of tabs) {
      await user.click(screen.getByRole('tab', { name: tab }));
      expect(names()).toEqual(ascending);
      expect(nameHeader()).toHaveAttribute('aria-sort', 'ascending');

      await user.click(screen.getByRole('button', { name: 'Namn, sortera fallande' }));
      expect(names()).toEqual([...ascending].reverse());
      expect(nameHeader()).toHaveAttribute('aria-sort', 'descending');
    }

    // Vald ordning minns per flik när man byter flik och kommer tillbaka.
    await user.click(screen.getByRole('tab', { name: /Sektioner/ }));
    expect(names()).toEqual(['Ärendehantering', 'Sektion 2', 'Sektion 1']);
    await user.click(screen.getByRole('button', { name: 'Namn, sortera stigande' }));
    expect(names()).toEqual(['Sektion 1', 'Sektion 2', 'Ärendehantering']);
    await user.click(screen.getByRole('tab', { name: /Personal/ }));
    expect(names()).toEqual(['Östen', 'Kalle', 'Anna']); // oförändrad av sorteringen i Sektioner
  });

  it('sorterar på alla begärda kolumner i flikarna personal, produktägare och initiativ', async () => {
    let d = seed(); // Anna: anställd, S1, 650 kr/h, 160 h. Kalle: konsult, S1, 1 000 kr/h, 100 h.
    d = ops.addPerson(d, {
      id: 'osten',
      name: 'Östen',
      type: 'employee',
      sectionId: 's2',
      hourlyRate: 800,
      monthlyHours: 120,
    });
    d = ops.addProductOwner(d, { id: 'stina', name: 'Stina', sectionId: 's2' });
    d = ops.addInitiative(d, {
      id: 'lager',
      name: 'Lager',
      productOwnerId: 'stina',
      personIds: ['osten'],
      years: [YEAR - 1, YEAR],
      internalBudget: 500_000,
      externalBudget: 20_000,
    });
    d = ops.addInitiative(d, {
      id: 'arkiv',
      name: 'Arkiv',
      productOwnerId: 'olle',
      personIds: ['kalle'],
      years: [YEAR + 1],
      internalBudget: 100_000,
    });
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 10);
    d = ops.setEstimate(d, 'app', 'anna', YEAR, 0, 30);
    d = ops.setEstimate(d, 'lager', 'osten', YEAR, 0, 5);
    d = ops.setActual(d, 'lager', 'osten', YEAR, 0, 3);
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp('admin');

    const names = () =>
      [...document.querySelectorAll('table.table tbody tr')].map(
        (r) => (r as HTMLTableRowElement).cells[0]!.textContent,
      );
    const sortBy = async (label: string, direction: 'stigande' | 'fallande' = 'stigande') =>
      user.click(screen.getByRole('button', { name: `${label}, sortera ${direction}` }));
    const sorted = () => screen.getAllByRole('columnheader').filter((h) => h.hasAttribute('aria-sort'));

    // ---------------------------------------------------------------- Personal
    await user.click(screen.getByRole('tab', { name: /Personal/ }));
    await sortBy('Timkostnad');
    expect(names()).toEqual(['Anna', 'Östen', 'Kalle']); // 650 < 800 < 1 000 (numeriskt)
    expect(sorted().map((h) => [h.textContent, h.getAttribute('aria-sort')])).toEqual([['Timkostnad▲', 'ascending']]);
    await sortBy('Timkostnad', 'fallande');
    expect(names()).toEqual(['Kalle', 'Östen', 'Anna']);
    await sortBy('Arbetstid/mån');
    expect(names()).toEqual(['Kalle', 'Östen', 'Anna']); // 100 < 120 < 160
    await sortBy('Sektion');
    expect(names()).toEqual(['Anna', 'Kalle', 'Östen']); // Sektion 1 (lika → namn), Sektion 2
    await sortBy('Typ');
    expect(names()).toEqual(['Anna', 'Östen', 'Kalle']); // Anställd, Anställd, Konsult
    await sortBy('Initiativ');
    expect(names()).toEqual(['Anna', 'Kalle', 'Östen']); // "App, Portal" < "Arkiv, Portal" < "Lager"
    expect(screen.getByRole('row', { name: /^Anna/ })).toHaveTextContent('App, Portal');
    await sortBy('Initiativ', 'fallande');
    expect(names()).toEqual(['Östen', 'Kalle', 'Anna']);

    // ---------------------------------------------------------------- Produktägare
    await user.click(screen.getByRole('tab', { name: /Produktägare/ }));
    expect(names()).toEqual(['Olle', 'Petra', 'Stina']); // egen sortering per flik: namn
    await sortBy('Sektion', 'stigande');
    expect(names()).toEqual(['Olle', 'Petra', 'Stina']);
    await sortBy('Sektion', 'fallande');
    expect(names()).toEqual(['Stina', 'Olle', 'Petra']); // Sektion 2 först, lika värden fortfarande på namn
    await sortBy('Initiativ');
    expect(names()).toEqual(['Petra', 'Olle', 'Stina']); // "App, Portal" < "Arkiv" < "Lager"

    // ---------------------------------------------------------------- Initiativ
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    const expectations: [string, 'stigande' | 'fallande', string[]][] = [
      ['Sektion', 'stigande', ['App', 'Arkiv', 'Portal', 'Lager']],
      ['Produktägare', 'stigande', ['Arkiv', 'App', 'Portal', 'Lager']], // Olle, Petra, Petra, Stina
      ['År', 'stigande', ['Lager', 'App', 'Portal', 'Arkiv']], // 2025–2026, 2026, 2026, 2027
      ['Personal', 'stigande', ['App', 'Portal', 'Arkiv', 'Lager']], // Anna, "Anna, Kalle", Kalle, Östen
      ['Intern budget', 'stigande', ['Arkiv', 'Lager', 'App', 'Portal']], // utan budget sist
      ['Intern budget', 'fallande', ['Lager', 'Arkiv', 'App', 'Portal']], // utan budget sist även fallande
      ['Extern budget', 'stigande', ['Lager', 'App', 'Arkiv', 'Portal']], // bara Lager har extern budget
      ['Namn', 'stigande', ['App', 'Arkiv', 'Lager', 'Portal']],
    ];
    for (const [label, direction, expected] of expectations) {
      await sortBy(label, direction);
      expect(names(), `${label} ${direction}`).toEqual(expected);
    }
    // Initiativlistan visar inte estimat och utfall.
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[▲▼↕]/g, ''))).toEqual([
      'Namn',
      'Sektion',
      'Produktägare',
      'Tajmaklass',
      'År',
      'Personal',
      'Intern budget',
      'Extern budget',
      'Åtgärder',
    ]);
  });

  it('tajmaklass är tom som standard, kan väljas i adminläget och visas i arbetsvyn endast när den är satt', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));

    // Nytt initiativ: tomt standardvärde, och det går att skapa med tomt värde.
    await user.click(screen.getByRole('button', { name: '+ Nytt initiativ' }));
    let form = topDialog();
    const tajma = () => within(topDialog()).getByRole('combobox', { name: 'Tajmaklass' });
    expect(tajma()).toHaveValue('');
    expect(
      within(tajma())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['– (ingen)', 'IMM', 'Vidareutveckling', 'Drift']);
    await user.type(within(form).getByRole('textbox', { name: 'Namn' }), 'Nytt');
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Produktägare' }), 'Olle');
    await user.click(within(form).getByRole('checkbox', { name: /Anna/ }));
    await user.click(within(form).getByRole('button', { name: 'Skapa initiativ' }));
    const created = () => useDataStore.getState().data.initiatives.find((i) => i.name === 'Nytt')!;
    expect(created().tajmaClass).toBeNull();

    // Redigera: välj IMM.
    await user.click(within(screen.getByRole('row', { name: /^Nytt/ })).getByRole('button', { name: 'Redigera' }));
    form = topDialog();
    expect(tajma()).toHaveValue('');
    await user.selectOptions(tajma(), 'IMM');
    await user.click(within(form).getByRole('button', { name: 'Spara' }));
    expect(created().tajmaClass).toBe('IMM');
    expect(screen.getByRole('row', { name: /^Nytt/ })).toHaveTextContent('IMM');

    // Arbetsvyn: tajmaklassen visas i huvudet – men inte alls för initiativ utan tajmaklass.
    await user.click(screen.getByRole('button', { name: 'Arbetsläge' }));
    const ownerLine = (name: string) => initiativeSection(name).querySelector('.owner')!.textContent;
    expect(ownerLine('Nytt')).toBe('Sektion: Sektion 1 · Produktägare: Olle · Tajmaklass: IMM');
    expect(ownerLine('Portal')).toBe('Sektion: Sektion 1 · Produktägare: Petra');
    expect(initiativeSection('Portal')).not.toHaveTextContent('Tajmaklass');

    // Tas värdet bort försvinner det ur huvudet igen.
    await user.click(screen.getByRole('button', { name: 'Adminläge' }));
    await user.click(within(screen.getByRole('row', { name: /^Nytt/ })).getByRole('button', { name: 'Redigera' }));
    await user.selectOptions(tajma(), '– (ingen)');
    await user.click(within(topDialog()).getByRole('button', { name: 'Spara' }));
    expect(created().tajmaClass).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Arbetsläge' }));
    expect(initiativeSection('Nytt')).not.toHaveTextContent('Tajmaklass');
  });

  it('tajmaklasskolumnen i initiativlistan kan sorteras, med tomma värden sist', async () => {
    let d = seed();
    d = ops.updateInitiative(d, 'portal', { tajmaClass: 'Drift' });
    d = ops.addInitiative(d, {
      id: 'c',
      name: 'Cirkus',
      productOwnerId: 'olle',
      personIds: ['anna'],
      years: [YEAR],
      tajmaClass: 'IMM',
    });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));

    const names = () =>
      [...document.querySelectorAll('table.table tbody tr')].map(
        (r) => (r as HTMLTableRowElement).cells[0]!.textContent,
      );
    await user.click(screen.getByRole('button', { name: 'Tajmaklass, sortera stigande' }));
    expect(names()).toEqual(['Portal', 'Cirkus', 'App']); // Drift, IMM, (tom)
    await user.click(screen.getByRole('button', { name: 'Tajmaklass, sortera fallande' }));
    expect(names()).toEqual(['Cirkus', 'Portal', 'App']); // IMM, Drift, (tom) – tomt fortfarande sist
  });

  it('fliken Export har bara export till Excel (CSV)', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).not.toContain('Data');
    await user.click(screen.getByRole('tab', { name: 'Export' }));

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toContain('Exportera CSV');
    for (const removed of ['Exportera JSON', 'Välj fil…', 'Ladda exempeldata', 'Radera all data']) {
      expect(screen.queryByRole('button', { name: removed })).not.toBeInTheDocument();
    }
  });

  it('kräver att en sektion skapas först', async () => {
    useDataStore.setState({ data: emptyData() });
    const user = userEvent.setup();
    renderApp('admin');

    await user.click(screen.getByRole('tab', { name: /Personal/ }));
    expect(screen.getByRole('button', { name: '+ Ny person' })).toBeDisabled();
    expect(screen.getByText(/Skapa först en sektion/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gå till Sektioner' }));
    await user.type(screen.getByRole('textbox', { name: 'Namn på ny sektion' }), 'Digitala kanaler{Enter}');
    expect(useDataStore.getState().data.sections.map((s) => s.name)).toEqual(['Digitala kanaler']);

    await user.click(screen.getByRole('tab', { name: /Personal/ }));
    expect(screen.getByRole('button', { name: '+ Ny person' })).toBeEnabled();
  });

  it('hindrar radering av sektion med innehåll tills det flyttats', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Sektioner/ }));

    const row = screen.getByRole('row', { name: /Sektion 1/ });
    expect(row).toHaveTextContent('Sektion 1222'); // 2 personer, 2 produktägare, 2 initiativ
    await user.click(within(row).getByRole('button', { name: 'Radera' }));

    const dialog = topDialog();
    const deleteButton = within(dialog).getByRole('button', { name: 'Radera sektion' });
    expect(deleteButton).toBeDisabled();

    // Bara "Flytta allt" finns: personal, produktägare och initiativ flyttas tillsammans.
    expect(within(dialog).getAllByRole('combobox')).toHaveLength(1);
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Flytta allt i Sektion 1 till sektion' }),
      'Sektion 2',
    );
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    const data = useDataStore.getState().data;
    expect(data.sections.map((s) => s.name)).toEqual(['Sektion 2']);
    expect([...data.people, ...data.productOwners].every((x) => x.sectionId === 's2')).toBe(true);
    expect(data.initiatives).toHaveLength(2); // initiativen följde med sina produktägare
  });

  it('kräver minst en person när ett initiativ skapas', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(screen.getByRole('button', { name: '+ Nytt initiativ' }));

    const dialog = topDialog();
    await user.type(within(dialog).getByRole('textbox', { name: 'Namn' }), 'Nytt');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Produktägare' }), 'Olle');
    await user.click(within(dialog).getByRole('button', { name: 'Skapa initiativ' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Koppla minst en person');

    await user.click(within(dialog).getByRole('checkbox', { name: /Kalle/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Skapa initiativ' }));

    const created = useDataStore.getState().data.initiatives.find((i) => i.name === 'Nytt')!;
    expect(created).toMatchObject({ productOwnerId: 'olle', personIds: ['kalle'], years: [YEAR] });
  });

  it('intern och extern budget anges frivilligt när ett initiativ redigeras', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));

    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));
    const form = topDialog();
    const internal = within(form).getByRole('textbox', { name: 'Intern budget (kr, frivillig)' });
    const external = within(form).getByRole('textbox', { name: 'Extern budget (kr, frivillig)' });
    expect(internal).toHaveValue('');
    expect(external).toHaveValue('');

    await user.type(external, '0');
    await user.click(within(form).getByRole('button', { name: 'Spara' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Extern budget måste vara ett heltal större än 0');

    await user.clear(external);
    await user.type(internal, '250 000');
    await user.click(within(form).getByRole('button', { name: 'Spara' }));
    expect(useDataStore.getState().data.initiatives[0]).toMatchObject({
      internalBudget: 250_000,
      externalBudget: null,
    });
    expect(screen.getByRole('row', { name: /^Portal/ })).toHaveTextContent('250 000 kr');
  });

  it('varnar när personal med timmar tas bort från ett initiativ', async () => {
    useDataStore.setState({ data: ops.setEstimate(seed(), 'portal', 'kalle', YEAR, 0, 30) });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));

    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));
    const form = topDialog();
    await user.click(within(form).getByRole('checkbox', { name: /Kalle/ }));
    await user.click(within(form).getByRole('button', { name: 'Spara' }));

    const warning = topDialog();
    expect(warning).toHaveTextContent('Kalle: 30 h');
    await user.click(within(warning).getByRole('button', { name: 'Avbryt' }));
    expect(useDataStore.getState().data.initiatives[0]!.personIds).toContain('kalle');

    await user.click(within(form).getByRole('button', { name: 'Spara' }));
    await user.click(within(topDialog()).getByRole('button', { name: 'Spara och radera timmar' }));
    const data = useDataStore.getState().data;
    expect(data.initiatives[0]!.personIds).toEqual(['anna']);
    expect(data.estimates.portal?.kalle).toBeUndefined();
  });

  it('globala inställningar påverkar personer utan egna värden', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: 'Inställningar' }));

    const employee = screen.getByRole('region', { name: 'Anställd' });
    const rate = within(employee).getByRole('textbox', { name: 'Timkostnad' });
    await user.clear(rate);
    await user.type(rate, '800');

    await user.click(screen.getByRole('tab', { name: /Personal/ }));
    expect(screen.getByRole('row', { name: /Anna/ })).toHaveTextContent('800 kr/h');
    expect(screen.getByRole('row', { name: /Kalle/ })).toHaveTextContent('1 000 kr/h');
  });
});

describe('personal i initiativformuläret', () => {
  /** Namnen i personallistan (fältgruppen för produktägarens sektion, inte Extern personal). */
  const peopleIn = (dialog: HTMLElement) =>
    [
      ...within(dialog)
        .getByRole('group', { name: /^Personal i/ })
        .querySelectorAll('.check-list label > span:first-of-type'),
    ].map((span) => span.textContent);
  const openNewInitiative = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(screen.getByRole('button', { name: '+ Nytt initiativ' }));
    return topDialog();
  };

  it('visar personal först när en produktägare är vald, och bara från produktägarens sektion', async () => {
    useDataStore.setState({ data: withSecondSection(seed()) });
    const user = userEvent.setup();
    renderApp('admin');
    const dialog = await openNewInitiative(user);

    expect(dialog).toHaveTextContent('Välj en produktägare för att se personalen i produktägarens sektion.');
    expect(within(dialog).queryByRole('checkbox', { name: /Anna|Sara|Extern personal/ })).toBeNull();
    expect(within(dialog).queryByRole('group', { name: 'Visa personal från sektion' })).toBeNull();

    const owner = within(dialog).getByRole('combobox', { name: 'Produktägare' });
    await user.selectOptions(owner, 'Olle');
    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle']);
    expect(within(dialog).getByRole('group', { name: /^Personal i Sektion 1/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /Extern personal/ })).toBeInTheDocument();

    // Byter ett nytt initiativ till en produktägare i en annan sektion avmarkeras tidigare val.
    await user.click(within(dialog).getByRole('checkbox', { name: /Anna/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Extern personal/ }));
    await user.selectOptions(owner, 'Stina');
    expect(peopleIn(dialog)).toEqual(['Sara']);
    expect(within(dialog).getByRole('checkbox', { name: /Extern personal/ })).toBeChecked();

    await user.type(within(dialog).getByRole('textbox', { name: 'Namn' }), 'Nytt');
    await user.click(within(dialog).getByRole('checkbox', { name: /Sara/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Skapa initiativ' }));
    const created = useDataStore.getState().data.initiatives.find((i) => i.name === 'Nytt')!;
    expect(created.personIds).toEqual(['extern', 'sara']);
  });

  it('raderad personal och personal som bytt sektion kan inte väljas, men deras låsta tid finns kvar', async () => {
    let d = withSecondSection(seed());
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 0, 30);
    d = ops.updatePerson(d, 'kalle', { sectionId: 's2' });
    d = ops.deletePerson(d, 'anna');
    d = ops.addPerson(d, {
      id: 'bea',
      name: 'Bea',
      type: 'employee',
      sectionId: 's1',
      hourlyRate: null,
      monthlyHours: null,
    });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));

    const dialog = topDialog();
    expect(peopleIn(dialog)).toEqual(['Bea']);
    await user.click(within(dialog).getByRole('checkbox', { name: /Bea/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Spara' }));

    const portal = useDataStore.getState().data.initiatives.find((i) => i.id === 'portal')!;
    expect(portal.personIds).toEqual(['kalle', 'bea']); // Kalles låsta tid finns kvar
    expect(useDataStore.getState().data.estimates.portal?.kalle?.[YEAR]?.[0]).toBe(30);
  });
});

describe('byte av sektion för personal', () => {
  it('bekräftas med de initiativ där personen blir låst eller bortkopplad', async () => {
    useDataStore.setState({ data: ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 40) });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(within(screen.getByRole('row', { name: /Anna/ })).getByRole('button', { name: 'Redigera' }));

    const form = topDialog();
    await user.selectOptions(within(form).getByRole('combobox'), 'Sektion 2');
    await user.click(within(form).getByRole('button', { name: 'Spara' }));

    const confirmation = topDialog();
    expect(confirmation).toHaveTextContent('Anna blir låst på Portal. Tiden finns kvar men kan inte ändras.');
    expect(confirmation).toHaveTextContent('Anna kopplas bort från App, där ingen tid är registrerad.');
    await user.click(within(confirmation).getByRole('button', { name: 'Byt sektion' }));

    const data = useDataStore.getState().data;
    expect(data.people.find((p) => p.id === 'anna')?.sectionId).toBe('s2');
    expect(data.initiatives.map((i) => [i.id, i.personIds.includes('anna')])).toEqual([
      ['portal', true],
      ['app', false],
    ]);
  });

  it('kan avbrytas', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(within(screen.getByRole('row', { name: /Anna/ })).getByRole('button', { name: 'Redigera' }));
    const form = topDialog();
    await user.selectOptions(within(form).getByRole('combobox'), 'Sektion 2');
    await user.click(within(form).getByRole('button', { name: 'Spara' }));
    await user.click(within(topDialog()).getByRole('button', { name: 'Avbryt' }));
    expect(useDataStore.getState().data.people.find((p) => p.id === 'anna')?.sectionId).toBe('s1');
  });
});
