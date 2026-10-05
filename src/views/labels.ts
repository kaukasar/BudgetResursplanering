import { EXTERNAL_STAFF, EXTERNAL_STAFF_ID, LOCK_REASON_LABEL, type AppData, type LockReason } from '../domain/types';

/** Visas när ett värde saknas. */
export const MISSING = '–';

export const sectionName = (data: AppData, sectionId: string | undefined) =>
  data.sections.find((section) => section.id === sectionId)?.name ?? MISSING;

export const ownerName = (data: AppData, ownerId: string) =>
  data.productOwners.find((owner) => owner.id === ownerId)?.name ?? MISSING;

/** "Anna Andersson (bytt sektion)" – visar varför personens tid är låst. */
export const nameWithLockReason = (name: string, reason: LockReason | null) =>
  reason ? `${name} (${LOCK_REASON_LABEL[reason]})` : name;

/**
 * Personens namn, med "(raderad)" för raderad personal så att den går att skilja från en ny person
 * med samma namn. Extern personal finns inte bland personalen men har ett fast namn.
 */
export function personName(data: AppData, personId: string): string {
  if (personId === EXTERNAL_STAFF_ID) return EXTERNAL_STAFF.name;
  const person = data.people.find((candidate) => candidate.id === personId);
  if (!person) return MISSING;
  return nameWithLockReason(person.name, person.deleted ? 'deleted' : null);
}
