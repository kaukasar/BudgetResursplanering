import { effectiveRate, getMonthActuals, getMonthEstimates, linkedPeople, sumHours, zeroMonths } from './calc';
import type { AppData, Initiative, MonthActuals, MonthHours, Person } from './types';

/**
 * Avvikelse mellan utfall och estimat, räknad endast på månader med rapporterat utfall så att
 * månader som ännu inte rapporterats inte ger en missvisande avvikelse.
 */
export interface Deviation {
  /** Estimat för de månader som har rapporterat utfall. */
  estimate: number;
  actual: number;
  /** Utfall − estimat (positivt = mer tid än planerat). */
  diff: number;
  /** Avvikelse i procent av estimatet; `null` om estimatet är 0. */
  percent: number | null;
  /** Antal person-månader med rapporterat utfall. */
  reportedMonths: number;
}

function toDeviation(estimate: number, actual: number, reportedMonths: number): Deviation {
  const diff = actual - estimate;
  return { estimate, actual, diff, percent: estimate > 0 ? (diff / estimate) * 100 : null, reportedMonths };
}

export function calculateDeviation(estimate: readonly number[], actual: readonly (number | null)[]): Deviation {
  const reported = actual.flatMap((value, month) => (value === null ? [] : [{ value, month }]));
  return toDeviation(
    sumHours(reported.map(({ month }) => estimate[month] ?? 0)),
    sumHours(reported.map(({ value }) => value)),
    reported.length,
  );
}

export function sumDeviations(deviations: readonly Deviation[]): Deviation {
  return toDeviation(
    sumHours(deviations.map((d) => d.estimate)),
    sumHours(deviations.map((d) => d.actual)),
    sumHours(deviations.map((d) => d.reportedMonths)),
  );
}

export interface PersonComparison {
  person: Person;
  rate: number;
  estimate: MonthHours;
  actual: MonthActuals;
  deviation: Deviation;
}

export interface MonthComparison {
  /** Månadens totala estimat, alla personer. */
  estimate: number;
  /** Estimat för de personer som rapporterat utfall månaden – det utfallet jämförs mot. */
  reportedEstimate: number;
  /** Summa rapporterat utfall; `null` om ingen har rapporterat månaden. */
  actual: number | null;
}

export interface InitiativeComparison {
  people: PersonComparison[];
  months: MonthComparison[];
  estimateTotal: number;
  deviation: Deviation;
}

/** Estimat mot utfall per person och månad för ett initiativ ett visst år. */
export function compareInitiative(data: AppData, initiative: Initiative, year: number): InitiativeComparison {
  const people = linkedPeople(data, initiative).map((person): PersonComparison => {
    const estimate = getMonthEstimates(data, initiative.id, person.id, year);
    const actual = getMonthActuals(data, initiative.id, person.id, year);
    const rate = effectiveRate(person, data.settings);
    return { person, rate, estimate, actual, deviation: calculateDeviation(estimate, actual) };
  });

  const months = zeroMonths().map((_, month): MonthComparison => {
    const reporters = people.filter((row) => row.actual[month] !== null);
    return {
      estimate: sumHours(people.map((row) => row.estimate[month]!)),
      reportedEstimate: sumHours(reporters.map((row) => row.estimate[month]!)),
      actual: reporters.length > 0 ? sumHours(reporters.map((row) => row.actual[month]!)) : null,
    };
  });

  return {
    people,
    months,
    estimateTotal: sumHours(months.map((month) => month.estimate)),
    deviation: sumDeviations(people.map((row) => row.deviation)),
  };
}
