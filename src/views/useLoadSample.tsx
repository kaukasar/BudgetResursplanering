import { useConfirm } from '../components/confirm-context';
import { sampleData } from '../domain/sample';
import { isEmptyData } from '../domain/types';
import { useDataStore } from '../store/store';
import { ALL_OWNERS, ALL_SECTIONS, useUiStore } from '../store/ui';

/**
 * Ersätter all data med exempeldata, efter bekräftelse om det finns data som skulle gå förlorad.
 * Filtren i arbetsläget återställs så att exemplet syns. Returnerar om exempeldatan laddades.
 */
export function useLoadSample(): () => Promise<boolean> {
  const hasData = useDataStore((state) => !isEmptyData(state.data));
  const replaceData = useDataStore((state) => state.replaceData);
  const { setYear, setSectionId, setOwnerId } = useUiStore();
  const confirm = useConfirm();

  return async () => {
    const confirmed =
      !hasData ||
      (await confirm({
        title: 'Ladda exempeldata',
        danger: true,
        confirmLabel: 'Ersätt med exempeldata',
        message: <p>All nuvarande data ersätts med exempeldata. Exportera först om du vill behålla den.</p>,
      }));
    if (!confirmed) return false;
    replaceData(sampleData());
    setYear(new Date().getFullYear());
    setSectionId(ALL_SECTIONS);
    setOwnerId(ALL_OWNERS);
    return true;
  };
}
