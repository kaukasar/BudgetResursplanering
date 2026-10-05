import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMonthActuals, getMonthEstimates } from '../domain/calc';
import * as ops from '../domain/operations';
import { useDataStore } from '../store/store';
import { actualCell, cell, initiativeSection, renderApp, resetStores, seed, withSecondSection, YEAR } from './helpers';

beforeEach(resetStores);

describe('estimat och utfall', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('utfall matas in i egen vy, med estimatet som ledtext i tomma celler', async () => {
    useDataStore.setState({ data: ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 100) });
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Utfall' }));
    expect(initiativeSection('Portal')).toHaveTextContent('Portal Utfall');
    const input = actualCell('Anna', 'januari', 'Portal');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', '100');

    await user.type(input, '90');
    const data = () => useDataStore.getState().data;
    expect(getMonthActuals(data(), 'portal', 'anna', YEAR)[0]).toBe(90);
    expect(getMonthEstimates(data(), 'portal', 'anna', YEAR)[0]).toBe(100); // estimatet orört
    const annaRow = within(initiativeSection('Portal'))
      .getAllByRole('row')
      .find((r) => within(r).queryByText('Anna'))!;
    expect(annaRow).toHaveTextContent('58 500 kr'); // 90 × 650

    // Tom cell = inget utfall rapporterat (inte 0).
    await user.clear(input);
    expect(getMonthActuals(data(), 'portal', 'anna', YEAR)[0]).toBeNull();
    await user.type(input, '0');
    expect(getMonthActuals(data(), 'portal', 'anna', YEAR)[0]).toBe(0);
  });

  it('"Fyll från estimat" fyller tomma utfall för avslutade månader', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(YEAR, 3, 15)); // april → fyller t.o.m. mars
    let d = seed();
    [10, 20, 30, 40].forEach((h, m) => (d = ops.setEstimate(d, 'portal', 'anna', YEAR, m, h)));
    d = ops.setActual(d, 'portal', 'anna', YEAR, 1, 25);
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Utfall' }));

    const annaRow = within(initiativeSection('Portal'))
      .getAllByRole('row')
      .find((r) => within(r).queryByText('Anna'))!;
    await user.click(within(annaRow).getByRole('button', { name: 'Fyll från estimat' }));
    expect(getMonthActuals(useDataStore.getState().data, 'portal', 'anna', YEAR).slice(0, 4)).toEqual([
      10,
      25,
      30,
      null,
    ]);
    // Inget kvar att fylla: knappen försvinner.
    expect(within(annaRow).queryByRole('button', { name: 'Fyll från estimat' })).toBeNull();
  });

  it('visar samma avvikelse i initiativhuvud och summarad vid delvis rapportering, men inte som nyckeltal', async () => {
    // Anna och Kalle har estimat i januari, men bara Anna har rapporterat utfall.
    let d = seed();
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 100);
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 0, 20);
    d = ops.setActual(d, 'portal', 'anna', YEAR, 0, 90);
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));

    const portal = initiativeSection('Portal');
    const headerDeviation = within(portal).getByText(`Avvikelse ${YEAR}`, { selector: '.label' });
    expect(headerDeviation.nextElementSibling).toHaveTextContent('−10 h');
    // Nyckeltalet för avvikelse är borttaget.
    expect(screen.queryByText('Avvikelse mot estimat')).toBeNull();

    const footer = within(portal).getAllByRole('row').at(-1)!;
    const footerCells = within(footer).getAllByRole('cell');
    expect(footerCells[0]).toHaveTextContent('90▼10'); // januari jämförs bara mot Annas 100 h
    expect(footerCells[14]).toHaveTextContent('−10');
  });

  it('jämförelsevyn är skrivskyddad och visar avvikelse mot estimat', async () => {
    let d = seed();
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 100);
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 1, 100);
    d = ops.setActual(d, 'portal', 'anna', YEAR, 0, 90);
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));

    const portal = initiativeSection('Portal');
    expect(within(portal).queryAllByRole('textbox')).toHaveLength(0);
    const annaRow = within(portal)
      .getAllByRole('row')
      .find((r) => within(r).queryByText('Anna'))!;
    const cells = within(annaRow).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('90▼10'); // januari: utfall 90, 10 h under estimat
    expect(cells[1]).toHaveTextContent('–'); // februari: inget utfall rapporterat
    expect(cells[12]).toHaveTextContent('200'); // estimat helår
    expect(cells[13]).toHaveTextContent('90'); // utfall
    expect(cells[14]).toHaveTextContent('−10'); // avvikelse, bara på rapporterade månader
    expect(portal).toHaveTextContent('Avvikelse 2026−10 h');

    await user.click(within(annaRow).getByRole('button', { name: 'Visa estimat per månad för Anna' }));
    expect(within(portal).getByText(`Estimat ${YEAR}`)).toBeInTheDocument();
  });

  it('jämförelsevyn visar totalt estimat bredvid totalt utfall, och följer sektionsfiltret', async () => {
    let d = seed();
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 100);
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 1, 50);
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 0, 10);
    d = ops.setActual(d, 'portal', 'anna', YEAR, 0, 90);
    d = withSecondSection(d);
    d = ops.addInitiative(d, {
      id: 'lager',
      name: 'Lager',
      productOwnerId: 'stina',
      personIds: ['sara'],
      years: [YEAR],
    });
    d = ops.setEstimate(d, 'lager', 'sara', YEAR, 0, 30);
    d = ops.setActual(d, 'lager', 'sara', YEAR, 0, 25);
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));

    const statLabels = () => [...document.querySelectorAll('.stat .label')].map((l) => l.textContent);
    const statValue = (label: string) =>
      screen.getByText(label, { selector: '.stat .label' }).nextElementSibling!.textContent;
    // Estimatrutan ligger direkt före utfallsrutan.
    expect(statLabels().slice(1, 3)).toEqual([`Estimat ${YEAR}`, `Utfall ${YEAR}`]);
    expect(statValue(`Estimat ${YEAR}`)).toBe('190 h'); // 100 + 50 + 10 + 30
    expect(statValue(`Utfall ${YEAR}`)).toBe('115 h'); // 90 + 25

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sektion' }), 'Sektion 1');
    expect(statValue(`Estimat ${YEAR}`)).toBe('160 h');
    expect(statValue(`Utfall ${YEAR}`)).toBe('90 h');

    // Rutan uppdateras direkt när estimat ändras.
    await user.click(screen.getByRole('button', { name: 'Estimat' }));
    await user.type(cell('Kalle', 'mars', 'Portal'), '40');
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));
    expect(statValue(`Estimat ${YEAR}`)).toBe('200 h');
  });

  it('jämförelsevyn visar total utfallskostnad till höger om prognos kostnad', async () => {
    let d = seed();
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 100); // estimat 65 000
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 0, 20); // estimat 20 000
    d = ops.setActual(d, 'portal', 'anna', YEAR, 0, 90); // 90 × 650 = 58 500
    d = ops.setActual(d, 'portal', 'kalle', YEAR, 0, 12); // 12 × 1 000 = 12 000
    d = withSecondSection(d);
    d = ops.addInitiative(d, {
      id: 'lager',
      name: 'Lager',
      productOwnerId: 'stina',
      personIds: ['sara'],
      years: [YEAR],
    });
    d = ops.setActual(d, 'lager', 'sara', YEAR, 0, 10); // 6 500
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));

    const statLabels = () => [...document.querySelectorAll('.stat .label')].map((l) => l.textContent);
    const statValue = (label: string) =>
      screen.getByText(label, { selector: '.stat .label' }).nextElementSibling!.textContent;
    // Utfallskostnaden ligger direkt till höger om prognos kostnad (sist i raden).
    expect(statLabels().slice(-4)).toEqual([
      `Prognos kostnad ${YEAR}`,
      `Utfallskostnad ${YEAR}`,
      'Intern budget',
      'Extern budget',
    ]);
    expect(statValue(`Prognos kostnad ${YEAR}`)).toBe('85 000 kr');
    expect(statValue(`Utfallskostnad ${YEAR}`)).toBe('77 000 kr'); // 58 500 + 12 000 + 6 500

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sektion' }), 'Sektion 1');
    expect(statValue(`Utfallskostnad ${YEAR}`)).toBe('70 500 kr');

    // Nytt utfall slår igenom direkt; prognosen står still.
    await user.click(screen.getByRole('button', { name: 'Utfall' }));
    await user.type(actualCell('Kalle', 'februari', 'Portal'), '4'); // + 4 000
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));
    expect(statValue(`Utfallskostnad ${YEAR}`)).toBe('74 500 kr');
    expect(statValue(`Prognos kostnad ${YEAR}`)).toBe('85 000 kr');
  });

  it('jämförelsevyn visar initiativets utfallskostnad bredvid avvikelse och prognos', async () => {
    let d = seed();
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 100); // estimat 65 000
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 1, 10); // estimat 10 000
    d = ops.setActual(d, 'portal', 'anna', YEAR, 0, 90); // 90 × 650 = 58 500
    d = ops.setActual(d, 'portal', 'kalle', YEAR, 1, 12); // 12 × 1 000 = 12 000
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));

    const headerTotals = () =>
      [...initiativeSection('Portal').querySelectorAll('.initiative-head .totals > div > .label')].map(
        (l) => `${l.textContent}: ${l.nextElementSibling!.textContent}`,
      );
    expect(headerTotals()).toEqual([
      `Avvikelse ${YEAR}: −8 h`, // (90 − 100) + (12 − 10)
      `Utfallskostnad ${YEAR}: 70 500 kr`,
      `Prognos ${YEAR}: 75 000 kr`,
    ]);

    // Nytt utfall slår igenom på utfallskostnaden men inte på prognosen.
    await user.click(screen.getByRole('button', { name: 'Utfall' }));
    await user.type(actualCell('Anna', 'mars', 'Portal'), '20'); // + 13 000
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));
    expect(headerTotals()).toContain(`Utfallskostnad ${YEAR}: 83 500 kr`);
    expect(headerTotals()).toContain(`Prognos ${YEAR}: 75 000 kr`);
  });

  it('utfallet i budgetrutan är grönt t.o.m. 100 % och rött från 101 %, både siffra och stapel', async () => {
    // Kalle kostar 1 000 kr/h och budgeten är 250 000 kr, så 1 h = 0,4 %. Prognosen ligger på 200 %.
    let d = ops.updateInitiative(seed(), 'portal', { internalBudget: 250_000 });
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 0, 500);
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Utfall' }));

    const portal = () => initiativeSection('Portal');
    const actualValue = () => within(portal()).getByText('Utfall', { selector: '.budget .label' }).nextElementSibling!;
    const actualBar = () => portal().querySelector('.budget-bar span.actual')!;
    const expectColor = (percent: string, red: boolean) => {
      expect(actualValue()).toHaveTextContent(percent);
      expect(actualValue().classList.contains('over')).toBe(red);
      expect(actualBar().classList.contains('over')).toBe(red);
    };
    const input = actualCell('Kalle', 'januari', 'Portal');

    expectColor('0 %', false);
    await user.type(input, '125');
    expectColor('50 %', false); // grönt trots att prognosen (200 %) är över budget
    expect(within(portal()).getByText('Prognos', { selector: '.budget .label' }).closest('.budget')).toHaveClass(
      'over-budget',
    );

    for (const [hours, percent, red] of [
      ['250', '100 %', false],
      ['251', '100 %', false], // 100,4 %
      ['252', '101 %', true], // 100,8 %
      ['253', '101 %', true], // 101,2 %
      ['375', '150 %', true],
      ['247', '99 %', false], // 98,8 %
    ] as const) {
      await user.clear(input);
      await user.type(input, hours);
      expectColor(percent, red);
    }

    // Samma regel i jämförelsevyn.
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));
    expectColor('99 %', false);
  });

  it('budgeten visar utfall och prognos i utfallsvyn', async () => {
    let d = ops.updateInitiative(seed(), 'portal', { internalBudget: 100_000 });
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 100); // 65 000
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 1, 40); // 26 000
    d = ops.setActual(d, 'portal', 'anna', YEAR, 0, 60); // 39 000
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    expect(initiativeSection('Portal')).toHaveTextContent('Prognos91 %'); // 65 000 + 26 000 estimerat
    await user.click(screen.getByRole('button', { name: 'Utfall' }));
    expect(initiativeSection('Portal')).toHaveTextContent('Utfall39 %');
    expect(initiativeSection('Portal')).toHaveTextContent('Prognos91 %'); // oförändrad av utfallet
  });

  it('prognosen ändras inte när utfall matas in, rättas eller tas bort – men utfallet gör det', async () => {
    let d = ops.updateInitiative(seed(), 'portal', { internalBudget: 100_000 });
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 100); // 65 000
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 1, 10); // 10 000
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Utfall' }));

    const portal = initiativeSection('Portal');
    const budgetValue = (label: string) =>
      within(portal).getByText(label, { selector: '.budget .label' }).nextElementSibling!.textContent;
    const prognos = () => budgetValue('Prognos');
    const utfall = () => budgetValue('Utfall');
    const statValue = (label: string) => screen.getByText(label).nextElementSibling!.textContent;
    expect(prognos()).toBe('75 %');
    expect(utfall()).toBe('0 %');

    // Varje tangenttryckning sparas direkt – prognosen ska vara 75 % efter varje enskild ändring.
    const anna = actualCell('Anna', 'januari', 'Portal');
    for (const key of ['1', '2', '0', '0']) {
      await user.type(anna, key); // 1 → 12 → 120 → 1200 h
      expect(prognos()).toBe('75 %');
    }
    expect(utfall()).toBe('780 %'); // 1 200 × 650 = 780 000
    expect(within(portal).getByText('Prognos', { selector: '.budget .label' }).closest('.budget')).not.toHaveClass(
      'over-budget',
    );

    await user.clear(anna);
    expect(prognos()).toBe('75 %');
    await user.type(actualCell('Kalle', 'februari', 'Portal'), '0');
    expect(prognos()).toBe('75 %');
    expect(utfall()).toBe('0 %');

    // Jämförelsevyn: prognosen (kostnad) är fortfarande den estimerade kostnaden.
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));
    expect(statValue(`Prognos kostnad ${YEAR}`)).toBe('75 000 kr');
    expect(within(initiativeSection('Portal')).getByText(`Prognos ${YEAR}`).nextElementSibling!.textContent).toBe(
      '75 000 kr',
    );

    // Ändras estimatet ändras prognosen – det är enbart estimatet som styr den.
    await user.click(screen.getByRole('button', { name: 'Estimat' }));
    await user.type(cell('Kalle', 'mars', 'Portal'), '5'); // + 5 000
    expect(
      within(initiativeSection('Portal')).getByText('Prognos', { selector: '.budget .label' }).nextElementSibling!
        .textContent,
    ).toBe('80 %');
  });
});
