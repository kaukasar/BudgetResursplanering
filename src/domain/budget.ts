import { summarizeInitiative, sumHours } from './calc';
import type { AppData, Initiative, Measure } from './types';

export interface BudgetStatus {
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
 * Prognos (estimerad kostnad) och utfall jämfört med initiativets totalbudget för alla år.
 * `null` om initiativet saknar budget.
 */
export function calculateBudgetStatus(data: AppData, initiative: Initiative): BudgetStatus | null {
  const budget = initiative.budget;
  if (!budget || budget <= 0) return null;

  const costForAllYears = (measure: Measure) =>
    sumHours(initiative.years.map((year) => summarizeInitiative(data, initiative, year, measure).totalCost));
  const percentOfBudget = (cost: number) => (cost / budget) * 100;
  const plannedCost = costForAllYears('estimate');
  const actualCost = costForAllYears('actual');

  return {
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
