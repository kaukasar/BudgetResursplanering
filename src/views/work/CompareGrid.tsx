import { useState } from 'react';
import { sumHours } from '../../domain/calc';
import type { Deviation, InitiativeComparison } from '../../domain/comparison';
import { formatHours, formatSignedHours } from '../../domain/format';
import { MONTHS } from '../../domain/types';
import { MISSING } from '../labels';
import { PersonCell, rateDetails } from './PersonCell';

interface Props {
  year: number;
  comparison: InitiativeComparison;
}

const DEVIATION_EXPLANATION = 'Utfall minus estimat, för månader med rapporterat utfall';

/** Skrivskyddad tabell med utfall och avvikelse mot estimat per person och månad. */
export function CompareGrid({ year, comparison }: Props) {
  const [expandedPersonIds, setExpandedPersonIds] = useState<ReadonlySet<string>>(new Set());
  const toggleExpanded = (personId: string) =>
    setExpandedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });

  return (
    <div className="table-scroll">
      <table className="grid compare">
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
              Estimat h
            </th>
            <th scope="col" className="col-total">
              Utfall h
            </th>
            <th scope="col" className="col-total" title={DEVIATION_EXPLANATION}>
              Avvikelse
            </th>
          </tr>
        </thead>
        <tbody>
          {comparison.people.flatMap((row) => {
            const isExpanded = expandedPersonIds.has(row.person.id);
            const estimateTotal = sumHours(row.estimate);
            const personRow = (
              <tr key={row.person.id}>
                <PersonCell
                  person={row.person}
                  details={rateDetails(row.person, row.rate)}
                  lockReason={row.lockReason}
                  before={
                    <button
                      type="button"
                      className="expand-btn"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Dölj' : 'Visa'} estimat per månad för ${row.person.name}`}
                      onClick={() => toggleExpanded(row.person.id)}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  }
                />
                {row.estimate.map((estimate, month) => (
                  <CompareCell key={month} estimate={estimate} actual={row.actual[month]!} />
                ))}
                <td className="num total">{formatHours(estimateTotal)} h</td>
                <td className="num total">{formatHours(row.deviation.actual)} h</td>
                <DeviationTotal deviation={row.deviation} />
              </tr>
            );
            if (!isExpanded) return [personRow];
            const estimateRow = (
              <tr key={`${row.person.id}-estimate`} className="detail-row">
                <th scope="row" className="person">
                  <span className="meta">Estimat {year}</span>
                </th>
                {row.estimate.map((estimate, month) => (
                  <td key={month} className="num">
                    {formatHours(estimate)}
                  </td>
                ))}
                <td className="num total">{formatHours(estimateTotal)} h</td>
                <td className="num total" />
                <td className="num total" />
              </tr>
            );
            return [personRow, estimateRow];
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Summa</th>
            {comparison.months.map((month, index) => (
              <CompareCell key={index} estimate={month.reportedEstimate} actual={month.actual} />
            ))}
            <td className="num total">{formatHours(comparison.estimateTotal)} h</td>
            <td className="num total">{formatHours(comparison.deviation.actual)} h</td>
            <DeviationTotal deviation={comparison.deviation} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Utfall med avvikelse mot `estimate` under; "–" om inget utfall är rapporterat. */
function CompareCell({ estimate, actual }: { estimate: number; actual: number | null }) {
  if (actual === null) {
    return (
      <td className="num cmp not-reported" title={`Estimat ${formatHours(estimate)} h · inget utfall rapporterat`}>
        <span className="cmp-value">{MISSING}</span>
      </td>
    );
  }
  return (
    <td className="num cmp" title={`Estimat ${formatHours(estimate)} h · utfall ${formatHours(actual)} h`}>
      <span className="cmp-value">{formatHours(actual)}</span>
      <DeviationMark diff={actual - estimate} />
    </td>
  );
}

/** ▲ = mer tid än planerat, ▼ = mindre. Röd färg används inte – den är reserverad för överallokering. */
function DeviationMark({ diff }: { diff: number }) {
  if (diff === 0) return <span className="dev">±0</span>;
  return (
    <span className={diff > 0 ? 'dev dev-up' : 'dev dev-down'}>
      {diff > 0 ? '▲' : '▼'}
      {formatHours(Math.abs(diff))}
    </span>
  );
}

function DeviationTotal({ deviation }: { deviation: Deviation }) {
  if (deviation.reportedMonths === 0) return <td className="num total muted">{MISSING}</td>;
  const directionClass = deviation.diff > 0 ? 'dev-up' : deviation.diff < 0 ? 'dev-down' : undefined;
  return (
    <td className="num total" title={DEVIATION_EXPLANATION}>
      <span className={directionClass}>{formatSignedHours(deviation.diff)}</span>
      {deviation.percent !== null && <span className="dev">{formatSignedHours(Math.round(deviation.percent))} %</span>}
    </td>
  );
}
