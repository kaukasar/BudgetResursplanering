import { KeyFigure } from '../../components/KeyFigure';
import { countOverallocatedMonths, personCapacity, summarizeInitiative } from '../../domain/calc';
import { formatHours, formatSek } from '../../domain/format';
import type { AppData, Initiative, Measure, Person } from '../../domain/types';
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
  const totals = (measure: Measure) => {
    const summaries = initiatives.map((initiative) => summarizeInitiative(data, initiative, year, measure));
    return {
      hours: summaries.reduce((total, summary) => total + summary.totalHours, 0),
      cost: summaries.reduce((total, summary) => total + summary.totalCost, 0),
    };
  };
  const overallocatedCount = (measure: Measure) =>
    people.reduce((count, person) => count + countOverallocatedMonths(personCapacity(data, person, year, measure)), 0);

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
      <BudgetFigure initiatives={initiatives} />
    </div>
  );
}

const MEASURE_FIGURE_LABELS: Record<Measure, { hours: string; cost: string; overallocation: string }> = {
  estimate: { hours: 'Planerade timmar', cost: 'Planerad kostnad', overallocation: 'Överallokerade personmånader' },
  actual: { hours: 'Utfall', cost: 'Utfallskostnad', overallocation: 'Överallokerade personmånader (utfall)' },
};

interface MeasureFiguresProps {
  year: number;
  measure: Measure;
  totals: { hours: number; cost: number };
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
  totals: (measure: Measure) => { hours: number; cost: number };
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
 * Summan av budgeten för de visade initiativen. Budgeten gäller initiativets alla år, till skillnad
 * från övriga nyckeltal som gäller valt år; det anges i etiketten när något initiativ gäller flera år.
 */
function BudgetFigure({ initiatives }: { initiatives: Initiative[] }) {
  const budgets = initiatives.flatMap((initiative) => (initiative.budget ? [initiative.budget] : []));
  const coversSeveralYears = initiatives.some((initiative) => initiative.budget && initiative.years.length > 1);
  return (
    <KeyFigure
      className="card stat"
      label={coversSeveralYears ? 'Budget (alla år)' : 'Budget'}
      title={`Summan av budgeten för de visade initiativen. ${budgets.length} av ${initiatives.length} initiativ har budget.`}
      value={budgets.length > 0 ? formatSek(budgets.reduce((total, budget) => total + budget, 0)) : MISSING}
    />
  );
}
