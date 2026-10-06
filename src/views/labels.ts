import { workerDisplayName } from '../domain/format';
import { EXTERNAL_STAFF, EXTERNAL_STAFF_ID, type AppData } from '../domain/types';

/** Visas när ett värde saknas. */
export const MISSING = '–';

export const sectionName = (data: AppData, sectionId: string | undefined) =>
  data.sections.find((section) => section.id === sectionId)?.name ?? MISSING;

export const ownerName = (data: AppData, ownerId: string) =>
  data.productOwners.find((owner) => owner.id === ownerId)?.name ?? MISSING;

/** Personens namn, med "(raderad)" för raderad personal. Extern personal finns inte bland personalen. */
export function personName(data: AppData, personId: string): string {
  if (personId === EXTERNAL_STAFF_ID) return EXTERNAL_STAFF.name;
  const person = data.people.find((candidate) => candidate.id === personId);
  return person ? workerDisplayName(person) : MISSING;
}
