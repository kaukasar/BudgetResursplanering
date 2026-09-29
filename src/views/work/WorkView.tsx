import { allInitiativeYears, filterInitiatives } from '../../domain/calc';
import { sortByName } from '../../domain/sorting';
import type { AppData } from '../../domain/types';
import { useDataStore } from '../../store/store';
import { ALL_OWNERS, ALL_SECTIONS, useUiStore } from '../../store/ui';
import { useLoadSample } from '../useLoadSample';
import { CapacityOverview } from './CapacityOverview';
import { InitiativeTable } from './InitiativeTable';
import { WorkKeyFigures } from './WorkKeyFigures';
import { WorkToolbar } from './WorkToolbar';
import { VIEW_MEASURE } from './workViews';

/** Arbetsläget: filter, nyckeltal, kapacitet och en tabell per initiativ. */
export function WorkView() {
  const data = useDataStore((state) => state.data);
  const { year, view, sectionId: selectedSectionId, ownerId: selectedOwnerId } = useUiStore();

  if (data.initiatives.length === 0) return <NoInitiatives />;

  // Om vald sektion eller produktägare har raderats (eller produktägaren inte hör till vald
  // sektion) visas "alla" i stället.
  const sectionId = data.sections.some((section) => section.id === selectedSectionId)
    ? selectedSectionId
    : ALL_SECTIONS;
  const ownersInSection = sortByName(
    data.productOwners.filter((owner) => sectionId === ALL_SECTIONS || owner.sectionId === sectionId),
  );
  const ownerId = ownersInSection.some((owner) => owner.id === selectedOwnerId) ? selectedOwnerId : ALL_OWNERS;

  const initiatives = sortByName(filterInitiatives(data, { year, sectionId, ownerId }));
  const involvedPersonIds = new Set(initiatives.flatMap((initiative) => initiative.personIds));
  const involvedPeople = sortByName(data.people.filter((person) => involvedPersonIds.has(person.id)));
  const years = [...new Set([...allInitiativeYears(data), new Date().getFullYear(), year])].sort((a, b) => a - b);

  return (
    <div className={`work view-${view}`}>
      <WorkToolbar
        years={years}
        sections={sortByName(data.sections)}
        owners={ownersInSection}
        sectionId={sectionId}
        ownerId={ownerId}
      />
      <WorkKeyFigures data={data} initiatives={initiatives} people={involvedPeople} year={year} view={view} />
      {initiatives.length === 0 ? (
        <div className="card empty">
          <h3>Inga initiativ</h3>
          <p>{emptyFilterText(data, sectionId, ownerId, year)}</p>
        </div>
      ) : (
        <div className="stack">
          <CapacityOverview data={data} people={involvedPeople} year={year} measure={VIEW_MEASURE[view]} />
          {initiatives.map((initiative) => (
            <InitiativeTable key={initiative.id} data={data} initiative={initiative} year={year} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}

function emptyFilterText(data: AppData, sectionId: string, ownerId: string, year: number): string {
  const owner = data.productOwners.find((candidate) => candidate.id === ownerId);
  const section = data.sections.find((candidate) => candidate.id === sectionId);
  const subject = owner?.name ?? section?.name;
  return subject ? `${subject} har inga initiativ för ${year}.` : `Det finns inga initiativ för ${year}.`;
}

function NoInitiatives() {
  const setMode = useUiStore((state) => state.setMode);
  const loadSample = useLoadSample();
  return (
    <div className="card empty">
      <h3>Det finns inga initiativ ännu</h3>
      <p>Lägg upp personal, produktägare och initiativ i adminläget, eller prova med exempeldata.</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => setMode('admin')}>
          Gå till adminläget
        </button>
        <button type="button" className="btn" onClick={() => void loadSample()}>
          Ladda exempeldata
        </button>
      </div>
    </div>
  );
}
