// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatHours,
  formatInputNumber,
  formatPercent,
  formatSek,
  formatSignedHours,
  parseWholeNumber,
} from './format';

describe('format', () => {
  it('tar bara emot heltal som är 0 eller större', () => {
    expect(parseWholeNumber('')).toBe(0);
    expect(parseWholeNumber('8')).toBe(8);
    expect(parseWholeNumber(' 1 200 ')).toBe(1200);
    expect(parseWholeNumber('7,5')).toBeNull();
    expect(parseWholeNumber('7.5')).toBeNull();
    expect(parseWholeNumber('7,0')).toBeNull();
    expect(parseWholeNumber('-3')).toBeNull();
    expect(parseWholeNumber('abc')).toBeNull();
    expect(parseWholeNumber('1e3')).toBeNull();
  });

  it('visar bara heltal och avrundar beräknade värden till närmaste heltal', () => {
    expect(formatHours(1234)).toBe('1 234');
    expect(formatHours(1234.4)).toBe('1 234');
    expect(formatHours(1234.5)).toBe('1 235');
    expect(formatSek(1234567.8)).toBe('1 234 568 kr');
    expect(formatPercent(87.49)).toBe('87 %');
    expect(formatPercent(100.5)).toBe('101 %');
    expect(formatSignedHours(4)).toBe('+4');
    expect(formatSignedHours(-8.6)).toBe('−9');
    expect(formatSignedHours(0.4)).toBe('±0');
    expect(formatInputNumber(625)).toBe('625');
    expect(formatInputNumber(null)).toBe('');
  });
});
