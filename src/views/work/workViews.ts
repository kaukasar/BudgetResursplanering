import type { Measure } from '../../domain/types';
import type { WorkView } from '../../store/ui';

export const VIEW_LABEL: Record<WorkView, string> = {
  estimate: 'Estimat',
  actual: 'Utfall',
  compare: 'Jämförelse',
};

/** Måttet som tabeller, nyckeltal och kapacitet räknas på. Jämförelsevyn utgår från prognosen, dvs. estimatet. */
export const VIEW_MEASURE: Record<WorkView, Measure> = {
  estimate: 'estimate',
  actual: 'actual',
  compare: 'estimate',
};
