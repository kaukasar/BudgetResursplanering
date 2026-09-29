import { getMonthEstimates, lastCompletedMonth } from './calc';
import * as ops from './operations';
import { emptyData, type AppData, type PersonType, type TajmaClass } from './types';

/** Skapar en liten exempeldatamängd för att prova applikationen. */
export function sampleData(
  year = new Date().getFullYear(),
  newId: () => string = () => crypto.randomUUID(),
  today = new Date(),
): AppData {
  let data = emptyData();

  const section = (name: string) => {
    const id = newId();
    data = ops.addSection(data, { id, name });
    return id;
  };
  const person = (
    name: string,
    type: PersonType,
    sectionId: string,
    hourlyRate: number | null = null,
    monthlyHours: number | null = null,
  ) => {
    const id = newId();
    data = ops.addPerson(data, { id, name, type, sectionId, hourlyRate, monthlyHours });
    return id;
  };
  const owner = (name: string, sectionId: string) => {
    const id = newId();
    data = ops.addProductOwner(data, { id, name, sectionId });
    return id;
  };
  const initiative = (
    name: string,
    productOwnerId: string,
    personIds: string[],
    years: number[],
    budget: number | null = null,
    tajmaClass: TajmaClass | null = null,
  ) => {
    const id = newId();
    data = ops.addInitiative(data, { id, name, productOwnerId, personIds, years, budget, tajmaClass });
    return id;
  };
  const plan = (initiativeId: string, personId: string, planYear: number, months: number[]) => {
    months.forEach((hours, month) => {
      if (hours > 0) data = ops.setEstimate(data, initiativeId, personId, planYear, month, hours);
    });
  };

  const digitalSection = section('Digitala kanaler');
  const dataSection = section('Data & Analys');

  const anna = person('Anna Andersson', 'employee', digitalSection);
  const bengt = person('Bengt Berg', 'employee', dataSection, 720);
  const cecilia = person('Cecilia Chen', 'consultant', digitalSection);
  const david = person('David Dahl', 'consultant', digitalSection, 1250, 120);
  const eva = person('Eva Ek', 'employee', dataSection, null, 128);

  const maria = owner('Maria Lind', digitalSection);
  const johan = owner('Johan Sjö', dataSection);

  // Bengt (Data & Analys) lånas ut till Mobilapp och David (Digitala kanaler) till Datalager & BI.
  const portal = initiative(
    'Kundportal 2.0',
    maria,
    [anna, cecilia, david],
    [year, year + 1],
    3_500_000,
    'Vidareutveckling',
  );
  const app = initiative('Mobilapp', maria, [anna, bengt], [year], 1_200_000, 'IMM'); // planerat över budget
  const bi = initiative('Datalager & BI', johan, [bengt, eva, david], [year]);

  // Estimerade timmar per månad, januari–december.
  plan(portal, anna, year, [80, 80, 100, 100, 80, 60, 0, 40, 80, 80, 80, 40]);
  plan(portal, cecilia, year, [160, 160, 160, 160, 160, 120, 0, 80, 160, 160, 160, 80]);
  plan(portal, david, year, [40, 40, 60, 60, 60, 40, 0, 20, 60, 60, 60, 20]);
  plan(portal, anna, year + 1, [60, 60, 60, 40, 0, 0, 0, 0, 0, 0, 0, 0]);
  plan(app, anna, year, [60, 60, 80, 60, 60, 40, 0, 40, 60, 60, 60, 40]); // mar: 180 h totalt → överallokerad
  plan(app, bengt, year, [120, 120, 120, 120, 120, 80, 0, 60, 120, 120, 120, 60]);
  plan(bi, bengt, year, [40, 40, 40, 40, 40, 40, 0, 40, 40, 40, 40, 40]);
  plan(bi, eva, year, [100, 100, 100, 100, 100, 80, 0, 60, 100, 100, 100, 60]);
  plan(bi, david, year, [60, 60, 60, 60, 60, 40, 0, 40, 60, 80, 60, 40]); // okt: 140 h > 120 h → överallokerad

  // Utfall för avslutade månader, med viss avvikelse mot estimatet.
  // Cecilia ligger konsekvent över estimatet på Kundportal 2.0.
  const reportedMonthCount = lastCompletedMonth(year, today) + 1;
  const variation = [0, 4, -8, 2, 6, -4, 0, 3, -2, 5, -6, 1];
  const report = (initiativeId: string, personId: string, offset: number, bias = 0) => {
    const estimate = getMonthEstimates(data, initiativeId, personId, year);
    for (let month = 0; month < reportedMonthCount; month++) {
      const planned = estimate[month]!;
      const actual = planned === 0 ? 0 : Math.max(0, planned + variation[(month + offset) % 12]! + bias);
      data = ops.setActual(data, initiativeId, personId, year, month, actual);
    }
  };
  report(portal, anna, 0);
  report(portal, cecilia, 3, 8);
  report(portal, david, 5);
  report(app, anna, 7);
  report(app, bengt, 2);
  report(bi, bengt, 9);
  report(bi, eva, 4, -6);
  report(bi, david, 11);

  return data;
}
