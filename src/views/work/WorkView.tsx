import {
  activePeople,
  ALL_TAJMA_CLASSES,
  allInitiativeYears,
  filterInitiatives,
  isTajmaClassFilter,
  NO_TAJMA_CLASS,
  type TajmaClassFilter,
} from '../../domain/calc';
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
  const {
    year,
    view,
    sectionId: selectedSectionId,
    ownerId: selectedOwnerId,
    tajmaClass: selectedTajmaClass,
  } = useUiStore();

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

  // Ett sparat värde som inte längre är giltigt visar alla tajmaklasser.
  const tajmaClass = isTajmaClassFilter(selectedTajmaClass) ? selectedTajmaClass : ALL_TAJMA_CLASSES;

  const initiatives = sortByName(filterInitiatives(data, { year, sectionId, ownerId, tajmaClass }));
  const involvedPersonIds = new Set(initiatives.flatMap((initiative) => initiative.personIds));
  // Raderad personal visas inte i kapacitetsöversikten och räknas inte som överallokerad.
  const involvedPeople = sortByName(activePeople(data).filter((person) => involvedPersonIds.has(person.id)));
  const years = [...new Set([...allInitiativeYears(data), new Date().getFullYear(), year])].sort((a, b) => a - b);

  return (
    <div className={`work view-${view}`}>
      <WorkToolbar
        years={years}
        sections={sortByName(data.sections)}
        owners={ownersInSection}
        sectionId={sectionId}
        ownerId={ownerId}
        tajmaClass={tajmaClass}
      />
      <WorkKeyFigures data={data} initiatives={initiatives} people={involvedPeople} year={year} view={view} />
      {initiatives.length === 0 ? (
        <div className="card empty">
          <h3>Inga initiativ</h3>
          <p>{emptyFilterText(data, sectionId, ownerId, tajmaClass, year)}</p>
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

/** T.ex. "Maria Lind har inga initiativ med tajmaklass IMM för 2026." */
function emptyFilterText(
  data: AppData,
  sectionId: string,
  ownerId: string,
  tajmaClass: TajmaClassFilter,
  year: number,
): string {
  const owner = data.productOwners.find((candidate) => candidate.id === ownerId);
  const section = data.sections.find((candidate) => candidate.id === sectionId);
  const subject = owner?.name ?? section?.name;
  const initiatives =
    tajmaClass === ALL_TAJMA_CLASSES
      ? 'inga initiativ'
      : tajmaClass === NO_TAJMA_CLASS
        ? 'inga initiativ utan tajmaklass'
        : `inga initiativ med tajmaklass ${tajmaClass}`;
  return subject ? `${subject} har ${initiatives} för ${year}.` : `Det finns ${initiatives} för ${year}.`;
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
