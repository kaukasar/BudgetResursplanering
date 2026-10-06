import { KeyFigure } from '../../components/KeyFigure';
import { countOverallocatedMonths, personCapacity, sum, summarizeInitiative } from '../../domain/calc';
import { formatHours, formatSek } from '../../domain/format';
import {
  BUDGET_PART_DEFINITE,
  BUDGET_PART_LABEL,
  BUDGET_PARTS,
  budgetOf,
  type AppData,
  type BudgetPart,
  type Initiative,
  type Measure,
  type Person,
} from '../../domain/types';
import type { WorkView } from '../../store/ui';
import { MISSING } from '../labels';

interface Props {
  data: AppData;
  initiatives: Initiative[];
  /** Personal kopplad till de visade initiativen. */
  people: Person[];
  year: number;
  view: WorkView;
}

/** Nyckeltal för de initiativ som visas, anpassade efter vald vy. */
export function WorkKeyFigures({ data, initiatives, people, year, view }: Props) {
  const totals = (measure: Measure): Totals => {
    const summaries = initiatives.map((initiative) => summarizeInitiative(data, initiative, year, measure));
    return {
      hours: sum(summaries.map((summary) => summary.totalHours)),
      cost: sum(summaries.map((summary) => summary.totalCost)),
    };
  };
  const overallocatedCount = (measure: Measure) =>
    sum(people.map((person) => countOverallocatedMonths(personCapacity(data, person, year, measure))));

  return (
    <div className="stats">
      <KeyFigure className="card stat" label="Initiativ" value={String(initiatives.length)} />
      {view === 'compare' ? (
        <CompareFigures year={year} totals={totals} />
      ) : (
        <MeasureFigures
          year={year}
          measure={view}
          totals={totals(view)}
          overallocatedCount={overallocatedCount(view)}
        />
      )}
      {BUDGET_PARTS.map((part) => (
        <BudgetFigure key={part} part={part} initiatives={initiatives} />
      ))}
    </div>
  );
}

interface Totals {
  hours: number;
  cost: number;
}

const MEASURE_FIGURE_LABELS: Record<Measure, { hours: string; cost: string; overallocation: string }> = {
  estimate: { hours: 'Planerade timmar', cost: 'Planerad kostnad', overallocation: 'Överallokerade personmånader' },
  actual: { hours: 'Utfall', cost: 'Utfallskostnad', overallocation: 'Överallokerade personmånader (utfall)' },
};

interface MeasureFiguresProps {
  year: number;
  measure: Measure;
  totals: Totals;
  overallocatedCount: number;
}

function MeasureFigures({ year, measure, totals, overallocatedCount }: MeasureFiguresProps) {
  const labels = MEASURE_FIGURE_LABELS[measure];
  return (
    <>
      <KeyFigure className="card stat" label={`${labels.hours} ${year}`} value={`${formatHours(totals.hours)} h`} />
      <KeyFigure className="card stat" label={`${labels.cost} ${year}`} value={formatSek(totals.cost)} />
      <KeyFigure
        className={overallocatedCount > 0 ? 'card stat alert' : 'card stat'}
        label={labels.overallocation}
        value={String(overallocatedCount)}
      />
    </>
  );
}

interface CompareFiguresProps {
  year: number;
  totals: (measure: Measure) => Totals;
}

function CompareFigures({ year, totals }: CompareFiguresProps) {
  const estimate = totals('estimate');
  const actual = totals('actual');

  return (
    <>
      <KeyFigure className="card stat" label={`Estimat ${year}`} value={`${formatHours(estimate.hours)} h`} />
      <KeyFigure className="card stat" label={`Utfall ${year}`} value={`${formatHours(actual.hours)} h`} />
      <KeyFigure
        className="card stat"
        label={`Prognos kostnad ${year}`}
        title="Estimerad kostnad"
        value={formatSek(estimate.cost)}
      />
      <KeyFigure
        className="card stat"
        label={`Utfallskostnad ${year}`}
        title="Faktisk kostnad: rapporterade timmar × respektive persons timkostnad"
        value={formatSek(actual.cost)}
      />
    </>
  );
}

/**
 * Summan av den interna eller externa budgeten för de visade initiativen. Budgeten gäller
 * initiativets alla år, till skillnad från övriga nyckeltal som gäller valt år; det anges i
 * etiketten när något initiativ med den delen av budgeten gäller flera år.
 */
function BudgetFigure({ part, initiatives }: { part: BudgetPart; initiatives: Initiative[] }) {
  const withBudget = initiatives.filter((initiative) => budgetOf(initiative, part));
  const total = sum(withBudget.map((initiative) => budgetOf(initiative, part)));
  const coversSeveralYears = withBudget.some((initiative) => initiative.years.length > 1);
  const label = BUDGET_PART_LABEL[part];
  return (
    <KeyFigure
      className="card stat"
      label={coversSeveralYears ? `${label} (alla år)` : label}
      title={`Summan av ${BUDGET_PART_DEFINITE[part]} för de visade initiativen. ${withBudget.length} av ${initiatives.length} initiativ har ${label.toLowerCase()}.`}
      value={withBudget.length > 0 ? formatSek(total) : MISSING}
    />
  );
}
