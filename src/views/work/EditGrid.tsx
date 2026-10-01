import { HoursCell } from '../../components/HoursCell';
import {
  getMonthActuals,
  getMonthEstimates,
  lastCompletedMonth,
  personCapacity,
  summarizeInitiative,
  type PersonCapacity,
} from '../../domain/calc';
import { formatHours, formatSek } from '../../domain/format';
import {
  isExternal,
  MONTHS,
  MONTHS_LONG,
  type AppData,
  type Initiative,
  type Measure,
  type Worker,
} from '../../domain/types';
import { useDataStore } from '../../store/store';
import { PersonCell, rateDetails } from './PersonCell';

interface Props {
  data: AppData;
  initiative: Initiative;
  year: number;
  /** Estimat eller utfall – det som matas in i cellerna. */
  measure: Measure;
  initiativeSectionId: string | undefined;
}

/** Tabell där estimat eller utfall matas in per person och månad. */
export function EditGrid({ data, initiative, year, measure, initiativeSectionId }: Props) {
  const setEstimate = useDataStore((state) => state.setEstimate);
  const setActual = useDataStore((state) => state.setActual);
  const fillActualsFromEstimate = useDataStore((state) => state.fillActualsFromEstimate);
  const isActual = measure === 'actual';
  const summary = summarizeInitiative(data, initiative, year, measure);
  const fillThroughMonth = lastCompletedMonth(year, new Date());

  return (
    <div className="table-scroll">
      <table className="grid">
        <thead>
          <tr>
            <th scope="col" className="col-person">
              Personal
            </th>
            {MONTHS.map((month) => (
              <th key={month} scope="col">
                {month}
              </th>
            ))}
            <th scope="col" className="col-total">
              {isActual ? 'Utfall h' : 'Totalt h'}
            </th>
            <th scope="col" className="col-cost">
              Kostnad
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row, rowIndex) => {
            const { person } = row;
            // Extern personal har inget tak och kan aldrig bli överallokerad.
            const capacity = isExternal(person) ? null : personCapacity(data, person, year, measure);
            const estimates = getMonthEstimates(data, initiative.id, person.id, year);
            const actuals = getMonthActuals(data, initiative.id, person.id, year);
            const canFillFromEstimate =
              isActual && actuals.slice(0, fillThroughMonth + 1).some((actual) => actual === null);
            return (
              <tr key={person.id}>
                <PersonCell
                  person={person}
                  details={rateDetails(data, person, row.rate, initiativeSectionId)}
                  overallocated={capacity?.overallocated}
                  after={
                    canFillFromEstimate && (
                      <button
                        type="button"
                        className="link-btn fill-btn"
                        title={`Fyller tomma utfallsceller t.o.m. ${MONTHS_LONG[fillThroughMonth]} med estimatet`}
                        onClick={() => fillActualsFromEstimate(initiative.id, person.id, year, fillThroughMonth)}
                      >
                        Fyll från estimat
                      </button>
                    )
                  }
                />
                {MONTHS.map((_, month) => (
                  <td
                    key={month}
                    className={capacity?.overallocated[month] ? 'cell over' : 'cell'}
                    title={cellTitle(person, month, capacity, measure, estimates[month]!)}
                  >
                    <HoursCell
                      value={isActual ? actuals[month]! : estimates[month]!}
                      nullable={isActual}
                      placeholder={isActual ? estimatePlaceholder(estimates[month]!) : '0'}
                      label={`${person.name} ${MONTHS_LONG[month]} ${year}, ${initiative.name}${isActual ? ', utfall' : ''}`}
                      grid={`${initiative.id}-${measure}`}
                      row={rowIndex}
                      col={month}
                      onCommit={(hours) =>
                        isActual
                          ? setActual(initiative.id, person.id, year, month, hours)
                          : setEstimate(initiative.id, person.id, year, month, hours ?? 0)
                      }
                    />
                  </td>
                ))}
                <td className="num total">{formatHours(row.totalHours)}</td>
                <td className="num cost">{formatSek(row.totalCost)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Summa</th>
            {summary.monthTotals.map((total, month) => (
              <td key={month} className="num">
                {formatHours(total)}
              </td>
            ))}
            <td className="num total">{formatHours(summary.totalHours)}</td>
            <td className="num cost">{formatSek(summary.totalCost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** I utfallsvyn visas estimatet som grå ledtext i tomma celler. */
const estimatePlaceholder = (estimate: number) => (estimate > 0 ? formatHours(estimate) : '');

function cellTitle(person: Worker, month: number, capacity: PersonCapacity | null, measure: Measure, estimate: number) {
  const measureName = measure === 'actual' ? 'utfall' : 'estimat';
  if (!capacity) {
    const estimateHere = measure === 'actual' ? `: estimat ${formatHours(estimate)} h` : '';
    return `${person.name}, ${MONTHS_LONG[month]}${estimateHere} (inget tak för arbetstiden)`;
  }
  const total = formatHours(capacity.monthTotals[month]!);
  const overallocated = capacity.overallocated[month] ? ' – överallokerad!' : '';
  const estimateHere = measure === 'actual' ? ` · estimat här ${formatHours(estimate)} h` : '';
  return `${person.name}, ${MONTHS_LONG[month]}: ${measureName} totalt ${total} av ${formatHours(capacity.capacity)} h i alla initiativ${overallocated}${estimateHere}`;
}
