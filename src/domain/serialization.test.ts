// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import * as ops from './operations';
import { parseAppData, toExportFile } from './serialization';

describe('export/import', () => {
  it('klarar en rundtur via JSON', () => {
    let d = domainFixture();
    d = ops.setEstimate(d, 'i1', 'anna', 2026, 0, 10);
    const roundTrip = parseAppData(JSON.parse(JSON.stringify(toExportFile(d))));
    expect(roundTrip).toEqual(d);
  });

  it('avvisar trasig data med begripligt fel', () => {
    expect(() => parseAppData({ foo: 1 })).toThrow(/Ogiltig fil/);
    const d = domainFixture();
    const broken = { ...d, initiatives: [{ ...d.initiatives[0]!, productOwnerId: 'okänd' }] };
    expect(() => parseAppData(broken)).toThrow(/okänd produktägare/);
  });

  it('rensar bort dinglande referenser och timmar', () => {
    const d = domainFixture();
    const messy = {
      ...d,
      initiatives: [{ ...d.initiatives[0]!, personIds: ['anna', 'spöke'] }],
      estimates: {
        i1: { anna: { 2026: Array(12).fill(1), 1999: Array(12).fill(1) }, spöke: { 2026: Array(12).fill(1) } },
      },
    };
    const clean = parseAppData(messy);
    expect(clean.initiatives[0]!.personIds).toEqual(['anna']);
    expect(Object.keys(clean.estimates.i1!)).toEqual(['anna']);
    expect(Object.keys(clean.estimates.i1!.anna!)).toEqual(['2026']);
  });
});

describe('äldre format', () => {
  it('läser estimat som sparats under det gamla namnet "hours"', () => {
    let data = domainFixture();
    data = ops.setEstimate(data, 'i1', 'anna', 2026, 0, 10);
    const { estimates, ...rest } = data;
    const oldFormat = { ...rest, hours: estimates };
    expect(parseAppData(oldFormat)).toEqual(data);
  });

  it('avrundar decimaler i äldre data till närmaste heltal', () => {
    const d = domainFixture();
    const months = (first: number | null) => [first, ...Array<null>(11).fill(null)];
    const old = {
      ...d,
      settings: { employee: { hourlyRate: 650.5, monthlyHours: 159.4 }, consultant: d.settings.consultant },
      people: d.people.map((p) => (p.id === 'kalle' ? { ...p, hourlyRate: 1000.4 } : p)),
      initiatives: d.initiatives.map((i) => (i.id === 'i1' ? { ...i, internalBudget: 99999.6 } : i)),
      estimates: { i1: { anna: { 2026: [7.5, 2.4, ...Array<number>(10).fill(0)] } } },
      actuals: { i1: { anna: { 2026: months(0.6) } } },
    };
    const parsed = parseAppData(old);
    expect(parsed.settings.employee).toEqual({ hourlyRate: 651, monthlyHours: 159 });
    expect(parsed.people.find((p) => p.id === 'kalle')?.hourlyRate).toBe(1000);
    expect(parsed.initiatives.find((i) => i.id === 'i1')?.internalBudget).toBe(100000);
    expect(parsed.estimates.i1?.anna?.[2026]?.slice(0, 2)).toEqual([8, 2]);
    expect(parsed.actuals.i1?.anna?.[2026]).toEqual(months(1));
    // En budget som avrundas till 0 är inte längre giltig.
    const tinyBudget = { ...d, initiatives: d.initiatives.map((i) => ({ ...i, internalBudget: 0.4 })) };
    expect(() => parseAppData(tinyBudget)).toThrow(/budget/);
  });

  it('sparar alltid under det nya namnet "estimates"', () => {
    const exported = JSON.parse(JSON.stringify(toExportFile(domainFixture()))) as { data: object };
    expect(Object.keys(exported.data)).toContain('estimates');
    expect(Object.keys(exported.data)).not.toContain('hours');
  });
});
