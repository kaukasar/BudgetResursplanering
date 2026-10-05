import { countOverallocatedMonths, personCapacity, sumHours } from '../../domain/calc';
import { formatHours, plural } from '../../domain/format';
import { MONTHS, MONTHS_LONG, PERSON_TYPE_LABEL, type AppData, type Measure, type Person } from '../../domain/types';
import { PersonCell } from './PersonCell';

interface Props {
  data: AppData;
  people: Person[];
  year: number;
  measure: Measure;
}

const MEASURE_DESCRIPTION: Record<Measure, string> = {
  estimate: 'planerad tid i alla initiativ',
  actual: 'rapporterat utfall i alla initiativ',
};

/** Varje persons totala tid per månad i alla initiativ, jämfört med normal arbetstid. */
export function CapacityOverview({ data, people, year, measure }: Props) {
  if (people.length === 0) return null;

  const rows = people.map((person) => ({ person, ...personCapacity(data, person, year, measure) }));
  const overallocatedCount = rows.reduce((count, row) => count + countOverallocatedMonths(row), 0);

  return (
    <details className="card capacity" open>
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
              {MONTHS.map((month) => (
                <th key={month} scope="col">
                  {month}
                </th>
              ))}
              <th scope="col" className="col-total">
                Totalt h
              </th>
              <th scope="col" className="col-cost">
                Kapacitet/år
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
                  overallocated={overallocated}
                />
                {monthTotals.map((total, month) => (
                  <td
                    key={month}
                    className={overallocated[month] ? 'num over' : 'num'}
                    title={`${person.name}, ${MONTHS_LONG[month]}: ${formatHours(total)} av ${formatHours(capacity)} h${overallocated[month] ? ' – överallokerad!' : ''}`}
                  >
                    <span>{formatHours(total)}</span>
                  </td>
                ))}
                <td className="num total">{formatHours(sumHours(monthTotals))}</td>
                <td className="num cost">{formatHours(capacity * 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
