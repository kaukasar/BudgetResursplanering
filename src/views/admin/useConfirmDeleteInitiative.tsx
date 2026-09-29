import { useConfirm } from '../../components/confirm-context';
import { storedHoursForInitiative } from '../../domain/calc';
import { hoursLossText } from '../../domain/format';
import type { Initiative } from '../../domain/types';
import { useDataStore } from '../../store/store';

/** Raderar ett initiativ efter en bekräftelse som visar hur många timmar som försvinner. */
export function useConfirmDeleteInitiative(): (initiative: Initiative) => Promise<void> {
  const data = useDataStore((state) => state.data);
  const deleteInitiative = useDataStore((state) => state.deleteInitiative);
  const confirm = useConfirm();

  return async (initiative) => {
    const loss = hoursLossText(
      storedHoursForInitiative(data, initiative.id, 'estimate'),
      storedHoursForInitiative(data, initiative.id, 'actual'),
    );
    const confirmed = await confirm({
      title: 'Radera initiativ',
      danger: true,
      confirmLabel: 'Radera initiativ',
      message: (
        <>
          <p>
            Vill du radera initiativet <strong>{initiative.name}</strong>?
          </p>
          {loss && <p className="over-text">{loss}</p>}
        </>
      ),
    });
    if (confirmed) deleteInitiative(initiative.id);
  };
}
