import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from '../domain/operations';
import { EXTERNAL_STAFF_ID } from '../domain/types';
import { useDataStore } from '../store/store';
import { renderApp, resetStores, seed, topDialog, withSecondSection, YEAR } from './helpers';

beforeEach(resetStores);

type User = ReturnType<typeof userEvent.setup>;

const openTab = (user: User, name: RegExp | string) => user.click(screen.getByRole('tab', { name }));

/** Klickar Radera på raden som börjar med `name` och bekräftar i dialogen. */
async function deleteRow(user: User, name: string, confirmLabel: string) {
  const row = screen.getByRole('row', { name: new RegExp(`^${name}`) });
  await user.click(within(row).getByRole('button', { name: 'Radera' }));
  await user.click(within(topDialog()).getByRole('button', { name: confirmLabel }));
}

const deletePeople = async (user: User, names: string[]) => {
  await openTab(user, /Personal/);
  for (const name of names) await deleteRow(user, name, 'Radera');
};
const deleteInitiatives = async (user: User, names: string[]) => {
  await openTab(user, /Initiativ/);
  for (const name of names) await deleteRow(user, name, 'Radera initiativ');
};
const deleteOwners = async (user: User, names: string[]) => {
  await openTab(user, /Produktägare/);
  for (const name of names) await deleteRow(user, name, 'Radera');
};
const deleteSections = async (user: User, names: string[]) => {
  await openTab(user, /Sektioner/);
  for (const name of names) await deleteRow(user, name, 'Radera');
};

function expectNoDataLeft() {
  const { sections, people, productOwners, initiatives, estimates, actuals } = useDataStore.getState().data;
  expect({ sections, people, productOwners, initiatives, estimates, actuals }).toEqual({
    sections: [],
    people: [],
    productOwners: [],
    initiatives: [],
    estimates: {},
    actuals: {},
  });
}

/** Seed med registrerad tid, även för Extern personal, och personal och produktägare i Sektion 2. */
function seedWithTime() {
  let data = withSecondSection(seed());
  data = ops.updateInitiative(data, 'portal', { personIds: ['anna', 'kalle', EXTERNAL_STAFF_ID] });
  data = ops.setEstimate(data, 'portal', 'anna', YEAR, 0, 40);
  data = ops.setActual(data, 'portal', 'anna', YEAR, 0, 38);
  data = ops.setEstimate(data, 'portal', EXTERNAL_STAFF_ID, YEAR, 1, 10);
  data = ops.setEstimate(data, 'app', 'anna', YEAR, 2, 20);
  data = ops.addInitiative(data, {
    id: 'lager',
    name: 'Lager',
    productOwnerId: 'stina',
    personIds: ['sara'],
    years: [YEAR],
  });
  data = ops.setEstimate(data, 'lager', 'sara', YEAR, 0, 16);
  return data;
}

describe('manuell radering av all data', () => {
  it('går att radera personal, initiativ, produktägare och till sist sektionerna', async () => {
    useDataStore.setState({ data: seedWithTime() });
    const user = userEvent.setup();
    renderApp('admin');

    await deletePeople(user, ['Anna', 'Kalle', 'Sara']);
    await deleteInitiatives(user, ['App', 'Lager', 'Portal']);
    await deleteOwners(user, ['Olle', 'Petra', 'Stina']);
    await deleteSections(user, ['Sektion 1', 'Sektion 2']);

    expectNoDataLeft();
  });

  it('raderar en sektion utan personal och produktägare även när raderad personal med låst tid finns kvar', async () => {
    let data = ops.setEstimate(withSecondSection(seed()), 'portal', 'anna', YEAR, 0, 40);
    data = ops.updatePerson(data, 'anna', { sectionId: 's2' }); // tiden på Portal i Sektion 1 låses
    useDataStore.setState({ data });
    const user = userEvent.setup();
    renderApp('admin');

    await deletePeople(user, ['Anna', 'Sara']);
    await deleteOwners(user, ['Stina']);
    await deleteSections(user, ['Sektion 2']);

    const after = useDataStore.getState().data;
    expect(after.sections.map((section) => section.name)).toEqual(['Sektion 1']);
    // Annas låsta tid på Portal finns kvar och visas i arbetsläget.
    expect(after.estimates.portal?.anna?.[YEAR]?.[0]).toBe(40);
    await user.click(screen.getByRole('button', { name: 'Arbetsläge' }));
    expect(screen.getByText('Anna (raderad)')).toBeInTheDocument();
  });

  it('går också att radera initiativen före personalen', async () => {
    useDataStore.setState({ data: seedWithTime() });
    const user = userEvent.setup();
    renderApp('admin');

    await deleteInitiatives(user, ['App', 'Lager', 'Portal']);
    await deletePeople(user, ['Anna', 'Kalle', 'Sara']);
    await deleteOwners(user, ['Olle', 'Petra', 'Stina']);
    await deleteSections(user, ['Sektion 1', 'Sektion 2']);

    expectNoDataLeft();
  });
});
