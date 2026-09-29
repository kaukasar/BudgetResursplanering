// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { domainFixture } from '../test/domainFixture';
import { calculateDeviation, compareInitiative, sumDeviations } from './comparison';
import * as ops from './operations';

describe('jämförelse av estimat och utfall', () => {
  it('räknar avvikelse per person bara på den personens rapporterade månader', () => {
    // Anna och Kalle har estimat i januari, men bara Anna har rapporterat utfall.
    let data = domainFixture();
    data = ops.setEstimate(data, 'i1', 'anna', 2026, 0, 100);
    data = ops.setEstimate(data, 'i1', 'kalle', 2026, 0, 20);
    data = ops.setActual(data, 'i1', 'anna', 2026, 0, 90);
    const comparison = compareInitiative(data, data.initiatives[0]!, 2026);

    // Kalles orapporterade 20 h ska inte räknas som avvikelse.
    expect(comparison.deviation).toMatchObject({ estimate: 100, actual: 90, diff: -10, reportedMonths: 1 });
    expect(comparison.months[0]).toEqual({ estimate: 120, reportedEstimate: 100, actual: 90 });
    expect(comparison.people.map((row) => [row.person.id, row.deviation.diff])).toEqual([
      ['anna', -10],
      ['kalle', 0],
    ]);
  });

  it('visar ingen jämförelse för månader där ingen har rapporterat', () => {
    let data = domainFixture();
    data = ops.setEstimate(data, 'i1', 'anna', 2026, 1, 40);
    const comparison = compareInitiative(data, data.initiatives[0]!, 2026);
    expect(comparison.months[1]).toEqual({ estimate: 40, reportedEstimate: 0, actual: null });
    expect(comparison.deviation).toMatchObject({ reportedMonths: 0, diff: 0, percent: null });
    expect(comparison.estimateTotal).toBe(40);
  });

  it('räknar rapporterade 0 h som utfall', () => {
    let data = domainFixture();
    data = ops.setEstimate(data, 'i1', 'kalle', 2026, 2, 30);
    data = ops.setActual(data, 'i1', 'kalle', 2026, 2, 0);
    const comparison = compareInitiative(data, data.initiatives[0]!, 2026);
    expect(comparison.months[2]).toEqual({ estimate: 30, reportedEstimate: 30, actual: 0 });
    expect(comparison.deviation.diff).toBe(-30);
  });

  it('summerar avvikelser och räknar om procenten på totalen', () => {
    const total = sumDeviations([calculateDeviation([100], [90]), calculateDeviation([50], [70])]);
    expect(total).toEqual({ estimate: 150, actual: 160, diff: 10, percent: (10 / 150) * 100, reportedMonths: 2 });
  });
});
