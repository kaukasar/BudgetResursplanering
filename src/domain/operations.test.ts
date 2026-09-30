// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { hoursLostByUpdate, initiativeSectionId, personCapacity, storedHoursForInitiative } from './calc';
import * as ops from './operations';
import { DEFAULT_SECTION, parseAppData } from './serialization';
import { emptyData, isEmptyData, type TajmaClass } from './types';

describe('heltal', () => {
  it('avvisar decimaler i timmar, timkostnad, arbetstid och budget', () => {
    const d = domainFixture();
    expect(() => ops.setEstimate(d, 'i1', 'anna', 2026, 0, 7.5)).toThrow(/heltal/);
    expect(() => ops.setActual(d, 'i1', 'anna', 2026, 0, 0.5)).toThrow(/heltal/);
    expect(() => ops.updatePerson(d, 'anna', { hourlyRate: 650.5 })).toThrow(/heltal/);
    expect(() => ops.updatePerson(d, 'anna', { monthlyHours: 159.5 })).toThrow(/heltal/);
    expect(() => ops.updateTypeSettings(d, 'employee', { hourlyRate: 625.5 })).toThrow(/heltal/);
    expect(() => ops.updateInitiative(d, 'i1', { budget: 1000.5 })).toThrow(/heltal/);
    expect(ops.setEstimate(d, 'i1', 'anna', 2026, 0, 8).estimates.i1?.anna?.[2026]?.[0]).toBe(8);
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

  it('kan bara raderas när den saknar personal och produktägare', () => {
    let d = domainFixture();
    expect(() => ops.deleteSection(d, 's1')).toThrow(/måste flyttas eller raderas/);
    expect(ops.deleteSection(d, 's2').sections.map((s) => s.id)).toEqual(['s1']);

    d = ops.updatePerson(d, 'anna', { sectionId: 's2' });
    d = ops.updatePerson(d, 'kalle', { sectionId: 's2' });
    d = ops.updateProductOwner(d, 'po1', { sectionId: 's2' });
    d = ops.updateProductOwner(d, 'po2', { sectionId: 's2' });
    expect(ops.deleteSection(d, 's1').sections.map((s) => s.id)).toEqual(['s2']);
  });

  it('initiativ följer produktägarens sektion', () => {
    let d = domainFixture();
    const portal = () => d.initiatives.find((i) => i.id === 'i1')!;
    expect(initiativeSectionId(d, portal())).toBe('s1');
    d = ops.updateProductOwner(d, 'po1', { sectionId: 's2' });
    expect(initiativeSectionId(d, portal())).toBe('s2');
    expect(ops.sectionContents(d, 's2').initiatives.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('initiativ kan bara byta till en produktägare i samma sektion', () => {
    let d = domainFixture();
    d = ops.addProductOwner(d, { id: 'po3', name: 'Stina', sectionId: 's2' });
    expect(() => ops.updateInitiative(d, 'i1', { productOwnerId: 'po3' })).toThrow(/samma sektion/);
    expect(ops.updateInitiative(d, 'i1', { productOwnerId: 'po2' }).initiatives[0]!.productOwnerId).toBe('po2');
  });

  it('personal kan lånas ut till andra sektioner och överallokering räknas över alla sektioner', () => {
    let d = domainFixture();
    d = ops.addProductOwner(d, { id: 'po3', name: 'Stina', sectionId: 's2' });
    d = ops.addInitiative(d, {
      id: 'i3',
      name: 'Annan sektion',
      productOwnerId: 'po3',
      personIds: ['anna'],
      years: [2026],
    });
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 100);
    d = ops.setEstimate(d, 'i3', 'anna', 2026, 0, 70);
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

  it('radering tar bort personen ur initiativ och raderar personens timmar', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 5);
    d = ops.deletePerson(d, 'anna');

    expect(d.people.map((p) => p.id)).toEqual(['kalle']);
    expect(d.initiatives.map((i) => i.personIds)).toEqual([['kalle'], []]);
    expect(storedHoursForInitiative(d, 'i1')).toBe(5);
  });
});

describe('produktägare', () => {
  it('kan inte raderas så länge initiativ är kopplade', () => {
    const d = domainFixture();
    expect(() => ops.deleteProductOwner(d, 'po1')).toThrow(/2 kopplade initiativ/);
  });

  it('kan raderas när initiativen flyttats eller raderats', () => {
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

describe('tom data', () => {
  it('räknas som tom bara när varken sektioner, personal, produktägare eller initiativ finns', () => {
    expect(isEmptyData(emptyData())).toBe(true);
    expect(isEmptyData(ops.addSection(emptyData(), { id: 's', name: 'Sektion' }))).toBe(false);
    expect(isEmptyData(domainFixture())).toBe(false);
  });
});
