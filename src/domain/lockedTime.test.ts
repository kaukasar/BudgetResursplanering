// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { activePeople, linkedPeople, lockReason, storedHoursForInitiative, summarizeInitiative } from './calc';
import { toAnalysisCsv } from './csv';
import * as ops from './operations';
import { parseAppData } from './serialization';
import { EXTERNAL_STAFF, EXTERNAL_STAFF_ID, type AppData } from './types';

const initiative = (d: AppData, id: string) => d.initiatives.find((candidate) => candidate.id === id)!;
const reasonFor = (d: AppData, initiativeId: string, personId: string) => {
  const worker = linkedPeople(d, initiative(d, initiativeId)).find((candidate) => candidate.id === personId)!;
  return lockReason(d, initiative(d, initiativeId), worker);
};

/** Fixturen (Anna och Kalle i Sektion 1 på Portal, Anna även på App) med tid för Anna på Portal. */
function withAnnasTime() {
  let d = domainFixture();
  d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 40);
  d = ops.setActual(d, 'i1', 'anna', 2026, 0, 30);
  return d;
}

describe('låst tid när en person byter sektion', () => {
  it('tiden finns kvar och räknas med, men kan inte ändras', () => {
    const d = ops.updatePerson(withAnnasTime(), 'anna', { sectionId: 's2' });

    expect(reasonFor(d, 'i1', 'anna')).toBe('moved');
    expect(reasonFor(d, 'i1', 'kalle')).toBeNull();
    expect(summarizeInitiative(d, initiative(d, 'i1'), 2026).totalHours).toBe(40);
    expect(summarizeInitiative(d, initiative(d, 'i1'), 2026, 'actual').totalCost).toBe(30 * 650);

    expect(() => ops.setEstimate(d, 'i1', 'anna', 2026, 1, 5)).toThrow(/låst \(bytt sektion\)/);
    expect(() => ops.setActual(d, 'i1', 'anna', 2026, 0, null)).toThrow(/låst/);
    expect(() => ops.fillActualsFromEstimate(d, 'i1', 'anna', 2026, 11)).toThrow(/låst/);
  });

  it('kopplingar utan tid tas bort', () => {
    const d = ops.updatePerson(withAnnasTime(), 'anna', { sectionId: 's2' });
    expect(initiative(d, 'i1').personIds).toContain('anna'); // har tid → låst
    expect(initiative(d, 'i2').personIds).not.toContain('anna'); // saknar tid → bortkopplad
  });

  it('blir redigerbar igen om personen flyttar tillbaka', () => {
    let d = ops.updatePerson(withAnnasTime(), 'anna', { sectionId: 's2' });
    d = ops.updatePerson(d, 'anna', { sectionId: 's1' });
    expect(reasonFor(d, 'i1', 'anna')).toBeNull();
    expect(ops.setEstimate(d, 'i1', 'anna', 2026, 1, 5).estimates.i1?.anna?.[2026]?.[1]).toBe(5);
  });

  it('listar initiativen som påverkas innan bytet', () => {
    expect(ops.initiativesLockedBySectionChange(withAnnasTime(), 'anna', 's2').map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(ops.initiativesLockedBySectionChange(withAnnasTime(), 'anna', 's1')).toEqual([]);
  });
});

describe('låst tid när en person raderas', () => {
  it('personen finns kvar som raderad, tiden räknas men är låst och personen kan inte kopplas igen', () => {
    const d = ops.deletePerson(withAnnasTime(), 'anna');

    expect(activePeople(d).map((person) => person.id)).toEqual(['kalle']);
    expect(reasonFor(d, 'i1', 'anna')).toBe('deleted');
    expect(storedHoursForInitiative(d, 'i1')).toBe(40);
    expect(() => ops.setEstimate(d, 'i1', 'anna', 2026, 1, 1)).toThrow(/låst \(raderad\)/);
    expect(() => ops.updateInitiative(d, 'i2', { personIds: ['kalle', 'anna'] })).toThrow(/raderad/);
  });

  it('namnet kan användas av en ny person, och den raderade märks i CSV-exporten', () => {
    let d = ops.deletePerson(withAnnasTime(), 'anna');
    d = ops.addPerson(d, {
      id: 'anna2',
      name: 'Anna',
      type: 'employee',
      sectionId: 's1',
      hourlyRate: null,
      monthlyHours: null,
    });
    d = ops.updateInitiative(d, 'i1', { personIds: ['kalle', 'anna2'] });
    const csv = toAnalysisCsv(d);
    expect(csv).toContain(';Portal;Anna (raderad);');
    expect(csv).toContain(';Portal;Anna;');
  });
});

describe('initiativ med låst tid', () => {
  it('personer med låst tid finns kvar även om de inte skickas med vid en ändring', () => {
    const d = ops.updatePerson(withAnnasTime(), 'anna', { sectionId: 's2' });
    const updated = ops.updateInitiative(d, 'i1', { personIds: ['kalle', EXTERNAL_STAFF_ID], name: 'Portal 2' });
    expect(initiative(updated, 'i1').personIds).toEqual(['kalle', EXTERNAL_STAFF_ID, 'anna']);
    expect(storedHoursForInitiative(updated, 'i1')).toBe(40);
  });

  it('personal som bytt sektion kan inte kopplas till nya initiativ i den gamla sektionen', () => {
    const d = ops.updatePerson(withAnnasTime(), 'anna', { sectionId: 's2' });
    expect(() => ops.updateInitiative(d, 'i2', { personIds: ['anna'] })).toThrow(/annan sektion/);
  });

  it('Extern personal låses aldrig', () => {
    const d = ops.updateInitiative(domainFixture(), 'i1', { personIds: ['anna', 'kalle', EXTERNAL_STAFF_ID] });
    expect(lockReason(d, initiative(d, 'i1'), EXTERNAL_STAFF)).toBeNull();
  });
});

describe('inläsning av data med låst tid', () => {
  it('raderad personal sparas och läses in via JSON', () => {
    const d = ops.deletePerson(withAnnasTime(), 'anna');
    expect(parseAppData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('raderad personal vars sektion har raderats läses in utan sektion, utan att en standardsektion skapas', () => {
    let d = ops.updatePerson(withAnnasTime(), 'anna', { sectionId: 's2' });
    d = ops.deletePerson(d, 'anna');
    d = ops.deleteSection(d, 's2');
    const parsed = parseAppData(JSON.parse(JSON.stringify(d)));
    expect(parsed).toEqual(d);
    expect(parsed.sections.map((section) => section.id)).toEqual(['s1']);
    expect(reasonFor(parsed, 'i1', 'anna')).toBe('deleted');
  });

  it('äldre data med personal kopplad mellan sektioner låses; kopplingar utan tid tas bort', () => {
    const d = withAnnasTime();
    // Äldre version: Anna hör till Sektion 2 men är kopplad till initiativ i Sektion 1.
    const old = { ...d, people: d.people.map((p) => (p.id === 'anna' ? { ...p, sectionId: 's2' } : p)) };
    const parsed = parseAppData(old);
    expect(reasonFor(parsed, 'i1', 'anna')).toBe('moved');
    expect(storedHoursForInitiative(parsed, 'i1')).toBe(40);
    expect(initiative(parsed, 'i2').personIds).toEqual([]);
  });
});
