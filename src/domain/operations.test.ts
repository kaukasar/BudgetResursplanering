// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import {
  hoursLostByUpdate,
  initiativeSectionId,
  lockedPersonIds,
  personCapacity,
  storedHoursForInitiative,
} from './calc';
import * as ops from './operations';
import { DEFAULT_SECTION, parseAppData } from './serialization';
import { emptyData, type TajmaClass } from './types';

describe('heltal', () => {
  it('avvisar decimaler i timmar, timkostnad, arbetstid och budget', () => {
    const d = domainFixture();
    expect(() => ops.setEstimate(d, 'i1', 'anna', 2026, 0, 7.5)).toThrow(/heltal/);
    expect(() => ops.setActual(d, 'i1', 'anna', 2026, 0, 0.5)).toThrow(/heltal/);
    expect(() => ops.updatePerson(d, 'anna', { hourlyRate: 650.5 })).toThrow(/heltal/);
    expect(() => ops.updatePerson(d, 'anna', { monthlyHours: 159.5 })).toThrow(/heltal/);
    expect(() => ops.updateTypeSettings(d, 'employee', { hourlyRate: 625.5 })).toThrow(/heltal/);
    expect(() => ops.updateInitiative(d, 'i1', { internalBudget: 1000.5 })).toThrow(/heltal/);
    expect(ops.setEstimate(d, 'i1', 'anna', 2026, 0, 8).estimates.i1?.anna?.[2026]?.[0]).toBe(8);
  });
});

describe('unika namn', () => {
  const person = (id: string, name: string) => ({
    id,
    name,
    type: 'employee' as const,
    sectionId: 's1',
    hourlyRate: null,
    monthlyHours: null,
  });

  it('sektioner har unika namn, utan hänsyn till versaler och omgivande blanksteg', () => {
    const d = domainFixture(); // Sektion 1 och Sektion 2
    expect(() => ops.addSection(d, { id: 's3', name: '  sektion 1 ' })).toThrow(
      'Det finns redan en sektion som heter "sektion 1".',
    );
    expect(() => ops.renameSection(d, 's2', 'SEKTION 1')).toThrow(/redan en sektion/);
    expect(ops.renameSection(d, 's1', 'SEKTION 1').sections[0]!.name).toBe('SEKTION 1');
  });

  it('aktiv personal har unika namn; en raderad persons namn kan användas igen, "Extern personal" aldrig', () => {
    let d = domainFixture(); // Anna och Kalle
    expect(() => ops.addPerson(d, person('anna2', 'ANNA'))).toThrow('Det finns redan en person som heter "ANNA".');
    expect(() => ops.updatePerson(d, 'kalle', { name: 'anna' })).toThrow(/redan en person/);
    expect(() => ops.addPerson(d, person('ext', 'extern personal'))).toThrow(/redan en person/);
    expect(ops.updatePerson(d, 'anna', { name: 'Anna', hourlyRate: 700 }).people[0]!.hourlyRate).toBe(700);

    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10); // tiden gör att den raderade Anna finns kvar
    d = ops.deletePerson(d, 'anna');
    expect(ops.addPerson(d, person('anna2', 'Anna')).people.map((p) => p.name)).toEqual(['Anna', 'Kalle', 'Anna']);
  });

  it('produktägare och initiativ har unika namn', () => {
    const d = domainFixture(); // Petra och Olle; Portal och App
    expect(() => ops.addProductOwner(d, { id: 'po3', name: 'petra', sectionId: 's2' })).toThrow(
      'Det finns redan en produktägare som heter "petra".',
    );
    expect(() => ops.updateProductOwner(d, 'po2', { name: 'Petra' })).toThrow(/redan en produktägare/);
    expect(() =>
      ops.addInitiative(d, { id: 'i3', name: 'portal', productOwnerId: 'po1', personIds: ['anna'], years: [2026] }),
    ).toThrow('Det finns redan ett initiativ som heter "portal".');
    expect(() => ops.updateInitiative(d, 'i2', { name: 'Portal' })).toThrow(/redan ett initiativ/);
    expect(ops.updateInitiative(d, 'i1', { name: 'PORTAL' }).initiatives[0]!.name).toBe('PORTAL');
  });

  it('äldre data med dubbletter går fortfarande att redigera så länge namnet inte ändras', () => {
    const d = domainFixture();
    const withDuplicate = { ...d, people: [...d.people, person('anna2', 'Anna')] };
    expect(ops.updatePerson(withDuplicate, 'anna2', { hourlyRate: 700 }).people[2]!.hourlyRate).toBe(700);
  });
});

describe('tajmaklass', () => {
  it('är tom som standard, kan sättas, ändras och tas bort', () => {
    let d = domainFixture();
    expect(d.initiatives.map((i) => i.tajmaClass)).toEqual([null, null]);
    d = ops.updateInitiative(d, 'i1', { tajmaClass: 'IMM' });
    expect(d.initiatives[0]!.tajmaClass).toBe('IMM');
    // Ändras andra fält lämnas tajmaklassen orörd.
    d = ops.updateInitiative(d, 'i1', { name: 'Nytt namn' });
    expect(d.initiatives[0]!.tajmaClass).toBe('IMM');
    d = ops.updateInitiative(d, 'i1', { tajmaClass: 'Drift' });
    expect(d.initiatives[0]!.tajmaClass).toBe('Drift');
    d = ops.updateInitiative(d, 'i1', { tajmaClass: null });
    expect(d.initiatives[0]!.tajmaClass).toBeNull();
  });

  it('accepterar bara IMM, Vidareutveckling och Drift', () => {
    const d = domainFixture();
    const base = { id: 'n', name: 'Nytt', productOwnerId: 'po1', personIds: ['anna'], years: [2026] };
    for (const value of ['IMM', 'Vidareutveckling', 'Drift'] as const) {
      expect(ops.addInitiative(d, { ...base, tajmaClass: value }).initiatives[2]!.tajmaClass).toBe(value);
    }
    expect(() => ops.addInitiative(d, { ...base, tajmaClass: 'Annat' as TajmaClass })).toThrow(/tajmaklass/);
    expect(() => ops.updateInitiative(d, 'i1', { tajmaClass: 'drift' as TajmaClass })).toThrow(/tajmaklass/);
  });

  it('sparas via JSON; äldre data utan tajmaklass får tomt värde och ogiltiga värden avvisas', () => {
    const d = ops.updateInitiative(domainFixture(), 'i2', { tajmaClass: 'Vidareutveckling' });
    expect(parseAppData(JSON.parse(JSON.stringify(d)))).toEqual(d);
    const old = { ...d, initiatives: d.initiatives.map(({ tajmaClass: _t, ...rest }) => rest) };
    expect(parseAppData(old).initiatives.map((i) => i.tajmaClass)).toEqual([null, null]);
    const invalid = { ...d, initiatives: [{ ...d.initiatives[0]!, tajmaClass: 'Okänd' }] };
    expect(() => parseAppData(invalid)).toThrow(/ogiltig tajmaklass/);
  });
});

describe('sektioner', () => {
  it('personal och produktägare måste tillhöra en befintlig sektion', () => {
    const d = domainFixture();
    expect(() =>
      ops.addPerson(d, {
        id: 'x',
        name: 'X',
        type: 'employee',
        sectionId: 'saknas',
        hourlyRate: null,
        monthlyHours: null,
      }),
    ).toThrow(/sektion/);
    expect(() => ops.addProductOwner(d, { id: 'x', name: 'X', sectionId: '' })).toThrow(/sektion/);
    expect(() => ops.addProductOwner(emptyData(), { id: 'x', name: 'X', sectionId: 's1' })).toThrow(/sektion/);
  });

  it('kan bara raderas när den är tom; allt innehåll flyttas tillsammans till en annan sektion', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    expect(() => ops.deleteSection(d, 's1')).toThrow(/flyttas till en annan sektion/);
    expect(ops.deleteSection(d, 's2').sections.map((s) => s.id)).toEqual(['s1']);

    d = ops.moveSectionContents(d, 's1', 's2');
    expect(new Set([...d.people, ...d.productOwners].map((x) => x.sectionId))).toEqual(new Set(['s2']));
    // Personal, produktägare och initiativ hamnar i samma sektion, så ingen tid låses.
    const portal = d.initiatives.find((i) => i.id === 'i1')!;
    expect(initiativeSectionId(d, portal)).toBe('s2');
    expect(lockedPersonIds(d, portal)).toEqual([]);
    expect(ops.deleteSection(d, 's1').sections.map((s) => s.id)).toEqual(['s2']);
    expect(() => ops.moveSectionContents(d, 's2', 's2')).toThrow(/annan sektion/);
  });

  it('raderad personal med låst tid hindrar inte att sektionen raderas; personen blir utan sektion och tiden finns kvar', () => {
    let d = ops.setEstimate(domainFixture(), 'i1', 'anna', 2026, 0, 40);
    d = ops.updatePerson(d, 'anna', { sectionId: 's2' }); // tiden på Portal (s1) låses
    d = ops.deletePerson(d, 'anna');
    expect(ops.isSectionEmpty(ops.sectionContents(d, 's2'))).toBe(true);

    d = ops.deleteSection(d, 's2');
    expect(d.sections.map((s) => s.id)).toEqual(['s1']);
    const anna = d.people.find((p) => p.id === 'anna')!;
    expect([anna.deleted, anna.sectionId]).toEqual([true, null]);
    expect(storedHoursForInitiative(d, 'i1')).toBe(40);
    expect(lockedPersonIds(d, d.initiatives[0]!)).toEqual(['anna']);
  });

  it('raderad personal följer med när innehållet flyttas till en annan sektion', () => {
    let d = ops.setEstimate(domainFixture(), 'i1', 'anna', 2026, 0, 40);
    d = ops.deletePerson(d, 'anna');
    d = ops.moveSectionContents(d, 's1', 's2');
    expect(d.people.map((p) => p.sectionId)).toEqual(['s2', 's2']);
  });

  it('raderad personal tas bort helt när den låsta tiden försvinner', () => {
    let d = ops.setEstimate(domainFixture(), 'i1', 'anna', 2026, 0, 40);
    d = ops.updatePerson(d, 'anna', { sectionId: 's2' });
    d = ops.deletePerson(d, 'anna');
    d = ops.deleteInitiative(d, 'i1');
    expect(d.people.map((p) => p.id)).toEqual(['kalle']);
    expect(ops.deleteSection(d, 's2').sections.map((s) => s.id)).toEqual(['s1']);
  });

  it('raderad personal utan tid tas bort helt direkt', () => {
    const d = ops.deletePerson(domainFixture(), 'anna');
    expect(d.people.map((p) => p.id)).toEqual(['kalle']);
    expect(d.initiatives.flatMap((initiative) => initiative.personIds)).not.toContain('anna');
  });

  it('raderad personal tas bort när året med dess tid tas bort från initiativet', () => {
    let d = ops.setEstimate(domainFixture(), 'i2', 'anna', 2027, 0, 8); // App gäller 2026–2027
    d = ops.deletePerson(d, 'anna');
    expect(d.people.map((p) => p.id)).toContain('anna');
    d = ops.updateInitiative(d, 'i2', { years: [2026] });
    expect(d.people.map((p) => p.id)).toEqual(['kalle']);
  });

  it('produktägare med initiativ kan inte byta sektion förrän initiativen fått en ny produktägare', () => {
    let d = domainFixture();
    expect(() => ops.updateProductOwner(d, 'po1', { sectionId: 's2' })).toThrow(/ny produktägare/);
    expect(ops.updateProductOwner(d, 'po1', { name: 'Petra L' }).productOwners[0]!.name).toBe('Petra L');

    d = ops.updateInitiative(d, 'i1', { productOwnerId: 'po2' });
    d = ops.updateInitiative(d, 'i2', { productOwnerId: 'po2' });
    d = ops.updateProductOwner(d, 'po1', { sectionId: 's2' });
    // Initiativen stannar i sin sektion med sin personal.
    expect(d.initiatives.map((i) => initiativeSectionId(d, i))).toEqual(['s1', 's1']);
    expect(d.initiatives[0]!.personIds).toEqual(['anna', 'kalle']);
  });

  it('initiativ kan bara byta till en produktägare i samma sektion', () => {
    let d = domainFixture();
    d = ops.addProductOwner(d, { id: 'po3', name: 'Stina', sectionId: 's2' });
    expect(() => ops.updateInitiative(d, 'i1', { productOwnerId: 'po3' })).toThrow(/samma sektion/);
    expect(ops.updateInitiative(d, 'i1', { productOwnerId: 'po2' }).initiatives[0]!.productOwnerId).toBe('po2');
  });

  it('personal kan bara kopplas till initiativ i sin egen sektion', () => {
    let d = domainFixture();
    d = ops.addProductOwner(d, { id: 'po3', name: 'Stina', sectionId: 's2' });
    const base = { id: 'i3', name: 'Annan sektion', productOwnerId: 'po3', years: [2026] };
    expect(() => ops.addInitiative(d, { ...base, personIds: ['anna'] })).toThrow(/annan sektion/);
    d = ops.addPerson(d, {
      id: 'bo',
      name: 'Bo',
      type: 'employee',
      sectionId: 's2',
      hourlyRate: null,
      monthlyHours: null,
    });
    d = ops.addInitiative(d, { ...base, personIds: ['bo'] });
    expect(() => ops.updateInitiative(d, 'i3', { personIds: ['bo', 'anna'] })).toThrow(/annan sektion/);
  });

  it('överallokering räknas över alla initiativ där personen förekommer', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 100);
    d = ops.setEstimate(d, 'i2', 'anna', 2026, 0, 70);
    expect(personCapacity(d, d.people[0]!, 2026).monthTotals[0]).toBe(170);
    expect(personCapacity(d, d.people[0]!, 2026).overallocated[0]).toBe(true);
  });

  it('äldre data utan sektioner flyttas in i en standardsektion', () => {
    const d = domainFixture();
    const old = {
      settings: d.settings,
      people: d.people.map(({ sectionId: _s, ...p }) => p),
      productOwners: d.productOwners.map(({ sectionId: _s, ...o }) => o),
      initiatives: d.initiatives,
      hours: d.estimates,
    };
    const migrated = parseAppData(old);
    expect(migrated.sections).toEqual([DEFAULT_SECTION]);
    expect(new Set([...migrated.people, ...migrated.productOwners].map((x) => x.sectionId))).toEqual(
      new Set([DEFAULT_SECTION.id]),
    );
    // Befintlig data med sektioner lämnas orörd, men okända sektioner avvisas.
    expect(parseAppData(d).sections.map((s) => s.id)).toEqual(['s1', 's2']);
    const broken = { ...d, people: [{ ...d.people[0]!, sectionId: 'okänd' }] };
    expect(() => parseAppData(broken)).toThrow(/okänd sektion/);
  });
});

describe('personal', () => {
  it('kräver namn och icke-negativa värden', () => {
    const d = domainFixture();
    expect(() =>
      ops.addPerson(d, {
        id: 'x',
        name: '  ',
        type: 'employee',
        sectionId: 's1',
        hourlyRate: null,
        monthlyHours: null,
      }),
    ).toThrow(ops.DomainError);
    expect(() =>
      ops.addPerson(d, { id: 'x', name: 'X', type: 'employee', sectionId: 's1', hourlyRate: -1, monthlyHours: null }),
    ).toThrow(ops.DomainError);
  });

  it('radering behåller personens tid men låser den; kopplingar utan tid tas bort', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 5);
    d = ops.deletePerson(d, 'anna');

    expect(d.people.find((p) => p.id === 'anna')).toMatchObject({ name: 'Anna', deleted: true });
    expect(d.initiatives.map((i) => i.personIds)).toEqual([['anna', 'kalle'], []]); // i2: Anna utan tid
    expect(storedHoursForInitiative(d, 'i1')).toBe(15);
    expect(() => ops.setEstimate(d, 'i1', 'anna', 2026, 1, 1)).toThrow(/låst \(raderad\)/);
    expect(() => ops.updatePerson(d, 'anna', { name: 'Ny' })).toThrow(/raderad/);
  });
});

describe('produktägare', () => {
  it('kan inte raderas så länge initiativ är kopplade', () => {
    const d = domainFixture();
    expect(() => ops.deleteProductOwner(d, 'po1')).toThrow(/2 initiativ som först måste få en ny produktägare/);
  });

  it('kan raderas när initiativen fått en ny produktägare eller raderats', () => {
    let d = domainFixture();
    d = ops.updateInitiative(d, 'i1', { productOwnerId: 'po2' });
    d = ops.deleteInitiative(d, 'i2');
    d = ops.deleteProductOwner(d, 'po1');
    expect(d.productOwners.map((o) => o.id)).toEqual(['po2']);
  });

  it('produktägare utan initiativ kan raderas direkt', () => {
    expect(ops.deleteProductOwner(domainFixture(), 'po2').productOwners).toHaveLength(1);
  });
});

describe('initiativ', () => {
  it('kräver exakt en giltig produktägare, minst ett år och minst en person vid skapande', () => {
    const d = domainFixture();
    const base = { id: 'n', name: 'Nytt', productOwnerId: 'po1', personIds: ['anna'], years: [2026] };
    expect(() => ops.addInitiative(d, { ...base, productOwnerId: 'saknas' })).toThrow(/produktägare/);
    expect(() => ops.addInitiative(d, { ...base, years: [] })).toThrow(/minst ett år/);
    expect(() => ops.addInitiative(d, { ...base, personIds: [] })).toThrow(/minst en person/);
    expect(ops.addInitiative(d, base).initiatives).toHaveLength(3);
  });

  it('får ha all personal borttagen efter att det skapats', () => {
    const d = ops.updateInitiative(domainFixture(), 'i1', { personIds: [] });
    expect(d.initiatives[0]!.personIds).toEqual([]);
  });

  it('raderar timmar för personer som tas bort från initiativet', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 5);
    d = ops.updateInitiative(d, 'i1', { personIds: ['kalle'] });
    expect(storedHoursForInitiative(d, 'i1')).toBe(5);

    // Återkopplad person börjar om från noll.
    d = ops.updateInitiative(d, 'i1', { personIds: ['kalle', 'anna'] });
    expect(storedHoursForInitiative(d, 'i1')).toBe(5);
  });

  it('raderar timmar för år som tas bort från initiativet', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i2', 'anna', 2026, 0, 10);
    d = ops.setEstimate(d, 'i2', 'anna', 2027, 0, 20);
    d = ops.updateInitiative(d, 'i2', { years: [2027] });
    expect(storedHoursForInitiative(d, 'i2')).toBe(20);
  });

  it('beräknar vilka timmar som går förlorade vid ändring, utan att dubbelräkna', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i2', 'anna', 2026, 0, 10);
    d = ops.setEstimate(d, 'i2', 'anna', 2027, 0, 20);
    const i2 = d.initiatives[1]!;

    expect(hoursLostByUpdate(d, i2, { personIds: ['anna'], years: [2026, 2027] })).toEqual({ people: [], years: [] });
    expect(hoursLostByUpdate(d, i2, { personIds: ['anna'], years: [2027] })).toEqual({
      people: [],
      years: [{ year: 2026, estimate: 10, actual: 0 }],
    });
    // Person och år tas bort samtidigt: timmarna räknas bara under personen.
    expect(hoursLostByUpdate(d, i2, { personIds: [], years: [2027] })).toEqual({
      people: [{ personId: 'anna', estimate: 30, actual: 0 }],
      years: [],
    });
  });

  it('kan raderas oavsett kopplade timmar', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    d = ops.deleteInitiative(d, 'i1');
    expect(d.initiatives.map((i) => i.id)).toEqual(['i2']);
    expect(d.estimates.i1).toBeUndefined();
  });
});

describe('tidsregistrering', () => {
  it('avvisar negativa timmar, okopplade personer och år utanför initiativet', () => {
    const d = domainFixture();
    expect(() => ops.setEstimate(d, 'i1', 'anna', 2026, 0, -1)).toThrow(ops.DomainError);
    expect(() => ops.setEstimate(d, 'i2', 'kalle', 2026, 0, 1)).toThrow(/inte kopplad/);
    expect(() => ops.setEstimate(d, 'i1', 'anna', 2027, 0, 1)).toThrow(/gäller inte 2027/);
  });

  it('muterar inte ursprungsdata', () => {
    const d = domainFixture();
    const snapshot = JSON.stringify(d);
    ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});
