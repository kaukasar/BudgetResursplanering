import { summarizeInitiative, sumHours } from './calc';
import {
  BUDGET_PARTS,
  budgetOf,
  isExternal,
  type AppData,
  type BudgetPart,
  type Initiative,
  type Measure,
  type Worker,
} from './types';

export interface BudgetStatus {
  part: BudgetPart;
  budget: number;
  /** Prognos = estimerad kostnad för initiativets alla år. Påverkas aldrig av utfall. */
  plannedCost: number;
  plannedPercent: number;
  /** Prognosen överstiger budgeten. */
  overBudget: boolean;
  /** Kostnad för rapporterat utfall, alla år. */
  actualCost: number;
  actualPercent: number;
  /** Utfallet är 101 % eller mer av budgeten, avrundat till hela procent som i gränssnittet. */
  actualOverBudget: boolean;
}

/**
 * Prognos (estimerad kostnad) och utfall för initiativets alla år, jämfört med en del av budgeten:
 * den interna budgeten mot tid från personal i sektionen (även låst tid), den externa mot tid från
 * Extern personal. `null` om initiativet saknar den delen av budgeten.
 */
export function calculateBudgetStatus(data: AppData, initiative: Initiative, part: BudgetPart): BudgetStatus | null {
  const budget = budgetOf(initiative, part);
  if (!budget || budget <= 0) return null;

  const belongsToPart = (worker: Worker) => isExternal(worker) === (part === 'external');
  const costForAllYears = (measure: Measure) =>
    sumHours(
      initiative.years.flatMap((year) =>
        summarizeInitiative(data, initiative, year, measure)
          .rows.filter((row) => belongsToPart(row.person))
          .map((row) => row.totalCost),
      ),
    );
  const percentOfBudget = (cost: number) => (cost / budget) * 100;
  const plannedCost = costForAllYears('estimate');
  const actualCost = costForAllYears('actual');

  return {
    part,
    budget,
    plannedCost,
    plannedPercent: percentOfBudget(plannedCost),
    overBudget: plannedCost > budget,
    actualCost,
    actualPercent: percentOfBudget(actualCost),
    // Avrundat som i gränssnittet: 100,4 % visas som "100 %" och räknas inte som över budget.
    actualOverBudget: Math.round(percentOfBudget(actualCost)) > 100,
  };
}

/** Budgetstatus för de delar av budgeten som initiativet har, intern före extern. */
export function budgetStatuses(data: AppData, initiative: Initiative): BudgetStatus[] {
  return BUDGET_PARTS.flatMap((part) => calculateBudgetStatus(data, initiative, part) ?? []);
}
