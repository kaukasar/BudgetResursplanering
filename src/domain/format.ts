import type { StoredHours } from './calc';
import { isExternal, LOCK_REASON_LABEL, type LockReason, type Worker } from './types';

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

/** "Portal", "Portal och App", "App, Lager och Portal" – i den ordning namnen anges. */
export function listText(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} och ${names.at(-1)}`;
}

/** "Anna Andersson (bytt sektion)" – visar varför personens tid är låst. */
export const nameWithLockReason = (name: string, reason: LockReason | null) =>
  reason ? `${name} (${LOCK_REASON_LABEL[reason]})` : name;

/** Raderad personal märks, så att den går att skilja från en ny person med samma namn. */
export const workerDisplayName = (worker: Worker) =>
  nameWithLockReason(worker.name, !isExternal(worker) && worker.deleted ? 'deleted' : null);

/** Heltal med tusentalsavgränsare, avrundat till närmaste heltal. */
const formatWholeNumber = (value: number) => withPlainSpaces(wholeNumberFormat.format(value));

export const formatHours = formatWholeNumber;
export const formatSek = (sek: number) => `${formatWholeNumber(sek)} kr`;
export const formatPercent = (percent: number) => `${formatWholeNumber(percent)} %`;

/** Avvikelse i timmar eller procent med tecken: "+4", "−9", "±0". Avrundas först, så att 0,4 blir "±0". */
export function formatSigned(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '±0';
  return `${rounded > 0 ? '+' : '−'}${formatWholeNumber(Math.abs(rounded))}`;
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
export function hoursPairText({ estimate, actual }: StoredHours): string {
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
