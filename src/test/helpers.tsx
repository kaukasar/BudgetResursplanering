import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { ConfirmProvider } from '../components/Confirm';
import * as ops from '../domain/operations';
import { emptyData, type AppData } from '../domain/types';
import { useDataStore } from '../store/store';
import { TEST_SETTINGS } from './domainFixture';
import { DEFAULT_ADMIN_SORT, useUiStore } from '../store/ui';

export const YEAR = 2026;

/** Anna (anställd, 650 kr/h, 160 h) och Kalle (konsult, 1000 kr/h, 100 h). Två initiativ hos Petra, Olle har inga. */
export function seed(): AppData {
  let d: AppData = { ...emptyData(), settings: structuredClone(TEST_SETTINGS) };
  d = ops.addSection(d, { id: 's1', name: 'Sektion 1' });
  d = ops.addSection(d, { id: 's2', name: 'Sektion 2' });
  d = ops.addPerson(d, {
    id: 'anna',
    name: 'Anna',
    type: 'employee',
    sectionId: 's1',
    hourlyRate: null,
    monthlyHours: null,
  });
  d = ops.addPerson(d, {
    id: 'kalle',
    name: 'Kalle',
    type: 'consultant',
    sectionId: 's1',
    hourlyRate: 1000,
    monthlyHours: 100,
  });
  d = ops.addProductOwner(d, { id: 'petra', name: 'Petra', sectionId: 's1' });
  d = ops.addProductOwner(d, { id: 'olle', name: 'Olle', sectionId: 's1' });
  d = ops.addInitiative(d, {
    id: 'portal',
    name: 'Portal',
    productOwnerId: 'petra',
    personIds: ['anna', 'kalle'],
    years: [YEAR],
  });
  d = ops.addInitiative(d, { id: 'app', name: 'App', productOwnerId: 'petra', personIds: ['anna'], years: [YEAR] });
  return d;
}

/** Nollställer sparad data och vyinställningar mellan testerna. */
export function resetStores() {
  localStorage.clear();
  useDataStore.setState({ data: seed() });
  useUiStore.setState({
    year: YEAR,
    view: 'estimate',
    sectionId: '',
    ownerId: '',
    adminTab: 'people',
    adminSort: DEFAULT_ADMIN_SORT,
  });
}

export function renderApp(mode: 'work' | 'admin' = 'work') {
  useUiStore.setState({ mode });
  return render(
    <ConfirmProvider>
      <App />
    </ConfirmProvider>,
  );
}

/** Inmatningscell för estimat. */
export const cell = (person: string, month: string, initiative: string) =>
  screen.getByRole('textbox', { name: `${person} ${month} ${YEAR}, ${initiative}` });

/** Inmatningscell för utfall. */
export const actualCell = (person: string, month: string, initiative: string) =>
  screen.getByRole('textbox', { name: `${person} ${month} ${YEAR}, ${initiative}, utfall` });

export const initiativeSection = (name: string) => screen.getByRole('region', { name: `Initiativ ${name}` });

/** Den öppna dialogen som ligger överst. */
export const topDialog = () => {
  const open = screen.getAllByRole('dialog');
  return open[open.length - 1]!;
};
