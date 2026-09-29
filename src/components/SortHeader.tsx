import type { SortState } from '../domain/sorting';

interface Props {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  /** T.ex. `num` för högerjusterade sifferkolumner. */
  className?: string;
}

/**
 * Sorterbar kolumnrubrik. Ett klick sorterar stigande på kolumnen; ett nytt klick på samma
 * kolumn vänder ordningen. Aktiv kolumn visar ▲/▼, övriga en diskret ↕.
 */
export function SortHeader({ label, sortKey, sort, onSort, className }: Props) {
  const active = sort.key === sortKey;
  const next = active && sort.direction === 'asc' ? 'fallande' : 'stigande';
  return (
    <th className={className} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        className={active ? 'sort-btn active' : 'sort-btn'}
        onClick={() => onSort(sortKey)}
        title={`Sortera ${next}`}
        aria-label={`${label}, sortera ${next}`}
      >
        {label}
        <span className="sort-icon" aria-hidden="true">
          {active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
