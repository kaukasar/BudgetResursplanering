import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from '../domain/operations';
import { emptyData } from '../domain/types';
import { useDataStore } from '../store/store';
import { initiativeSection, renderApp, resetStores, seed, topDialog, YEAR } from './helpers';

beforeEach(resetStores);

describe('adminläge', () => {
  it('raderar en person efter bekräftelse, inklusive kopplingar och timmar', async () => {
    useDataStore.setState({ data: ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 40) });
    const user = userEvent.setup();
    renderApp('admin');

    const annaRow = screen.getByRole('row', { name: /Anna/ });
    await user.click(within(annaRow).getByRole('button', { name: 'Radera' }));

    const dialog = topDialog();
    expect(dialog).toHaveTextContent('Portal');
    expect(dialog).toHaveTextContent('40 planerade timmar raderas');
    await user.click(within(dialog).getByRole('button', { name: 'Radera' }));

    const data = useDataStore.getState().data;
    expect(data.people.map((p) => p.name)).toEqual(['Kalle']);
    expect(data.initiatives.every((i) => !i.personIds.includes('anna'))).toBe(true);
    expect(data.estimates.portal?.anna).toBeUndefined();
  });

  it('hindrar radering av produktägare med initiativ tills de flyttats eller raderats', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Produktägare/ }));

    const petraRow = screen.getByRole('row', { name: /Petra/ });
    await user.click(within(petraRow).getByRole('button', { name: 'Radera' }));

    const dialog = topDialog();
    expect(dialog).toHaveTextContent('2 initiativ är kopplade');
    const deleteOwner = within(dialog).getByRole('button', { name: 'Radera produktägare' });
    expect(deleteOwner).toBeDisabled();

    // Flytta Portal till Olle och radera App.
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Flytta Portal till produktägare' }), 'Olle');
    await user.click(within(dialog).getByRole('button', { name: 'Radera initiativ' }));
    await user.click(within(topDialog()).getByRole('button', { name: 'Radera initiativ' })); // bekräfta

    expect(deleteOwner).toBeEnabled();
    await user.click(deleteOwner);

    const data = useDataStore.getState().data;
    expect(data.productOwners.map((o) => o.name)).toEqual(['Olle']);
    expect(data.initiatives.map((i) => [i.name, i.productOwnerId])).toEqual([['Portal', 'olle']]);
  });

  it('sorterar på namn stigande och fallande i flikarna sektioner, personal, produktägare och initiativ', async () => {
    let d = seed();
    d = ops.addSection(d, { id: 's3', name: 'Ärendehantering' });
    d = ops.addPerson(d, {
      id: 'bo',
      name: 'Östen',
      type: 'employee',
      sectionId: 's1',
      hourlyRate: null,
      monthlyHours: null,
    });
    d = ops.addProductOwner(d, { id: 'asa', name: 'Åsa', sectionId: 's2' });
    d = ops.addInitiative(d, { id: 'b', name: 'Beta', productOwnerId: 'asa', personIds: ['anna'], years: [YEAR] });
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
      budget: 500_000,
    });
    d = ops.addInitiative(d, {
      id: 'arkiv',
      name: 'Arkiv',
      productOwnerId: 'olle',
      personIds: ['kalle'],
      years: [YEAR + 1],
      budget: 100_000,
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
      ['Budget', 'stigande', ['Arkiv', 'Lager', 'App', 'Portal']], // utan budget sist
      ['Budget', 'fallande', ['Lager', 'Arkiv', 'App', 'Portal']], // utan budget sist även fallande
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
      'Budget',
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

  it('frågar innan exempeldata ersätter befintlig data, även när bara sektioner finns', async () => {
    useDataStore.setState({ data: ops.addSection(emptyData(), { id: 's', name: 'Min sektion' }) });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: 'Data' }));
    await user.click(screen.getByRole('button', { name: 'Ladda exempeldata' }));

    const dialog = topDialog();
    expect(dialog).toHaveTextContent('All nuvarande data ersätts med exempeldata');
    await user.click(within(dialog).getByRole('button', { name: 'Avbryt' }));
    expect(useDataStore.getState().data.sections.map((section) => section.name)).toEqual(['Min sektion']);
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

  it('budget anges frivilligt när ett initiativ redigeras', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));

    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));
    const form = topDialog();
    const budget = within(form).getByRole('textbox', { name: 'Budget (kr, frivillig)' });
    expect(budget).toHaveValue('');

    await user.type(budget, '0');
    await user.click(within(form).getByRole('button', { name: 'Spara' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('större än 0');

    await user.clear(budget);
    await user.type(budget, '250 000');
    await user.click(within(form).getByRole('button', { name: 'Spara' }));
    expect(useDataStore.getState().data.initiatives[0]!.budget).toBe(250_000);
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

describe('sektionsfilter för personal i initiativformuläret', () => {
  /** Seed plus Sara och produktägaren Stina i Sektion 2. */
  const seedWithTwoSections = () => {
    let d = seed();
    d = ops.addPerson(d, {
      id: 'sara',
      name: 'Sara',
      type: 'employee',
      sectionId: 's2',
      hourlyRate: null,
      monthlyHours: null,
    });
    return ops.addProductOwner(d, { id: 'stina', name: 'Stina', sectionId: 's2' });
  };
  /** Namnen i personallistan (fältgruppen Personal, inte Extern personal). */
  const peopleIn = (dialog: HTMLElement) =>
    [
      ...within(dialog)
        .getByRole('group', { name: /^Personal/ })
        .querySelectorAll('.check-list label > span:first-of-type'),
    ].map((span) => span.textContent);
  const sectionFilter = (dialog: HTMLElement) =>
    within(dialog).getByRole('group', { name: 'Visa personal från sektion' });
  const sectionChip = (dialog: HTMLElement, name: string) =>
    within(sectionFilter(dialog)).getByRole('checkbox', { name });

  it('visar som standard personal i produktägarens sektion; fler sektioner kan väljas', async () => {
    useDataStore.setState({ data: seedWithTwoSections() });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));
    const dialog = topDialog();

    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle']);
    expect(sectionChip(dialog, 'Sektion 1')).toBeChecked();
    expect(sectionChip(dialog, 'Sektion 1')).toBeDisabled(); // minst en sektion visas alltid
    expect(sectionChip(dialog, 'Sektion 2')).not.toBeChecked();

    await user.click(sectionChip(dialog, 'Sektion 2'));
    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle', 'Sara']); // inlånad personal sist
    expect(within(dialog).getByRole('checkbox', { name: /Sara/ }).closest('label')).toHaveTextContent(
      'lånas från Sektion 2',
    );
    expect(sectionChip(dialog, 'Sektion 1')).toBeEnabled();

    // Bara Sektion 2: Anna och Kalle är kopplade och syns därför ändå.
    await user.click(sectionChip(dialog, 'Sektion 1'));
    expect(sectionChip(dialog, 'Sektion 2')).toBeDisabled();
    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle', 'Sara']);
    await user.click(within(dialog).getByRole('checkbox', { name: /Anna/ }));
    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle', 'Sara']); // avmarkerad ligger Anna kvar i listan tills formuläret stängs

    await user.click(within(dialog).getByRole('checkbox', { name: /Sara/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Alla sektioner' }));
    expect(sectionChip(dialog, 'Sektion 1')).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Alla sektioner' })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'Spara' }));
    expect(useDataStore.getState().data.initiatives[0]!.personIds).toEqual(['kalle', 'sara']);
  });

  it('visar redan kopplad personal från andra sektioner även när deras sektion är bortfiltrerad', async () => {
    let d = seedWithTwoSections();
    d = ops.updateInitiative(d, 'portal', { personIds: ['anna', 'sara'] });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));
    const dialog = topDialog();

    expect(sectionChip(dialog, 'Sektion 2')).not.toBeChecked();
    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle', 'Sara']);
    expect(within(dialog).getByRole('checkbox', { name: /Sara/ })).toBeChecked();
  });

  it('nytt initiativ: alla sektioner innan produktägare är vald, sedan produktägarens sektion', async () => {
    useDataStore.setState({ data: seedWithTwoSections() });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(screen.getByRole('button', { name: '+ Nytt initiativ' }));
    const dialog = topDialog();

    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle', 'Sara']);
    expect(sectionChip(dialog, 'Sektion 1')).toBeChecked();
    expect(sectionChip(dialog, 'Sektion 2')).toBeChecked();

    const owner = within(dialog).getByRole('combobox', { name: 'Produktägare' });
    await user.selectOptions(owner, 'Stina');
    expect(peopleIn(dialog)).toEqual(['Sara']);
    await user.selectOptions(owner, 'Olle');
    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle']);
    expect(sectionChip(dialog, 'Sektion 2')).not.toBeChecked();
  });

  it('visar inget filter när bara en sektion har personal', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));
    const dialog = topDialog();
    expect(within(dialog).queryByRole('group', { name: 'Visa personal från sektion' })).toBeNull();
    expect(peopleIn(dialog)).toEqual(['Anna', 'Kalle']);
  });
});
