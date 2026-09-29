import type { AppData } from '../domain/types';

/** Visas när ett värde saknas. */
export const MISSING = '–';

export const sectionName = (data: AppData, sectionId: string | undefined) =>
  data.sections.find((section) => section.id === sectionId)?.name ?? MISSING;

export const ownerName = (data: AppData, ownerId: string) =>
  data.productOwners.find((owner) => owner.id === ownerId)?.name ?? MISSING;

export const personName = (data: AppData, personId: string) =>
  data.people.find((person) => person.id === personId)?.name ?? MISSING;
