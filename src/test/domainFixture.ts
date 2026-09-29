import * as ops from '../domain/operations';
import { emptyData, type AppData } from '../domain/types';

/** Bygger en liten testdatamängd: 2 personer, 1 produktägare, 2 initiativ år 2026. */
export function domainFixture(): AppData {
  let d = emptyData();
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
  d = ops.addProductOwner(d, { id: 'po1', name: 'Petra', sectionId: 's1' });
  d = ops.addProductOwner(d, { id: 'po2', name: 'Olle', sectionId: 's1' });
  d = ops.addInitiative(d, {
    id: 'i1',
    name: 'Portal',
    productOwnerId: 'po1',
    personIds: ['anna', 'kalle'],
    years: [2026],
  });
  d = ops.addInitiative(d, { id: 'i2', name: 'App', productOwnerId: 'po1', personIds: ['anna'], years: [2026, 2027] });
  return d;
}
