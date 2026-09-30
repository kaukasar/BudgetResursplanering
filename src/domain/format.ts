/** Appen hanterar bara heltal. Beräknade värden med decimaler avrundas till närmaste heltal vid visning. */
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

/** Heltal med tusentalsavgränsare, avrundat till närmaste heltal. */
const formatWholeNumber = (value: number) => withPlainSpaces(wholeNumberFormat.format(value));

export const formatHours = formatWholeNumber;
export const formatSek = (sek: number) => `${formatWholeNumber(sek)} kr`;
export const formatPercent = (percent: number) => `${formatWholeNumber(percent)} %`;

/** Avvikelse med tecken: "+4", "−9", "±0". Avrundas först, så att t.ex. 0,4 visas som "±0". */
export function formatSignedHours(hours: number): string {
  const rounded = Math.round(hours);
  if (rounded === 0) return '±0';
  return `${rounded > 0 ? '+' : '−'}${formatHours(Math.abs(rounded))}`;
}

/** Värde i ett inmatningsfält: heltal utan tusentalsavgränsare. `null` = tomt fält. */
export const formatInputNumber = (value: number | null) => (value === null ? '' : String(Math.round(value)));

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
 * Tolkar ett inmatat heltal som är 0 eller större. Mellanslag som tusentalsavgränsare accepteras.
 * Tom sträng tolkas som 0. Returnerar `null` vid ogiltig inmatning, t.ex. decimaler eller minustecken.
 */
export function parseWholeNumber(input: string): number | null {
  const cleaned = input.replace(ALL_SPACES, '');
  if (cleaned === '') return 0;
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}

export type OptionalNumberInput = { ok: true; value: number | null } | { ok: false };

/** Som `parseWholeNumber`, men tom sträng betyder "inget värde" (`null`). */
export function parseOptionalWholeNumber(input: string): OptionalNumberInput {
  if (input.trim() === '') return { ok: true, value: null };
  const value = parseWholeNumber(input);
  return value === null ? { ok: false } : { ok: true, value };
}
