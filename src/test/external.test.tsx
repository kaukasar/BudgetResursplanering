import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from '../domain/operations';
import { EXTERNAL_STAFF_ID } from '../domain/types';
import { useDataStore } from '../store/store';
import { cell, initiativeSection, renderApp, resetStores, seed, topDialog, YEAR } from './helpers';

beforeEach(resetStores);

/** Seed där Extern personal är kopplad till Portal. Schablonen blir (650 + 1 100) / 2 = 875 kr/h. */
const seedWithExternalStaff = () =>
  ops.updateInitiative(seed(), 'portal', { personIds: ['anna', 'kalle', EXTERNAL_STAFF_ID] });

describe('Extern personal i arbetsläget', () => {
  it('visas som sista rad med schablontimkostnad och räknas med i summor och kostnad', async () => {
    useDataStore.setState({ data: seedWithExternalStaff() });
    const user = userEvent.setup();
    renderApp();

    const portal = initiativeSection('Portal');
    const rows = within(portal).getAllByRole('row');
    const externalRow = rows.at(-2)!; // sista raden före summeringsraden
    expect(externalRow).toHaveTextContent('Extern personal');
    expect(externalRow).toHaveTextContent('Extern · schablon 875 kr/h');

    await user.type(cell('Extern personal', 'januari', 'Portal'), '20');
    expect(externalRow).toHaveTextContent('17 500 kr'); // 20 × 875
    const footer = rows.at(-1)!;
    expect(footer).toHaveTextContent('17 500 kr');
  });

  it('blir aldrig överallokerad, oavsett antal timmar', async () => {
    useDataStore.setState({ data: seedWithExternalStaff() });
    const user = userEvent.setup();
    renderApp();

    await user.type(cell('Extern personal', 'mars', 'Portal'), '500');
    const externalCell = cell('Extern personal', 'mars', 'Portal').closest('td')!;
    expect(externalCell).not.toHaveClass('over');
    expect(within(initiativeSection('Portal')).getByText('Extern personal').closest('th')).not.toHaveClass('over');

    const overallocated = screen.getByText('Överallokerade personmånader', { selector: '.stat .label' });
    expect(overallocated.nextElementSibling).toHaveTextContent('0');
    // Kapacitetsöversikten visar bara vanlig personal.
    const capacity = document.querySelector('details.capacity')!;
    expect(capacity).toHaveTextContent('Ingen överallokering');
    expect(capacity).not.toHaveTextContent('Extern personal');
  });
});

describe('kostnaden i tabellhuvudet', () => {
  const headerFigures = (initiative: string) =>
    [...initiativeSection(initiative).querySelectorAll('.initiative-head .totals > div > .label')].map(
      (label) => `${label.textContent}: ${label.nextElementSibling!.textContent}`,
    );

  it('delas upp i intern och extern prognos och utfall i alla vyer', async () => {
    let d = seedWithExternalStaff();
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 20); // 13 000
    d = ops.setEstimate(d, 'portal', EXTERNAL_STAFF_ID, YEAR, 0, 10); // 8 750
    d = ops.setActual(d, 'portal', 'anna', YEAR, 0, 10); // 6 500
    d = ops.setActual(d, 'portal', EXTERNAL_STAFF_ID, YEAR, 0, 4); // 3 500
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    // Timmar och total kostnad visas inte i rubriken, bara i totalkolumnen och summeringsraden.
    expect(headerFigures('Portal')).toEqual([`Prognos intern ${YEAR}: 13 000 kr`, `Prognos extern ${YEAR}: 8 750 kr`]);
    const rows = within(initiativeSection('Portal')).getAllByRole('row');
    const totalCell = (row: HTMLElement) => row.querySelector('td.total')!.textContent;
    expect(totalCell(rows.find((row) => within(row).queryByText('Anna'))!)).toBe('20 h');
    expect(totalCell(rows.at(-1)!)).toBe('30 h');
    expect(rows.at(-1)).toHaveTextContent('21 750 kr');

    await user.click(screen.getByRole('button', { name: 'Utfall' }));
    expect(headerFigures('Portal')).toEqual([`Utfall intern ${YEAR}: 6 500 kr`, `Utfall extern ${YEAR}: 3 500 kr`]);
    expect(within(initiativeSection('Portal')).getAllByRole('row').at(-1)!.querySelector('td.total')).toHaveTextContent(
      '14 h',
    );

    // Jämförelsevyn visar både utfall och prognos, men inte avvikelsen (den syns i summeringsraden).
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));
    expect(headerFigures('Portal')).toEqual([
      `Utfall intern ${YEAR}: 6 500 kr`,
      `Utfall extern ${YEAR}: 3 500 kr`,
      `Prognos intern ${YEAR}: 13 000 kr`,
      `Prognos extern ${YEAR}: 8 750 kr`,
    ]);
    const footerTotals = [
      ...within(initiativeSection('Portal')).getAllByRole('row').at(-1)!.querySelectorAll('td.total'),
    ];
    expect(footerTotals.map((cell) => cell.textContent)).toEqual(['30 h', '14 h', '−16−53 %']);
  });

  it('den externa kostnaden visas bara när Extern personal är kopplad', () => {
    useDataStore.setState({ data: ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 20) });
    renderApp();
    expect(headerFigures('Portal')).toEqual([`Prognos intern ${YEAR}: 13 000 kr`]);
  });
});

describe('intern och extern budget i tabellhuvudet', () => {
  it('visas var för sig: intern mot personal i sektionen, extern mot Extern personal', async () => {
    let d = ops.updateInitiative(seedWithExternalStaff(), 'portal', {
      internalBudget: 100_000,
      externalBudget: 10_000,
    });
    d = ops.setEstimate(d, 'portal', 'anna', YEAR, 0, 40); // 26 000 → 26 % av den interna
    d = ops.setEstimate(d, 'portal', EXTERNAL_STAFF_ID, YEAR, 0, 8); // 7 000 → 70 % av den externa
    d = ops.setActual(d, 'portal', EXTERNAL_STAFF_ID, YEAR, 0, 12); // 10 500 → 105 % av den externa
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    const part = (name: string) => within(initiativeSection('Portal')).getByRole('group', { name });
    expect(part('Intern budget')).toHaveTextContent('Intern budget100 000 kr');
    expect(part('Intern budget')).toHaveTextContent('Prognos26 %');
    expect(part('Extern budget')).toHaveTextContent('Extern budget10 000 kr');
    expect(part('Extern budget')).toHaveTextContent('Prognos70 %');

    await user.click(screen.getByRole('button', { name: 'Utfall' }));
    expect(part('Intern budget')).toHaveTextContent('Utfall0 %');
    const externalActual = within(part('Extern budget')).getByText('Utfall', {
      selector: '.label',
    }).nextElementSibling!;
    expect(externalActual).toHaveTextContent('105 %');
    expect(externalActual).toHaveClass('over'); // rött från 101 %, per budgetdel
    expect(within(part('Intern budget')).getByRole('progressbar')).toHaveAccessibleName(
      'Utfall och prognos av den interna budgeten för Portal',
    );
  });
});

describe('Extern personal i adminläget', () => {
  it('kopplas med en egen kryssruta som inte räknas som en person och inte påverkas av sektionsfiltret', async () => {
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(screen.getByRole('button', { name: '+ Nytt initiativ' }));
    const dialog = topDialog();

    await user.type(within(dialog).getByRole('textbox', { name: 'Namn' }), 'Nytt');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Produktägare' }), 'Olle');
    const external = within(dialog).getByRole('checkbox', { name: /Extern personal/ });
    expect(external.closest('label')).toHaveTextContent('schablon 875 kr/h');
    await user.click(external);
    await user.click(within(dialog).getByRole('button', { name: 'Skapa initiativ' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Koppla minst en person');

    await user.click(within(dialog).getByRole('checkbox', { name: /Anna/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Skapa initiativ' }));
    const created = useDataStore.getState().data.initiatives.find((i) => i.name === 'Nytt')!;
    expect(created.personIds).toEqual([EXTERNAL_STAFF_ID, 'anna']);
    expect(screen.getByRole('row', { name: /^Nytt/ })).toHaveTextContent('Anna, Extern personal');
  });

  it('varnar när Extern personal med timmar kopplas bort', async () => {
    useDataStore.setState({ data: ops.setEstimate(seedWithExternalStaff(), 'portal', EXTERNAL_STAFF_ID, YEAR, 0, 30) });
    const user = userEvent.setup();
    renderApp('admin');
    await user.click(screen.getByRole('tab', { name: /Initiativ/ }));
    await user.click(within(screen.getByRole('row', { name: /^Portal/ })).getByRole('button', { name: 'Redigera' }));

    const form = topDialog();
    const external = within(form).getByRole('checkbox', { name: /Extern personal/ });
    expect(external).toBeChecked();
    expect(external.closest('label')).toHaveTextContent('30 h estimat');
    await user.click(external);
    await user.click(within(form).getByRole('button', { name: 'Spara' }));

    expect(topDialog()).toHaveTextContent('Extern personal: 30 h estimat (tas bort från initiativet)');
    await user.click(within(topDialog()).getByRole('button', { name: 'Spara och radera timmar' }));
    const data = useDataStore.getState().data;
    expect(data.initiatives[0]!.personIds).toEqual(['anna', 'kalle']);
    expect(data.estimates.portal?.[EXTERNAL_STAFF_ID]).toBeUndefined();
  });

  it('visas inte i personalfliken men timkostnaden visas under Inställningar och följer standardvärdena', async () => {
    useDataStore.setState({ data: seedWithExternalStaff() });
    const user = userEvent.setup();
    renderApp('admin');
    expect(screen.queryByRole('row', { name: /Extern personal/ })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Inställningar' }));
    const external = screen.getByRole('region', { name: 'Extern personal' });
    expect(external).toHaveTextContent('875 kr/h');
    expect(external).toHaveTextContent('Inget tak');
    expect(external).toHaveTextContent('1 initiativ');

    const consultant = screen.getByRole('region', { name: 'Konsult' });
    const rate = within(consultant).getByRole('textbox', { name: 'Timkostnad' });
    await user.clear(rate);
    await user.type(rate, '1250');
    expect(external).toHaveTextContent('950 kr/h'); // (650 + 1 250) / 2
  });
});
