import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from '../domain/operations';
import { useDataStore } from '../store/store';
import { actualCell, cell, initiativeSection, renderApp, resetStores, seed, YEAR } from './helpers';

beforeEach(resetStores);

const rowHeader = (initiative: string, name: RegExp) =>
  within(initiativeSection(initiative)).getByRole('rowheader', { name });

describe('låst tid i arbetsläget', () => {
  it('personal som bytt sektion visas med orsaken och tiden kan inte ändras, men räknas med', async () => {
    let d = ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 40);
    d = ops.setEstimate(d, 'portal', 'kalle', YEAR, 0, 10);
    d = ops.updatePerson(d, 'anna', { sectionId: 's2' });
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();

    expect(rowHeader('Portal', /Anna/)).toHaveTextContent('Anna (bytt sektion)');
    const january = cell('Anna', 'januari', 'Portal');
    expect(january).toHaveAttribute('readonly');
    await user.type(january, '5');
    expect(useDataStore.getState().data.estimates.portal?.anna?.[YEAR]?.[0]).toBe(40);

    const footer = within(initiativeSection('Portal')).getAllByRole('row').at(-1)!;
    expect(footer).toHaveTextContent('36 000 kr'); // 40 × 650 + 10 × 1 000
    // App saknade tid för Anna och har ingen personal kvar.
    expect(initiativeSection('App')).toHaveTextContent('Ingen personal är kopplad');

    // I utfallsvyn erbjuds inte "Fyll från estimat" för låst tid.
    await user.click(screen.getByRole('button', { name: 'Utfall' }));
    expect(actualCell('Anna', 'januari', 'Portal')).toHaveAttribute('readonly');
    expect(within(rowHeader('Portal', /Anna/)).queryByRole('button', { name: 'Fyll från estimat' })).toBeNull();
    expect(within(rowHeader('Portal', /Kalle/)).getByRole('button', { name: 'Fyll från estimat' })).toBeEnabled();
  });

  it('raderad personal visas som raderad, räknas inte i kapaciteten och kan inte bli överallokerad', () => {
    let d = ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 200); // över 160 h
    d = ops.deletePerson(d, 'anna');
    useDataStore.setState({ data: d });
    renderApp();

    const anna = rowHeader('Portal', /Anna/);
    expect(anna).toHaveTextContent('Anna (raderad)');
    expect(anna).not.toHaveClass('over');
    expect(cell('Anna', 'januari', 'Portal')).toHaveAttribute('readonly');
    expect(document.querySelector('details.capacity')).not.toHaveTextContent('Anna');
    const overallocated = screen.getByText('Överallokerade personmånader', { selector: '.stat .label' });
    expect(overallocated.nextElementSibling).toHaveTextContent('0');
  });

  it('jämförelsevyn visar orsaken till låst tid', async () => {
    let d = ops.setEstimate(seed(), 'portal', 'anna', YEAR, 0, 40);
    d = ops.deletePerson(d, 'anna');
    useDataStore.setState({ data: d });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Jämförelse' }));
    expect(rowHeader('Portal', /Anna/)).toHaveTextContent('Anna (raderad)');
  });
});
