export type SortDirection = 'asc' | 'desc';

export interface SortState {
  /** Kolumnens nyckel, t.ex. `name` eller `rate`. */
  key: string;
  direction: SortDirection;
}

/** Värdet en kolumn sorteras på. `null` eller tom sträng = saknar värde (sorteras sist). */
export type SortValue = string | number | null;

/** Kolumndefinitioner: nyckel → funktion som ger radens sorteringsvärde. Måste innehålla `name`. */
export type SortColumns<T, Key extends string = string> = { name: (row: T) => string } & Record<
  Key,
  (row: T) => SortValue
>;

function hasColumn<T, Key extends string>(columns: SortColumns<T, Key>, key: string): key is Key {
  return Object.hasOwn(columns, key);
}

const hasNoValue = (value: SortValue) => value === null || value === '';

/** Jämför två värden: tal numeriskt, text i svensk ordning (Å, Ä, Ö sist; "Fas 2" före "Fas 10"). */
export function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'sv', { numeric: true, sensitivity: 'base' });
}

export const compareByName = (a: { name: string }, b: { name: string }) => compareValues(a.name, b.name);

/** Ny lista sorterad på namn i svensk ordning. */
export const sortByName = <T extends { name: string }>(items: readonly T[]): T[] => [...items].sort(compareByName);

/** Namn sorterade i svensk ordning och sammanfogade för visning, t.ex. "App, Beta, Portal". */
export const joinSorted = (names: string[]) => [...names].sort(compareValues).join(', ');

/**
 * Sorterar rader på vald kolumn och riktning. Rader utan värde hamnar alltid sist, oavsett
 * riktning. Lika värden sorteras vidare på namn (stigande). Ursprungslistan ändras inte.
 */
export function sortRows<T, Key extends string>(
  rows: readonly T[],
  columns: SortColumns<T, Key>,
  sort: SortState,
): T[] {
  // Sparad sortering kan peka på en kolumn som inte längre finns; då sorteras på namn.
  const key = sort.key;
  const valueOf: (row: T) => SortValue = hasColumn(columns, key) ? columns[key] : columns.name;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const valueA = valueOf(a);
    const valueB = valueOf(b);
    if (hasNoValue(valueA) !== hasNoValue(valueB)) return hasNoValue(valueA) ? 1 : -1;
    const primary = hasNoValue(valueA) ? 0 : sign * compareValues(valueA, valueB);
    return primary || compareValues(columns.name(a), columns.name(b));
  });
}

/** Klick på en kolumn: samma kolumn vänder riktningen, en ny kolumn sorteras stigande. */
export function nextSort(current: SortState, key: string): SortState {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
