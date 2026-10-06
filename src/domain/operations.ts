import {
  activePeople,
  emptyActuals,
  getMonthActuals,
  getMonthEstimates,
  hasStoredHours,
  linkedPeople,
  lockedPersonIds,
  lockReason,
  ownerSectionId,
  regularPersonIds,
  storedEstimateAndActual,
  zeroMonths,
} from './calc';
import {
  EXTERNAL_STAFF_ID,
  isTajmaClass,
  LOCK_REASON_LABEL,
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

/** Appen hanterar bara heltal, både för tid och pengar. */
function requireWholeNumber(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError(`${label} måste vara ett heltal som är 0 eller större.`);
  }
  return value;
}

function optionalWholeNumber(value: number | null, label: string): number | null {
  return value === null ? null : requireWholeNumber(value, label);
}

function requireSection(data: AppData, sectionId: string | null): string {
  if (sectionId === null || !data.sections.some((section) => section.id === sectionId)) {
    throw new DomainError('Välj en sektion.');
  }
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

/** Ett rimligt årtal; skyddar mot felskrivningar som 226 eller 20026. */
export const isValidYear = (year: number) => Number.isInteger(year) && year >= 1900 && year <= 2200;

function normalizeYears(years: number[]): number[] {
  const unique = [...new Set(years)].sort((a, b) => a - b);
  if (unique.length === 0) throw new DomainError('Initiativet måste gälla minst ett år.');
  const invalid = unique.find((year) => !isValidYear(year));
  if (invalid !== undefined) throw new DomainError(`Ogiltigt år: ${invalid}.`);
  return unique;
}

/** Okända person-id:n och dubbletter tas bort. Extern personal är alltid känd. */
function knownPersonIds(data: AppData, personIds: string[]): string[] {
  const known = new Set([...data.people.map((person) => person.id), EXTERNAL_STAFF_ID]);
  return [...new Set(personIds)].filter((id) => known.has(id));
}

/**
 * Personal kan bara kopplas till initiativ i sin egen sektion, och raderad personal kan inte kopplas
 * alls. Personal från andra delar av organisationen registreras som Extern personal.
 */
function requireLinkable(data: AppData, sectionId: string | undefined, personIds: string[]): void {
  for (const person of data.people.filter((candidate) => personIds.includes(candidate.id))) {
    if (person.deleted) throw new DomainError(`${person.name} är raderad och kan inte kopplas till initiativ.`);
    if (person.sectionId !== sectionId) {
      throw new DomainError(
        `${person.name} tillhör en annan sektion. Endast personal i initiativets sektion kan kopplas.`,
      );
    }
  }
}

/** Intern och extern budget är frivilliga; anges en budget måste den vara ett heltal större än 0. */
function normalizeBudget(budget: number | null | undefined, label: string): number | null {
  if (budget === null || budget === undefined) return null;
  if (!Number.isInteger(budget) || budget <= 0) throw new DomainError(`${label} måste vara ett heltal större än 0.`);
  return budget;
}

/** Tajmaklass är frivillig; anges den måste den vara ett av de tillåtna värdena. */
function normalizeTajmaClass(value: TajmaClass | null | undefined): TajmaClass | null {
  if (value === null || value === undefined) return null;
  if (!isTajmaClass(value)) throw new DomainError(`Ogiltig tajmaklass: ${String(value)}.`);
  return value;
}

// ---------------------------------------------------------------- Tidskartor (estimat och utfall)

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

/**
 * Tid kan bara registreras för personer som är kopplade till initiativet, och för initiativets år.
 * Låst tid (personen har bytt sektion eller är raderad) kan inte ändras.
 */
function requireTimeSlot(data: AppData, slot: TimeSlot): void {
  const initiative = requireInitiative(data, slot.initiativeId);
  const worker = linkedPeople(data, initiative).find((candidate) => candidate.id === slot.personId);
  if (!worker) throw new DomainError('Personen är inte kopplad till initiativet.');
  const reason = lockReason(data, initiative, worker);
  if (reason) throw new DomainError(`Tiden för ${worker.name} är låst (${LOCK_REASON_LABEL[reason]}).`);
  if (!initiative.years.includes(slot.year)) throw new DomainError(`Initiativet gäller inte ${slot.year}.`);
  if (!Number.isInteger(slot.month) || slot.month < 0 || slot.month > 11) throw new DomainError('Ogiltig månad.');
}

/**
 * Låsta kopplingar utan några timmar bevarar ingen tid och tas bort, t.ex. när en person byter
 * sektion eller raderas innan någon tid har registrerats.
 */
function pruneEmptyLockedLinks(data: AppData): AppData {
  let changed = false;
  const initiatives = data.initiatives.map((initiative) => {
    const empty = lockedPersonIds(data, initiative).filter(
      (personId) => !hasStoredHours(storedEstimateAndActual(data, initiative.id, personId)),
    );
    if (empty.length === 0) return initiative;
    changed = true;
    return { ...initiative, personIds: initiative.personIds.filter((personId) => !empty.includes(personId)) };
  });
  if (!changed) return data;
  return {
    ...data,
    initiatives,
    estimates: initiatives.reduce((map, initiative) => keepInitiativePeopleAndYears(map, initiative), data.estimates),
    actuals: initiatives.reduce((map, initiative) => keepInitiativePeopleAndYears(map, initiative), data.actuals),
  };
}

/**
 * Raderad personal finns bara kvar för den låsta tidens skull. När ingen tid finns kvar, t.ex. när
 * initiativen har raderats, tas personen bort helt. Annars skulle personen för alltid hindra att
 * sektionen raderas.
 */
function removeDeletedPeopleWithoutTime(data: AppData): AppData {
  const linkedIds = new Set(data.initiatives.flatMap((initiative) => initiative.personIds));
  const people = data.people.filter((person) => !person.deleted || linkedIds.has(person.id));
  return people.length === data.people.length ? data : { ...data, people };
}

/** Tar bort låsta kopplingar och raderad personal som inte längre bevarar någon tid. */
export function removeUnusedLockedData(data: AppData): AppData {
  return removeDeletedPeopleWithoutTime(pruneEmptyLockedLinks(data));
}

// ---------------------------------------------------------------- Inställningar

export function updateTypeSettings(data: AppData, type: PersonType, patch: Partial<TypeSettings>): AppData {
  const next = { ...data.settings[type], ...patch };
  requireWholeNumber(next.hourlyRate, 'Timkostnad');
  requireWholeNumber(next.monthlyHours, 'Arbetstid');
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
  /** Aktiv personal. Raderad personal räknas inte och hindrar inte att sektionen raderas. */
  people: Person[];
  productOwners: ProductOwner[];
  /** Initiativ följer sina produktägare och räknas här bara för information. */
  initiatives: Initiative[];
}

export function sectionContents(data: AppData, sectionId: string): SectionContents {
  const productOwners = data.productOwners.filter((owner) => owner.sectionId === sectionId);
  const ownerIds = new Set(productOwners.map((owner) => owner.id));
  return {
    people: activePeople(data).filter((person) => person.sectionId === sectionId),
    productOwners,
    initiatives: data.initiatives.filter((initiative) => ownerIds.has(initiative.productOwnerId)),
  };
}

/** Tom = varken personal eller produktägare, och därmed inga initiativ. */
export const isSectionEmpty = (contents: SectionContents) =>
  contents.people.length + contents.productOwners.length === 0;

/**
 * Flyttar allt innehåll i en sektion till en annan: personal (även raderad), produktägare och
 * därmed deras initiativ. Allt flyttas tillsammans, så att ingen personal låses på sina initiativ.
 */
export function moveSectionContents(data: AppData, fromSectionId: string, toSectionId: string): AppData {
  requireSection(data, toSectionId);
  if (fromSectionId === toSectionId) throw new DomainError('Välj en annan sektion att flytta till.');
  return {
    ...data,
    people: data.people.map((person) =>
      person.sectionId === fromSectionId ? { ...person, sectionId: toSectionId } : person,
    ),
    productOwners: data.productOwners.map((owner) =>
      owner.sectionId === fromSectionId ? { ...owner, sectionId: toSectionId } : owner,
    ),
  };
}

/**
 * En sektion får bara raderas när den saknar personal och produktägare. Innehållet flyttas först
 * till en annan sektion; en sektion med data kan aldrig raderas. Raderad personal hindrar inte
 * raderingen utan blir utan sektion, och deras låsta tid finns kvar.
 */
export function deleteSection(data: AppData, id: string): AppData {
  if (!isSectionEmpty(sectionContents(data, id))) {
    throw new DomainError('Sektionen har innehåll som först måste flyttas till en annan sektion.');
  }
  return {
    ...data,
    sections: data.sections.filter((section) => section.id !== id),
    people: data.people.map((person) => (person.sectionId === id ? { ...person, sectionId: null } : person)),
  };
}

// ---------------------------------------------------------------- Personal

function validatePerson(data: AppData, person: Person): Person {
  if (person.id === EXTERNAL_STAFF_ID) throw new DomainError('Id:t är reserverat för Extern personal.');
  return {
    ...person,
    name: requireName(person.name),
    sectionId: requireSection(data, person.sectionId),
    hourlyRate: optionalWholeNumber(person.hourlyRate, 'Timkostnad'),
    monthlyHours: optionalWholeNumber(person.monthlyHours, 'Arbetstid'),
  };
}

export function addPerson(data: AppData, person: Person): AppData {
  return { ...data, people: [...data.people, validatePerson(data, person)] };
}

export type PersonPatch = Partial<Omit<Person, 'id' | 'deleted'>>;

/**
 * Ändrar en person. Byter personen sektion låses tiden på den gamla sektionens initiativ: den
 * finns kvar men kan inte ändras. Kopplingar utan timmar tas bort.
 */
export function updatePerson(data: AppData, id: string, patch: PersonPatch): AppData {
  if (data.people.find((person) => person.id === id)?.deleted) {
    throw new DomainError('Personen är raderad och kan inte ändras.');
  }
  return removeUnusedLockedData({
    ...data,
    people: data.people.map((person) => (person.id === id ? validatePerson(data, { ...person, ...patch }) : person)),
  });
}

/**
 * Raderar personen. Tiden som redan registrerats finns kvar och räknas med, men låses, och
 * personen kan inte väljas igen. Kopplingar utan timmar tas bort, och saknar personen tid helt
 * tas den bort helt.
 */
export function deletePerson(data: AppData, id: string): AppData {
  return removeUnusedLockedData({
    ...data,
    people: data.people.map((person) => (person.id === id ? { ...person, deleted: true } : person)),
  });
}

/** Initiativ där personens tid låses om personen byter till `newSectionId`. */
export function initiativesLockedBySectionChange(data: AppData, personId: string, newSectionId: string): Initiative[] {
  return data.initiatives.filter(
    (initiative) =>
      initiative.personIds.includes(personId) && ownerSectionId(data, initiative.productOwnerId) !== newSectionId,
  );
}

// ---------------------------------------------------------------- Produktägare

function validateOwner(data: AppData, owner: ProductOwner): ProductOwner {
  return { ...owner, name: requireName(owner.name), sectionId: requireSection(data, owner.sectionId) };
}

export function addProductOwner(data: AppData, owner: ProductOwner): AppData {
  return { ...data, productOwners: [...data.productOwners, validateOwner(data, owner)] };
}

/**
 * Byter namn och/eller sektion. Initiativ stannar i sin sektion med sin personal, så en produktägare
 * med initiativ kan bara byta sektion när initiativen först har fått en ny produktägare.
 */
export function updateProductOwner(data: AppData, id: string, patch: Partial<Omit<ProductOwner, 'id'>>): AppData {
  const current = data.productOwners.find((owner) => owner.id === id);
  const linked = initiativesForOwner(data, id);
  if (current && patch.sectionId && patch.sectionId !== current.sectionId && linked.length > 0) {
    throw new DomainError(
      `Produktägaren har ${linked.length} initiativ som först måste få en ny produktägare i sin nuvarande sektion.`,
    );
  }
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

/** En produktägare får bara raderas när dess initiativ har fått en ny produktägare. */
export function deleteProductOwner(data: AppData, id: string): AppData {
  const linked = initiativesForOwner(data, id);
  if (linked.length > 0) {
    throw new DomainError(`Produktägaren har ${linked.length} initiativ som först måste få en ny produktägare.`);
  }
  return { ...data, productOwners: data.productOwners.filter((owner) => owner.id !== id) };
}

// ---------------------------------------------------------------- Initiativ

/** Ett initiativ tillhör sin produktägares sektion och kan därför bara byta produktägare inom sektionen. */
function requireSameSection(data: AppData, fromOwnerId: string, toOwnerId: string): void {
  if (ownerSectionId(data, fromOwnerId) !== ownerSectionId(data, toOwnerId)) {
    throw new DomainError('Initiativet kan bara flyttas till en produktägare i samma sektion.');
  }
}

/**
 * Nytt initiativ: exakt en produktägare, minst en person och minst ett år. Personalen måste tillhöra
 * produktägarens sektion. Extern personal räknas inte som en person i kravet på minst en person.
 */
export function addInitiative(data: AppData, initiative: Initiative): AppData {
  const productOwnerId = requireOwner(data, initiative.productOwnerId);
  const personIds = knownPersonIds(data, initiative.personIds);
  if (regularPersonIds(personIds).length === 0) {
    throw new DomainError('Ett nytt initiativ måste ha minst en person kopplad.');
  }
  requireLinkable(data, ownerSectionId(data, productOwnerId), personIds);
  const validated: Initiative = {
    ...initiative,
    name: requireName(initiative.name),
    productOwnerId,
    personIds,
    years: normalizeYears(initiative.years),
    internalBudget: normalizeBudget(initiative.internalBudget, 'Intern budget'),
    externalBudget: normalizeBudget(initiative.externalBudget, 'Extern budget'),
    tajmaClass: normalizeTajmaClass(initiative.tajmaClass),
  };
  return { ...data, initiatives: [...data.initiatives, validated] };
}

/**
 * Uppdaterar ett initiativ. Timmar för personer eller år som tas bort raderas. Ny personal måste
 * tillhöra initiativets sektion. Låst tid kan inte ändras, så personer med låst tid finns alltid
 * kvar. Till skillnad från nya initiativ får ett befintligt initiativ sakna personal.
 */
export function updateInitiative(data: AppData, id: string, patch: Partial<Omit<Initiative, 'id'>>): AppData {
  const current = requireInitiative(data, id);
  if (patch.productOwnerId) requireSameSection(data, current.productOwnerId, patch.productOwnerId);
  const merged = { ...current, ...patch };
  const productOwnerId = requireOwner(data, merged.productOwnerId);
  const requested = knownPersonIds(data, merged.personIds);
  const added = requested.filter((personId) => !current.personIds.includes(personId));
  requireLinkable(data, ownerSectionId(data, productOwnerId), added);
  const locked = lockedPersonIds(data, current).filter((personId) => !requested.includes(personId));
  const next: Initiative = {
    ...merged,
    id,
    name: requireName(merged.name),
    productOwnerId,
    personIds: [...requested, ...locked],
    years: normalizeYears(merged.years),
    internalBudget: normalizeBudget(merged.internalBudget, 'Intern budget'),
    externalBudget: normalizeBudget(merged.externalBudget, 'Extern budget'),
    tajmaClass: normalizeTajmaClass(merged.tajmaClass),
  };
  return removeUnusedLockedData({
    ...data,
    initiatives: data.initiatives.map((initiative) => (initiative.id === id ? next : initiative)),
    estimates: keepInitiativePeopleAndYears(data.estimates, next),
    actuals: keepInitiativePeopleAndYears(data.actuals, next),
  });
}

/** Initiativ kan alltid raderas, oavsett kopplade timmar. */
export function deleteInitiative(data: AppData, id: string): AppData {
  return removeUnusedLockedData({
    ...data,
    initiatives: data.initiatives.filter((initiative) => initiative.id !== id),
    estimates: withoutInitiative(data.estimates, id),
    actuals: withoutInitiative(data.actuals, id),
  });
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
  requireWholeNumber(hours, 'Antal timmar');
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
  if (hours !== null) requireWholeNumber(hours, 'Antal timmar');
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
