// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, toAnalysisCsv } from './csv';
import * as ops from './operations';
import { TEST_SETTINGS } from '../test/domainFixture';
import { emptyData, type AppData } from './types';

function fixture(): AppData {
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
    name: 'Kalle; "K"',
    type: 'consultant',
    sectionId: 's1',
    hourlyRate: 1000,
    monthlyHours: 100,
  });
  d = ops.addProductOwner(d, { id: 'po', name: 'Petra', sectionId: 's1' });
  d = ops.addInitiative(d, {
    id: 'i1',
    name: 'Portal',
    productOwnerId: 'po',
    personIds: ['anna', 'kalle'],
    years: [2026],
  });
  d = ops.addInitiative(d, {
    id: 'i2',
    name: '=Formel',
    productOwnerId: 'po',
    personIds: ['anna'],
    years: [2026, 2027],
  });
  d = ops.setEstimate(d, 'i1', 'anna', 2026, 2, 100);
  d = ops.setEstimate(d, 'i2', 'anna', 2026, 2, 70);
  d = ops.setEstimate(d, 'i1', 'kalle', 2026, 0, 10);
  d = ops.setActual(d, 'i1', 'anna', 2026, 2, 90);
  d = ops.setActual(d, 'i1', 'kalle', 2026, 0, 0); // rapporterat 0 h
  // Kalle byter sedan sektion: hans tid på Portal finns kvar men är låst, och hemsektionen blir Sektion 2.
  d = ops.updatePerson(d, 'kalle', { sectionId: 's2' });
  return d;
}

const parse = (csv: string) =>
  csv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');

describe('CSV-export för Excel', () => {
  it('börjar med BOM och rubrikrad separerad med semikolon', () => {
    const csv = toAnalysisCsv(fixture());
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(parse(csv)[0]).toBe(CSV_COLUMNS.join(';'));
  });

  it('har en rad per initiativ, person, år och månad, även månader utan timmar', () => {
    // Portal: 2 personer × 1 år × 12, =Formel: 1 person × 2 år × 12
    expect(parse(toAnalysisCsv(fixture()))).toHaveLength(1 + 24 + 24);
  });

  it('räknar estimat, utfall, avvikelse, kostnad och överallokering, med decimalkomma', () => {
    const lines = parse(toAnalysisCsv(fixture()));
    expect(lines).toContain(
      '2026;3;mars;Sektion 1;Petra;Portal;Anna;Sektion 1;Anställd;100;90;-10;650;65000;58500;160;170;Ja',
    );
    expect(lines).toContain("2026;3;mars;Sektion 1;Petra;'=Formel;Anna;Sektion 1;Anställd;70;;;650;45500;;160;170;Ja");
    expect(lines).toContain(
      '2026;1;januari;Sektion 1;Petra;Portal;"Kalle; ""K""";Sektion 2;Konsult;10;0;-10;1000;10000;0;100;10;Nej',
    );
    expect(lines).toContain("2027;3;mars;Sektion 1;Petra;'=Formel;Anna;Sektion 1;Anställd;0;;;650;0;;160;0;Nej");
  });

  it('ger bara rubrikraden när det saknas initiativ', () => {
    expect(parse(toAnalysisCsv(emptyData()))).toEqual([CSV_COLUMNS.join(';')]);
  });
});
