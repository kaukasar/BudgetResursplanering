// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareValues, joinSorted, nextSort, sortRows, type SortColumns } from './sorting';

interface Row {
  name: string;
  rate: number;
  budget: number | null;
  tags: string;
}

const rows: Row[] = [
  { name: 'Östen', rate: 650, budget: null, tags: '' },
  { name: 'Åsa', rate: 1100, budget: 200, tags: 'Beta' },
  { name: 'anna', rate: 650, budget: 50, tags: 'Alfa, Beta' },
  { name: 'Fas 10', rate: 90, budget: 1000, tags: 'Gamma' },
  { name: 'Fas 2', rate: 1100, budget: null, tags: '' },
];
const columns: SortColumns<Row> = {
  name: (r) => r.name,
  rate: (r) => r.rate,
  budget: (r) => r.budget,
  tags: (r) => r.tags,
};
const names = (list: Row[]) => list.map((r) => r.name);

describe('sortering', () => {
  it('sorterar text i svensk ordning, skiftlägesoberoende och med siffror i nummerordning', () => {
    expect(names(sortRows(rows, columns, { key: 'name', direction: 'asc' }))).toEqual([
      'anna',
      'Fas 2',
      'Fas 10',
      'Åsa',
      'Östen',
    ]);
    expect(names(sortRows(rows, columns, { key: 'name', direction: 'desc' }))).toEqual([
      'Östen',
      'Åsa',
      'Fas 10',
      'Fas 2',
      'anna',
    ]);
  });

  it('sorterar tal numeriskt och lika värden på namn', () => {
    // 90 < 650 (anna, Östen) < 1100 (Fas 2, Åsa) – inte "1100" < "650" som text.
    expect(names(sortRows(rows, columns, { key: 'rate', direction: 'asc' }))).toEqual([
      'Fas 10',
      'anna',
      'Östen',
      'Fas 2',
      'Åsa',
    ]);
    // Fallande vänder talen, men lika värden sorteras fortfarande stigande på namn.
    expect(names(sortRows(rows, columns, { key: 'rate', direction: 'desc' }))).toEqual([
      'Fas 2',
      'Åsa',
      'anna',
      'Östen',
      'Fas 10',
    ]);
  });

  it('lägger rader utan värde sist oavsett riktning', () => {
    expect(names(sortRows(rows, columns, { key: 'budget', direction: 'asc' }))).toEqual([
      'anna',
      'Åsa',
      'Fas 10',
      'Fas 2',
      'Östen',
    ]);
    expect(names(sortRows(rows, columns, { key: 'budget', direction: 'desc' }))).toEqual([
      'Fas 10',
      'Åsa',
      'anna',
      'Fas 2',
      'Östen',
    ]);
    expect(names(sortRows(rows, columns, { key: 'tags', direction: 'desc' }))).toEqual([
      'Fas 10',
      'Åsa',
      'anna',
      'Fas 2',
      'Östen',
    ]);
  });

  it('faller tillbaka på namn för okänd kolumn och ändrar inte ursprungslistan', () => {
    const copy = [...rows];
    expect(names(sortRows(rows, columns, { key: 'finns-inte', direction: 'asc' }))).toEqual([
      'anna',
      'Fas 2',
      'Fas 10',
      'Åsa',
      'Östen',
    ]);
    expect(rows).toEqual(copy);
  });

  it('ny kolumn sorteras stigande, samma kolumn vänder riktningen', () => {
    expect(nextSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort({ key: 'name', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSort({ key: 'name', direction: 'desc' }, 'rate')).toEqual({ key: 'rate', direction: 'asc' });
  });

  it('jämför och sammanfogar namn i svensk ordning', () => {
    expect(compareValues('Ö', 'Z')).toBeGreaterThan(0);
    expect(joinSorted(['Portal', 'Ärende', 'app'])).toBe('app, Portal, Ärende');
  });
});
