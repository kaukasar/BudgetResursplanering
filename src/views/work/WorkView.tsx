import { activePeople } from '../../domain/calc';
import {
  ALL_TAJMA_CLASSES,
  filterInitiatives,
  NO_TAJMA_CLASS,
  ownersInSection,
  resolveFilter,
  selectableYears,
  type InitiativeFilter,
  type TajmaClassFilter,
} from '../../domain/filter';
import { sortByName } from '../../domain/sorting';
import type { AppData } from '../../domain/types';
import { useDataStore } from '../../store/store';
import { useUiStore } from '../../store/ui';
import { CapacityOverview } from './CapacityOverview';
import { InitiativeTable } from './InitiativeTable';
import { WorkKeyFigures } from './WorkKeyFigures';
import { WorkToolbar } from './WorkToolbar';
import { VIEW_MEASURE } from './workViews';

/** Arbetsläget: filter, nyckeltal, kapacitet och en tabell per initiativ. */
export function WorkView() {
  const data = useDataStore((state) => state.data);
  const { year, view, sectionId, ownerId, tajmaClass } = useUiStore();

  if (data.initiatives.length === 0) return <NoInitiatives />;

  const filter = resolveFilter(data, { year, sectionId, ownerId, tajmaClass });
  const initiatives = sortByName(filterInitiatives(data, filter));
  const involvedPersonIds = new Set(initiatives.flatMap((initiative) => initiative.personIds));
  // Raderad personal visas inte i kapacitetsöversikten och räknas inte som överallokerad.
  const involvedPeople = sortByName(activePeople(data).filter((person) => involvedPersonIds.has(person.id)));

  return (
    <div className={`work view-${view}`}>
      <WorkToolbar
        years={selectableYears(data, year, new Date().getFullYear())}
        sections={sortByName(data.sections)}
        owners={sortByName(ownersInSection(data, filter.sectionId))}
        filter={filter}
      />
      <WorkKeyFigures data={data} initiatives={initiatives} people={involvedPeople} year={year} view={view} />
      {initiatives.length === 0 ? (
        <div className="card empty">
          <h3>Inga initiativ</h3>
          <p>{emptyFilterText(data, filter)}</p>
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
function emptyFilterText(data: AppData, filter: InitiativeFilter): string {
  const owner = data.productOwners.find((candidate) => candidate.id === filter.ownerId);
  const section = data.sections.find((candidate) => candidate.id === filter.sectionId);
  const subject = owner?.name ?? section?.name;
  const noInitiatives = noInitiativesText(filter.tajmaClass);
  return subject
    ? `${subject} har ${noInitiatives} för ${filter.year}.`
    : `Det finns ${noInitiatives} för ${filter.year}.`;
}

function noInitiativesText(tajmaClass: TajmaClassFilter): string {
  if (tajmaClass === ALL_TAJMA_CLASSES) return 'inga initiativ';
  if (tajmaClass === NO_TAJMA_CLASS) return 'inga initiativ utan tajmaklass';
  return `inga initiativ med tajmaklass ${tajmaClass}`;
}

function NoInitiatives() {
  const setMode = useUiStore((state) => state.setMode);
  return (
    <div className="card empty">
      <h3>Det finns inga initiativ ännu</h3>
      <p>Lägg upp sektioner, personal, produktägare och initiativ i adminläget.</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => setMode('admin')}>
          Gå till adminläget
        </button>
      </div>
    </div>
  );
}
