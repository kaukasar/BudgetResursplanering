import type { ReactNode } from 'react';
import { formatSek } from '../../domain/format';
import {
  EXTERNAL_STAFF_LABEL,
  isExternal,
  MONTHS_LONG,
  PERSON_TYPE_LABEL,
  type AppData,
  type Worker,
} from '../../domain/types';
import { sectionName } from '../labels';

/**
 * "Konsult · 1 250 kr/h · från Digitala kanaler" – hemsektionen visas bara för inlånad personal.
 * Extern personal: "Extern · schablon 878 kr/h".
 */
export function rateDetails(data: AppData, person: Worker, rate: number, initiativeSectionId?: string): string {
  if (isExternal(person)) return `${EXTERNAL_STAFF_LABEL} · schablon ${formatSek(rate)}/h`;
  const parts = [PERSON_TYPE_LABEL[person.type], `${formatSek(rate)}/h`];
  if (initiativeSectionId && person.sectionId !== initiativeSectionId) {
    parts.push(`från ${sectionName(data, person.sectionId)}`);
  }
  return parts.join(' · ');
}

interface Props {
  person: Worker;
  details: string;
  /** Per månad: personen är överallokerad. Markeras i rött med en förklaring. */
  overallocated?: boolean[];
  /** Innehåll före namnet, t.ex. en fäll-ut-knapp. */
  before?: ReactNode;
  /** Innehåll under detaljraden, t.ex. en åtgärdsknapp. */
  after?: ReactNode;
}

/** Radrubrik med personens namn, detaljer och markering vid överallokering. */
export function PersonCell({ person, details, overallocated = [], before, after }: Props) {
  const overMonths = overallocated.flatMap((isOver, month) => (isOver ? [MONTHS_LONG[month]] : []));
  const isOverallocated = overMonths.length > 0;
  return (
    <th
      scope="row"
      className={isOverallocated ? 'person over' : 'person'}
      title={isOverallocated ? `Överallokerad i ${overMonths.join(', ')} (summerat över alla initiativ)` : undefined}
    >
      {before}
      <span className="name">{person.name}</span>
      {isOverallocated && (
        <span className="over-flag" aria-label="överallokerad">
          !
        </span>
      )}
      <span className="meta">{details}</span>
      {after}
    </th>
  );
}
