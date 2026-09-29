import { emptyActuals, getMonthActuals, getMonthEstimates, zeroMonths } from './calc';
import {
  TAJMA_CLASSES,
  type AppData,
  type Initiative,
  type Person,
  type PersonType,
  type ProductOwner,
  type Section,
  type TajmaClass,
  type TimeMap,
  type TypeSettings,
} from './types';

export class DomainError extends Error {}

// ---------------------------------------------------------------- Validering

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new DomainError('Namn måste anges.');
  return trimmed;
}

function requireNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError(`${label} måste vara ett tal som är 0 eller större.`);
  }
  return value;
}

function optionalNonNegative(value: number | null, label: string): number | null {
  return value === null ? null : requireNonNegative(value, label);
}

function requireSection(data: AppData, sectionId: string): string {
  if (!data.sections.some((section) => section.id === sectionId)) throw new DomainError('Välj en sektion.');
  return sectionId;
}

function requireOwner(data: AppData, ownerId: string): string {
  if (!data.productOwners.some((owner) => owner.id === ownerId)) {
    throw new DomainError('Initiativet måste tillhöra en produktägare.');
  }
  return ownerId;
}

function requireInitiative(data: AppData, id: string): Initiative {
  const initiative = data.initiatives.find((candidate) => candidate.id === id);
  if (!initiative) throw new DomainError('Initiativet finns inte.');
  return initiative;
}

function normalizeYears(years: number[]): number[] {
  const unique = [...new Set(years)].sort((a, b) => a - b);
  if (unique.length === 0) throw new DomainError('Initiativet måste gälla minst ett år.');
  const invalid = unique.find((year) => !Number.isInteger(year) || year < 1900 || year > 2200);
  if (invalid !== undefined) throw new DomainError(`Ogiltigt år: ${invalid}.`);
  return unique;
}

/** Okända person-id:n och dubbletter tas bort. */
function knownPersonIds(data: AppData, personIds: string[]): string[] {
  const known = new Set(data.people.map((person) => person.id));
  return [...new Set(personIds)].filter((id) => known.has(id));
}

/** Budget är frivillig; anges den måste den vara större än 0. */
function normalizeBudget(budget: number | null | undefined): number | null {
  if (budget === null || budget === undefined) return null;
  if (!Number.isFinite(budget) || budget <= 0) throw new DomainError('Budget måste vara ett belopp större än 0.');
  return budget;
}

/** Tajmaklass är frivillig; anges den måste den vara ett av de tillåtna värdena. */
function normalizeTajmaClass(value: TajmaClass | null | undefined): TajmaClass | null {
  if (value === null || value === undefined) return null;
  if (!TAJMA_CLASSES.includes(value)) throw new DomainError(`Ogiltig tajmaklass: ${String(value)}.`);
  return value;
}

// ---------------------------------------------------------------- Tidskartor (estimat och utfall)

function withoutPerson<T>(map: TimeMap<T>, personId: string): TimeMap<T> {
  return Object.fromEntries(
    Object.entries(map).map(([initiativeId, byPerson]) => {
      const { [personId]: _removed, ...rest } = byPerson;
      return [initiativeId, rest];
    }),
  );
}

function withoutInitiative<T>(map: TimeMap<T>, initiativeId: string): TimeMap<T> {
  const { [initiativeId]: _removed, ...rest } = map;
  return rest;
}

/** Behåller bara timmar för initiativets kvarvarande personer och år. Tomma poster tas bort. */
function keepInitiativePeopleAndYears<T>(map: TimeMap<T>, initiative: Initiative): TimeMap<T> {
  const byPerson: Record<string, Record<string, T[]>> = {};
  for (const [personId, byYear] of Object.entries(map[initiative.id] ?? {})) {
    if (!initiative.personIds.includes(personId)) continue;
    const keptYears = Object.entries(byYear).filter(([year]) => initiative.years.includes(Number(year)));
    if (keptYears.length > 0) byPerson[personId] = Object.fromEntries(keptYears);
  }
  const rest = withoutInitiative(map, initiative.id);
  return Object.keys(byPerson).length > 0 ? { ...rest, [initiative.id]: byPerson } : rest;
}

interface TimeSlot {
  initiativeId: string;
  personId: string;
  year: number;
  month: number;
}

function withMonthValue<T>(map: TimeMap<T>, slot: TimeSlot, value: T, emptyMonths: () => T[]): TimeMap<T> {
  const byPerson = map[slot.initiativeId] ?? {};
  const byYear = byPerson[slot.personId] ?? {};
  const months = [...(byYear[slot.year] ?? emptyMonths())];
  months[slot.month] = value;
  return { ...map, [slot.initiativeId]: { ...byPerson, [slot.personId]: { ...byYear, [slot.year]: months } } };
}

/** Tid kan bara registreras för personer som är kopplade till initiativet, och för initiativets år. */
function requireTimeSlot(data: AppData, slot: TimeSlot): void {
  const initiative = requireInitiative(data, slot.initiativeId);
  if (!initiative.personIds.includes(slot.personId))
    throw new DomainError('Personen är inte kopplad till initiativet.');
  if (!initiative.years.includes(slot.year)) throw new DomainError(`Initiativet gäller inte ${slot.year}.`);
  if (!Number.isInteger(slot.month) || slot.month < 0 || slot.month > 11) throw new DomainError('Ogiltig månad.');
}

// ---------------------------------------------------------------- Inställningar

export function updateTypeSettings(data: AppData, type: PersonType, patch: Partial<TypeSettings>): AppData {
  const next = { ...data.settings[type], ...patch };
  requireNonNegative(next.hourlyRate, 'Timkostnad');
  requireNonNegative(next.monthlyHours, 'Arbetstid');
  return { ...data, settings: { ...data.settings, [type]: next } };
}

// ---------------------------------------------------------------- Sektioner

export function addSection(data: AppData, section: Section): AppData {
  return { ...data, sections: [...data.sections, { ...section, name: requireName(section.name) }] };
}

export function renameSection(data: AppData, id: string, name: string): AppData {
  const cleanName = requireName(name);
  return {
    ...data,
    sections: data.sections.map((section) => (section.id === id ? { ...section, name: cleanName } : section)),
  };
}

export interface SectionContents {
  people: Person[];
  productOwners: ProductOwner[];
  /** Initiativ följer sina produktägare och räknas här bara för information. */
  initiatives: Initiative[];
}

export function sectionContents(data: AppData, sectionId: string): SectionContents {
  const productOwners = data.productOwners.filter((owner) => owner.sectionId === sectionId);
  const ownerIds = new Set(productOwners.map((owner) => owner.id));
  return {
    people: data.people.filter((person) => person.sectionId === sectionId),
    productOwners,
    initiatives: data.initiatives.filter((initiative) => ownerIds.has(initiative.productOwnerId)),
  };
}

/** En sektion får bara raderas när den saknar personal och produktägare (och därmed initiativ). */
export function deleteSection(data: AppData, id: string): AppData {
  const { people, productOwners } = sectionContents(data, id);
  if (people.length > 0 || productOwners.length > 0) {
    throw new DomainError('Sektionen innehåller personal eller produktägare som först måste flyttas eller raderas.');
  }
  return { ...data, sections: data.sections.filter((section) => section.id !== id) };
}

// ---------------------------------------------------------------- Personal

function validatePerson(data: AppData, person: Person): Person {
  return {
    ...person,
    name: requireName(person.name),
    sectionId: requireSection(data, person.sectionId),
    hourlyRate: optionalNonNegative(person.hourlyRate, 'Timkostnad'),
    monthlyHours: optionalNonNegative(person.monthlyHours, 'Arbetstid'),
  };
}

export function addPerson(data: AppData, person: Person): AppData {
  return { ...data, people: [...data.people, validatePerson(data, person)] };
}

export function updatePerson(data: AppData, id: string, patch: Partial<Omit<Person, 'id'>>): AppData {
  return {
    ...data,
    people: data.people.map((person) => (person.id === id ? validatePerson(data, { ...person, ...patch }) : person)),
  };
}

/** Raderar personen, kopplingar till initiativ och alla personens timmar (estimat och utfall). */
export function deletePerson(data: AppData, id: string): AppData {
  return {
    ...data,
    people: data.people.filter((person) => person.id !== id),
    initiatives: data.initiatives.map((initiative) => ({
      ...initiative,
      personIds: initiative.personIds.filter((personId) => personId !== id),
    })),
    estimates: withoutPerson(data.estimates, id),
    actuals: withoutPerson(data.actuals, id),
  };
}

// ---------------------------------------------------------------- Produktägare

function validateOwner(data: AppData, owner: ProductOwner): ProductOwner {
  return { ...owner, name: requireName(owner.name), sectionId: requireSection(data, owner.sectionId) };
}

export function addProductOwner(data: AppData, owner: ProductOwner): AppData {
  return { ...data, productOwners: [...data.productOwners, validateOwner(data, owner)] };
}

/** Byter namn och/eller sektion. Byts sektion följer produktägarens initiativ med. */
export function updateProductOwner(data: AppData, id: string, patch: Partial<Omit<ProductOwner, 'id'>>): AppData {
  return {
    ...data,
    productOwners: data.productOwners.map((owner) =>
      owner.id === id ? validateOwner(data, { ...owner, ...patch }) : owner,
    ),
  };
}

export function initiativesForOwner(data: AppData, ownerId: string): Initiative[] {
  return data.initiatives.filter((initiative) => initiative.productOwnerId === ownerId);
}

/** En produktägare får bara raderas om den saknar kopplade initiativ. */
export function deleteProductOwner(data: AppData, id: string): AppData {
  const linked = initiativesForOwner(data, id);
  if (linked.length > 0) {
    throw new DomainError(
      `Produktägaren har ${linked.length} kopplade initiativ som först måste raderas eller flyttas.`,
    );
  }
  return { ...data, productOwners: data.productOwners.filter((owner) => owner.id !== id) };
}

// ---------------------------------------------------------------- Initiativ

/** Ett initiativ tillhör sin produktägares sektion och kan därför bara byta produktägare inom sektionen. */
function requireSameSection(data: AppData, fromOwnerId: string, toOwnerId: string): void {
  const sectionOf = (ownerId: string) => data.productOwners.find((owner) => owner.id === ownerId)?.sectionId;
  if (sectionOf(fromOwnerId) !== sectionOf(toOwnerId)) {
    throw new DomainError('Initiativet kan bara flyttas till en produktägare i samma sektion.');
  }
}

/** Nytt initiativ: exakt en produktägare, minst en person och minst ett år. */
export function addInitiative(data: AppData, initiative: Initiative): AppData {
  const personIds = knownPersonIds(data, initiative.personIds);
  if (personIds.length === 0) throw new DomainError('Ett nytt initiativ måste ha minst en person kopplad.');
  const validated: Initiative = {
    ...initiative,
    name: requireName(initiative.name),
    productOwnerId: requireOwner(data, initiative.productOwnerId),
    personIds,
    years: normalizeYears(initiative.years),
    budget: normalizeBudget(initiative.budget),
    tajmaClass: normalizeTajmaClass(initiative.tajmaClass),
  };
  return { ...data, initiatives: [...data.initiatives, validated] };
}

/**
 * Uppdaterar ett initiativ. Timmar för personer eller år som tas bort raderas.
 * Till skillnad från nya initiativ får ett befintligt initiativ sakna personal.
 */
export function updateInitiative(data: AppData, id: string, patch: Partial<Omit<Initiative, 'id'>>): AppData {
  const current = requireInitiative(data, id);
  if (patch.productOwnerId) requireSameSection(data, current.productOwnerId, patch.productOwnerId);
  const merged = { ...current, ...patch };
  const next: Initiative = {
    ...merged,
    id,
    name: requireName(merged.name),
    productOwnerId: requireOwner(data, merged.productOwnerId),
    personIds: knownPersonIds(data, merged.personIds),
    years: normalizeYears(merged.years),
    budget: normalizeBudget(merged.budget),
    tajmaClass: normalizeTajmaClass(merged.tajmaClass),
  };
  return {
    ...data,
    initiatives: data.initiatives.map((initiative) => (initiative.id === id ? next : initiative)),
    estimates: keepInitiativePeopleAndYears(data.estimates, next),
    actuals: keepInitiativePeopleAndYears(data.actuals, next),
  };
}

/** Initiativ kan alltid raderas, oavsett kopplade timmar. */
export function deleteInitiative(data: AppData, id: string): AppData {
  return {
    ...data,
    initiatives: data.initiatives.filter((initiative) => initiative.id !== id),
    estimates: withoutInitiative(data.estimates, id),
    actuals: withoutInitiative(data.actuals, id),
  };
}

// ---------------------------------------------------------------- Tidsregistrering

export function setEstimate(
  data: AppData,
  initiativeId: string,
  personId: string,
  year: number,
  month: number,
  hours: number,
): AppData {
  const slot = { initiativeId, personId, year, month };
  requireTimeSlot(data, slot);
  requireNonNegative(hours, 'Antal timmar');
  return { ...data, estimates: withMonthValue(data.estimates, slot, hours, zeroMonths) };
}

/** Sätter utfall. `null` tar bort rapporterat utfall för månaden. */
export function setActual(
  data: AppData,
  initiativeId: string,
  personId: string,
  year: number,
  month: number,
  hours: number | null,
): AppData {
  const slot = { initiativeId, personId, year, month };
  requireTimeSlot(data, slot);
  if (hours !== null) requireNonNegative(hours, 'Antal timmar');
  return { ...data, actuals: withMonthValue(data.actuals, slot, hours, emptyActuals) };
}

/**
 * Fyller i utfall = estimat för månader (t.o.m. `throughMonth`) där inget utfall är rapporterat.
 * Redan rapporterat utfall lämnas orört.
 */
export function fillActualsFromEstimate(
  data: AppData,
  initiativeId: string,
  personId: string,
  year: number,
  throughMonth: number,
): AppData {
  const estimate = getMonthEstimates(data, initiativeId, personId, year);
  const actual = getMonthActuals(data, initiativeId, personId, year);
  let next = data;
  for (let month = 0; month <= Math.min(throughMonth, 11); month++) {
    if (actual[month] === null) next = setActual(next, initiativeId, personId, year, month, estimate[month]!);
  }
  return next;
}
