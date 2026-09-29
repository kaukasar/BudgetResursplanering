const hoursFormat = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
const wholeNumberFormat = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/** Intl använder hårda mellanslag (U+00A0, U+202F) som tusentalsavgränsare. */
const HARD_SPACES = /[\u00a0\u202f]/g;
const ALL_SPACES = /[\s\u00a0\u202f]/g;

/** Vanliga mellanslag gör texten enklare att kopiera och att testa. */
const withPlainSpaces = (text: string) => text.replace(HARD_SPACES, ' ');

// ---------------------------------------------------------------- Visning

/** "1 person", "2 personer" */
export const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export const formatHours = (hours: number) => withPlainSpaces(hoursFormat.format(hours));
export const formatSek = (sek: number) => `${withPlainSpaces(wholeNumberFormat.format(sek))} kr`;
export const formatPercent = (percent: number) => `${withPlainSpaces(wholeNumberFormat.format(percent))} %`;

/** Avvikelse med tecken: "+4", "−8,5", "±0". */
export function formatSignedHours(hours: number): string {
  if (hours === 0) return '±0';
  return `${hours > 0 ? '+' : '−'}${formatHours(Math.abs(hours))}`;
}

/** Värde i ett inmatningsfält: decimalkomma och inga tusentalsavgränsare. `null` = tomt fält. */
export const formatInputNumber = (value: number | null) => (value === null ? '' : String(value).replace('.', ','));

/** "40 planerade timmar och 12 timmar rapporterat utfall raderas permanent." – `null` om inget raderas. */
export function hoursLossText(estimate: number, actual: number): string | null {
  const parts = [
    estimate > 0 && `${formatHours(estimate)} planerade timmar`,
    actual > 0 && `${formatHours(actual)} timmar rapporterat utfall`,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(' och ')} raderas permanent.` : null;
}

/** "40 h estimat, 12 h utfall" – för listor över vad som påverkas. */
export function hoursPairText(estimate: number, actual: number): string {
  return [estimate > 0 && `${formatHours(estimate)} h estimat`, actual > 0 && `${formatHours(actual)} h utfall`]
    .filter(Boolean)
    .join(', ');
}

// ---------------------------------------------------------------- Inmatning

/**
 * Tolkar ett inmatat tal. Accepterar både komma och punkt som decimaltecken samt mellanslag
 * som tusentalsavgränsare. Tom sträng tolkas som 0. Returnerar `null` vid ogiltig eller negativ inmatning.
 */
export function parseNonNegative(input: string): number | null {
  const cleaned = input.replace(ALL_SPACES, '').replace(',', '.');
  if (cleaned === '') return 0;
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export type OptionalNumberInput = { ok: true; value: number | null } | { ok: false };

/** Som `parseNonNegative`, men tom sträng betyder "inget värde" (`null`). */
export function parseOptionalNonNegative(input: string): OptionalNumberInput {
  if (input.trim() === '') return { ok: true, value: null };
  const value = parseNonNegative(input);
  return value === null ? { ok: false } : { ok: true, value };
}
