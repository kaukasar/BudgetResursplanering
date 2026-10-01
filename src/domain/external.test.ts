// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { effectiveRate, externalHourlyRate, hoursLostByUpdate, linkedPeople, summarizeInitiative } from './calc';
import { compareInitiative } from './comparison';
import { toAnalysisCsv } from './csv';
import * as ops from './operations';
import { parseAppData } from './serialization';
import { emptyData, EXTERNAL_STAFF, EXTERNAL_STAFF_ID } from './types';

/** Fixturen (anställd 650, konsult 1 100 kr/h) med Extern personal kopplad till Portal (i1). */
function withExternalStaff() {
  const d = domainFixture();
  return ops.updateInitiative(d, 'i1', { personIds: ['anna', 'kalle', EXTERNAL_STAFF_ID] });
}

describe('Extern personal', () => {
  it('har en schablontimkostnad mitt emellan anställd och konsult, avrundad till heltal', () => {
    expect(externalHourlyRate(emptyData().settings)).toBe(878); // (625 + 1 130) / 2 = 877,5
    expect(externalHourlyRate(domainFixture().settings)).toBe(875); // (650 + 1 100) / 2

    // Följer med när standardvärdena ändras.
    const d = ops.updateTypeSettings(domainFixture(), 'consultant', { hourlyRate: 1250 });
    expect(effectiveRate(EXTERNAL_STAFF, d.settings)).toBe(950);
  });

  it('visas sist bland initiativets personal och räknas med i timmar och kostnad', () => {
    let d = withExternalStaff();
    d = ops.setEstimate(d, 'i1', EXTERNAL_STAFF_ID, 2026, 0, 10);
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 20);
    const initiative = d.initiatives.find((i) => i.id === 'i1')!;

    expect(linkedPeople(d, initiative).map((worker) => worker.id)).toEqual(['anna', 'kalle', EXTERNAL_STAFF_ID]);
    const summary = summarizeInitiative(d, initiative, 2026);
    expect(summary.rows.at(-1)).toMatchObject({ person: EXTERNAL_STAFF, rate: 875, totalHours: 10, totalCost: 8750 });
    expect(summary.totalHours).toBe(30);
    expect(summary.totalCost).toBe(20 * 650 + 10 * 875);
  });

  it('har både estimat och utfall och jämförs som övrig personal', () => {
    let d = withExternalStaff();
    d = ops.setEstimate(d, 'i1', EXTERNAL_STAFF_ID, 2026, 0, 10);
    d = ops.setActual(d, 'i1', EXTERNAL_STAFF_ID, 2026, 0, 14);
    const initiative = d.initiatives.find((i) => i.id === 'i1')!;

    expect(summarizeInitiative(d, initiative, 2026, 'actual').totalCost).toBe(14 * 875);
    const external = compareInitiative(d, initiative, 2026).people.at(-1)!;
    expect(external.person).toBe(EXTERNAL_STAFF);
    expect(external.deviation.diff).toBe(4);
  });

  it('räknas inte som en person i kravet på minst en kopplad person i ett nytt initiativ', () => {
    const d = domainFixture();
    const base = { id: 'ny', name: 'Ny', productOwnerId: 'po1', years: [2026] };
    expect(() => ops.addInitiative(d, { ...base, personIds: [EXTERNAL_STAFF_ID] })).toThrow(/minst en person/);
    const created = ops.addInitiative(d, { ...base, personIds: [EXTERNAL_STAFF_ID, 'anna'] });
    expect(created.initiatives.at(-1)!.personIds).toEqual([EXTERNAL_STAFF_ID, 'anna']);
  });

  it('raderar sina timmar när den kopplas bort från initiativet', () => {
    let d = withExternalStaff();
    d = ops.setEstimate(d, 'i1', EXTERNAL_STAFF_ID, 2026, 0, 10);
    d = ops.setActual(d, 'i1', EXTERNAL_STAFF_ID, 2026, 0, 12);
    const initiative = d.initiatives.find((i) => i.id === 'i1')!;

    expect(hoursLostByUpdate(d, initiative, { personIds: ['anna', 'kalle'], years: [2026] }).people).toEqual([
      { personId: EXTERNAL_STAFF_ID, estimate: 10, actual: 12 },
    ]);
    const updated = ops.updateInitiative(d, 'i1', { personIds: ['anna', 'kalle'] });
    expect(updated.estimates.i1?.[EXTERNAL_STAFF_ID]).toBeUndefined();
    expect(updated.actuals.i1?.[EXTERNAL_STAFF_ID]).toBeUndefined();
  });

  it('id:t är reserverat och kan inte användas av vanlig personal', () => {
    const person = { name: 'X', type: 'employee', sectionId: 's1', hourlyRate: null, monthlyHours: null } as const;
    expect(() => ops.addPerson(domainFixture(), { ...person, id: EXTERNAL_STAFF_ID })).toThrow(/reserverat/);

    const d = domainFixture();
    const imported = { ...d, people: [...d.people, { ...person, id: EXTERNAL_STAFF_ID }] };
    expect(() => parseAppData(imported)).toThrow(/reserverat/);
  });

  it('sparas och läses in via JSON', () => {
    let d = withExternalStaff();
    d = ops.setEstimate(d, 'i1', EXTERNAL_STAFF_ID, 2026, 2, 10);
    d = ops.setActual(d, 'i1', EXTERNAL_STAFF_ID, 2026, 2, 8);
    expect(parseAppData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('exporteras till CSV som Extern utan sektion och arbetstid, och aldrig överallokerad', () => {
    let d = withExternalStaff();
    d = ops.setEstimate(d, 'i1', EXTERNAL_STAFF_ID, 2026, 2, 500); // långt över 160 h, men inget tak
    d = ops.setActual(d, 'i1', EXTERNAL_STAFF_ID, 2026, 2, 400);
    const lines = toAnalysisCsv(d).replace('﻿', '').trim().split('\r\n');

    expect(lines).toContain(
      '2026;3;mars;Sektion 1;Petra;Portal;Extern personal;;Extern;500;400;-100;875;437500;350000;;;Nej',
    );
    expect(lines.filter((line) => line.includes(';Extern personal;'))).toHaveLength(12);
  });
});
