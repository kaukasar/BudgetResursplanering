import type { ReactNode } from 'react';
import { formatSek } from '../../domain/format';
import {
  EXTERNAL_STAFF_LABEL,
  isExternal,
  MONTHS_LONG,
  PERSON_TYPE_LABEL,
  type LockReason,
  type Worker,
} from '../../domain/types';
import { nameWithLockReason } from '../labels';

/** "Konsult · 1 250 kr/h", eller för Extern personal "Extern · schablon 878 kr/h". */
export function rateDetails(person: Worker, rate: number): string {
  if (isExternal(person)) return `${EXTERNAL_STAFF_LABEL} · schablon ${formatSek(rate)}/h`;
  return `${PERSON_TYPE_LABEL[person.type]} · ${formatSek(rate)}/h`;
}

interface Props {
  person: Worker;
  details: string;
  /** Låst tid visas med orsaken efter namnet, t.ex. "Anna Andersson (bytt sektion)". */
  lockReason: LockReason | null;
  /** Per månad: personen är överallokerad. Markeras i rött med en förklaring. */
  overallocated?: boolean[];
  /** Innehåll före namnet, t.ex. en fäll-ut-knapp. */
  before?: ReactNode;
  /** Innehåll under detaljraden, t.ex. en åtgärdsknapp. */
  after?: ReactNode;
}

/** Radrubrik med personens namn, detaljer och markering vid överallokering eller låst tid. */
export function PersonCell({ person, details, lockReason, overallocated = [], before, after }: Props) {
  const overMonths = overallocated.flatMap((isOver, month) => (isOver ? [MONTHS_LONG[month]] : []));
  const isOverallocated = overMonths.length > 0;
  const classes = ['person', isOverallocated && 'over', lockReason && 'locked'].filter(Boolean).join(' ');
  return (
    <th
      scope="row"
      className={classes}
      title={isOverallocated ? `Överallokerad i ${overMonths.join(', ')} (summerat över alla initiativ)` : undefined}
    >
      {before}
      <span className="name">{nameWithLockReason(person.name, lockReason)}</span>
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
