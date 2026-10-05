import type { ReactNode } from 'react';
import { KeyFigure } from '../../components/KeyFigure';
import type { BudgetStatus } from '../../domain/budget';
import { formatPercent, formatSek } from '../../domain/format';
import { BUDGET_PART_DEFINITE, BUDGET_PART_LABEL, type Initiative } from '../../domain/types';
import type { WorkView } from '../../store/ui';

interface Props {
  budget: BudgetStatus;
  initiative: Initiative;
  year: number;
  view: WorkView;
}

/**
 * En del av initiativets budget (intern eller extern): beloppet, prognosen (estimerad kostnad) i
 * estimatvyn och utfall och prognos i övriga vyer. Utfallet färgas efter sin egen andel av
 * budgeten, oberoende av prognosen.
 */
export function BudgetSummary({ budget, initiative, year, view }: Props) {
  const isMultiYear = initiative.years.length > 1;
  const period = isMultiYear ? `för ${initiative.years.join(', ')}` : String(year);
  const allYearsSuffix = isMultiYear ? ' (alla år)' : '';
  const label = BUDGET_PART_LABEL[budget.part];
  const ofBudget = `${BUDGET_PART_DEFINITE[budget.part]} för ${initiative.name}`;
  const prognosis = <KeyFigure label={`Prognos${allYearsSuffix}`} value={formatPercent(budget.plannedPercent)} />;
  const overBudgetClass = budget.overBudget ? ' over-budget' : '';

  return (
    <div className="budget-part" role="group" aria-label={label}>
      <KeyFigure label={label} value={formatSek(budget.budget)} />
      {view === 'estimate' ? (
        <div
          className={`budget${overBudgetClass}`}
          title={`Prognos (estimerad kostnad) ${period}: ${formatSek(budget.plannedCost)} av ${formatSek(budget.budget)}`}
        >
          {prognosis}
          <BudgetBar label={`Prognos av ${ofBudget}`} percent={budget.plannedPercent}>
            <span className="prognosis" style={{ width: barWidth(budget.plannedPercent) }} />
          </BudgetBar>
        </div>
      ) : (
        <div
          className={`budget budget-wide${overBudgetClass}`}
          title={`Utfall ${period}: ${formatSek(budget.actualCost)}. Prognos (estimerad kostnad): ${formatSek(budget.plannedCost)}. ${label}: ${formatSek(budget.budget)}`}
        >
          <div className="budget-values">
            <KeyFigure
              label={`Utfall${allYearsSuffix}`}
              value={formatPercent(budget.actualPercent)}
              valueClassName={budget.actualOverBudget ? 'actual-value over' : 'actual-value'}
            />
            {prognosis}
          </div>
          <BudgetBar label={`Utfall och prognos av ${ofBudget}`} percent={budget.actualPercent}>
            <span className="prognosis faint" style={{ width: barWidth(budget.plannedPercent) }} />
            <span
              className={budget.actualOverBudget ? 'actual over' : 'actual'}
              style={{ width: barWidth(budget.actualPercent) }}
            />
          </BudgetBar>
        </div>
      )}
    </div>
  );
}

const barWidth = (percent: number) => `${Math.min(100, percent)}%`;

function BudgetBar({ label, percent, children }: { label: string; percent: number; children: ReactNode }) {
  return (
    <div
      className="budget-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      {children}
    </div>
  );
}
