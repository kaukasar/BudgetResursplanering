// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatHours, formatSek, parseNonNegative } from './format';

describe('format', () => {
  it('tolkar svensk inmatning', () => {
    expect(parseNonNegative('')).toBe(0);
    expect(parseNonNegative('7,5')).toBe(7.5);
    expect(parseNonNegative('7.5')).toBe(7.5);
    expect(parseNonNegative('1 200')).toBe(1200);
    expect(parseNonNegative('-3')).toBeNull();
    expect(parseNonNegative('abc')).toBeNull();
    expect(parseNonNegative('1,2,3')).toBeNull();
  });

  it('formaterar timmar och kronor', () => {
    expect(formatHours(1234.5)).toBe('1 234,5');
    expect(formatSek(1234567.8)).toBe('1 234 568 kr');
  });
});
