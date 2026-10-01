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
