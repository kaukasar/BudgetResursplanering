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

  it('sparar alltid under det nya namnet "estimates"', () => {
    const exported = JSON.parse(JSON.stringify(toExportFile(domainFixture()))) as { data: object };
    expect(Object.keys(exported.data)).toContain('estimates');
    expect(Object.keys(exported.data)).not.toContain('hours');
  });
});
