import { SortHeader } from '../../components/SortHeader';
import { sortRows, type SortColumns } from '../../domain/sorting';
import { useUiStore, type SortableTab } from '../../store/ui';

/**
 * Sortering för en adminflik: sorterar raderna enligt flikens sparade sortering och ger en
 * funktion som renderar en sorterbar kolumnrubrik. Rubriken godtar bara definierade kolumner.
 */
export function useAdminSort<T, Key extends string>(
  tab: SortableTab,
  rows: readonly T[],
  columns: SortColumns<T, Key>,
) {
  const sort = useUiStore((state) => state.adminSort[tab]);
  const sortAdminBy = useUiStore((state) => state.sortAdminBy);

  const sortHeader = (key: Key | 'name', label: string, className?: string) => (
    <SortHeader label={label} sortKey={key} sort={sort} onSort={(k) => sortAdminBy(tab, k)} className={className} />
  );

  return { sortedRows: sortRows(rows, columns, sort), sortHeader };
}
