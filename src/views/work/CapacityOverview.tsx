import { countOverallocatedMonths, personCapacity, sum } from '../../domain/calc';
import { formatHours, plural } from '../../domain/format';
import { ALL_MONTHS, flagsInPeriod, monthsInPeriod, sumInPeriod, type MonthFilter } from '../../domain/period';
import { MONTHS, MONTHS_LONG, PERSON_TYPE_LABEL, type AppData, type Measure, type Person } from '../../domain/types';
import { monthClass } from './monthClass';
import { PersonCell } from './PersonCell';

interface Props {
  data: AppData;
  people: Person[];
  year: number;
  /** Hela året eller en vald månad; övriga månader visas gråa och räknas inte i totalerna. */
  period: MonthFilter;
  measure: Measure;
}

const MEASURE_DESCRIPTION: Record<Measure, string> = {
  estimate: 'planerad tid i alla initiativ',
  actual: 'rapporterat utfall i alla initiativ',
};

/** Varje persons totala tid per månad i alla initiativ, jämfört med normal arbetstid. */
export function CapacityOverview({ data, people, year, period, measure }: Props) {
  if (people.length === 0) return null;

  const rows = people.map((person) => ({ person, ...personCapacity(data, person, year, measure) }));
  const overallocatedCount = sum(rows.map((row) => countOverallocatedMonths(row, period)));

  return (
    // Dold som standard; ett klick på rubriken (triangeln) visar översikten.
    <details className="card capacity">
      <summary>
        <h3>Kapacitet {year}</h3>
        <span className={overallocatedCount > 0 ? 'small over-text' : 'small muted'}>
          {overallocatedCount > 0
            ? plural(overallocatedCount, 'överallokerad personmånad', 'överallokerade personmånader')
            : 'Ingen överallokering'}{' '}
          · {MEASURE_DESCRIPTION[measure]}
        </span>
      </summary>
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th scope="col" className="col-person">
                Person
              </th>
              {MONTHS.map((name, month) => (
                <th key={name} scope="col" className={monthClass(month, period)}>
                  {name}
                </th>
              ))}
              <th scope="col" className="col-total">
                Totalt h
              </th>
              <th scope="col" className="col-cost">
                {period === ALL_MONTHS ? 'Kapacitet/år' : 'Kapacitet/mån'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, capacity, monthTotals, overallocated }) => (
              <tr key={person.id}>
                <PersonCell
                  person={person}
                  details={`${PERSON_TYPE_LABEL[person.type]} · ${formatHours(capacity)} h/mån`}
                  lockReason={null}
                  overallocated={flagsInPeriod(overallocated, period)}
                />
                {monthTotals.map((total, month) => (
                  <td
                    key={month}
                    className={monthClass(month, period, overallocated[month] ? 'num over' : 'num')}
                    title={`${person.name}, ${MONTHS_LONG[month]}: ${formatHours(total)} av ${formatHours(capacity)} h${overallocated[month] ? ' – överallokerad!' : ''}`}
                  >
                    <span>{formatHours(total)}</span>
                  </td>
                ))}
                <td className="num total">{formatHours(sumInPeriod(monthTotals, period))}</td>
                <td className="num cost">{formatHours(capacity * monthsInPeriod(period))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
