import { EXTERNAL_STAFF, EXTERNAL_STAFF_ID, type AppData } from '../domain/types';

/** Visas när ett värde saknas. */
export const MISSING = '–';

export const sectionName = (data: AppData, sectionId: string | undefined) =>
  data.sections.find((section) => section.id === sectionId)?.name ?? MISSING;

export const ownerName = (data: AppData, ownerId: string) =>
  data.productOwners.find((owner) => owner.id === ownerId)?.name ?? MISSING;

/** Personens namn; Extern personal finns inte bland personalen men har ett fast namn. */
export const personName = (data: AppData, personId: string) =>
  personId === EXTERNAL_STAFF_ID
    ? EXTERNAL_STAFF.name
    : (data.people.find((person) => person.id === personId)?.name ?? MISSING);
