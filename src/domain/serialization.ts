import { DomainError, removeUnusedLockedData } from './operations';
import {
  EXTERNAL_STAFF_ID,
  isTajmaClass,
  type AppData,
  type Initiative,
  type Person,
  type PersonType,
  type ProductOwner,
  type Section,
  type Settings,
  type TajmaClass,
  type TimeMap,
  type TypeSettings,
} from './types';

/** Standardsektion som äldre data utan sektioner flyttas in i. */
export const DEFAULT_SECTION: Section = { id: 'standardsektion', name: 'Standardsektion' };

// ---------------------------------------------------------------- Grundläggande kontroller

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Appen hanterar bara heltal. Äldre data kan innehålla decimaler, som avrundas till närmaste heltal. */
const toWholeNumber = (value: number) => Math.round(value);

const isMissing = (value: unknown) => value === null || value === undefined;

function fail(message: string): never {
  throw new DomainError(`Ogiltig sparad data: ${message}`);
}

function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${what} saknas.`);
  return value;
}

function requireArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) fail(`${what} måste vara en lista.`);
  return value;
}

function optionalNonNegative(value: unknown, what: string): number | null {
  if (isMissing(value)) return null;
  if (!isNonNegativeNumber(value)) fail(`${what} är felaktig.`);
  return toWholeNumber(value);
}

// ---------------------------------------------------------------- Entiteter

/** Tom sträng = sektion saknas (äldre data); tilldelas standardsektionen i `resolveSections`. */
const UNASSIGNED_SECTION = '';

function parseSection(value: unknown): Section {
  if (!isRecord(value)) fail('en sektion har fel format.');
  return { id: requireString(value.id, 'Sektions-id'), name: requireString(value.name, 'Sektionsnamn') };
}

function parseTypeSettings(value: unknown, type: PersonType): TypeSettings {
  if (!isRecord(value) || !isNonNegativeNumber(value.hourlyRate) || !isNonNegativeNumber(value.monthlyHours)) {
    fail(`inställningar för ${type} är felaktiga.`);
  }
  return { hourlyRate: toWholeNumber(value.hourlyRate), monthlyHours: toWholeNumber(value.monthlyHours) };
}

function parsePerson(value: unknown): Person {
  if (!isRecord(value)) fail('en person har fel format.');
  if (value.type !== 'employee' && value.type !== 'consultant') fail(`okänd personaltyp "${String(value.type)}".`);
  if (value.id === EXTERNAL_STAFF_ID) fail(`person-id "${EXTERNAL_STAFF_ID}" är reserverat för Extern personal.`);
  return {
    id: requireString(value.id, 'Person-id'),
    name: requireString(value.name, 'Personnamn'),
    type: value.type,
    sectionId: typeof value.sectionId === 'string' ? value.sectionId : UNASSIGNED_SECTION,
    hourlyRate: optionalNonNegative(value.hourlyRate, 'Timkostnad för en person'),
    monthlyHours: optionalNonNegative(value.monthlyHours, 'Arbetstid för en person'),
    // Saknas i äldre data och för aktiv personal.
    ...(value.deleted === true ? { deleted: true } : {}),
  };
}

function parseOwner(value: unknown): ProductOwner {
  if (!isRecord(value)) fail('en produktägare har fel format.');
  return {
    id: requireString(value.id, 'Produktägar-id'),
    name: requireString(value.name, 'Produktägarnamn'),
    sectionId: typeof value.sectionId === 'string' ? value.sectionId : UNASSIGNED_SECTION,
  };
}

/** Saknas i data från äldre versioner och tolkas då som "ingen budget". */
function parseBudget(value: unknown, initiativeName: string, what: string): number | null {
  if (isMissing(value)) return null;
  // En budget under 0,5 kr blir 0 vid avrundning och är då inte längre en giltig budget.
  if (!isNonNegativeNumber(value) || toWholeNumber(value) === 0) {
    fail(`initiativet "${initiativeName}" har en ogiltig ${what}.`);
  }
  return toWholeNumber(value);
}

/** Saknas i data från äldre versioner och tolkas då som "inget värde". */
function parseTajmaClass(value: unknown, initiativeName: string): TajmaClass | null {
  if (isMissing(value)) return null;
  if (!isTajmaClass(value)) fail(`initiativet "${initiativeName}" har en ogiltig tajmaklass.`);
  return value;
}

function parseInitiative(value: unknown): Initiative {
  if (!isRecord(value)) fail('ett initiativ har fel format.');
  const name = requireString(value.name, 'Initiativnamn');
  const years = requireArray(value.years, 'Initiativets år').map((year) => {
    if (typeof year !== 'number' || !Number.isInteger(year)) fail('ett initiativ har ett ogiltigt år.');
    return year;
  });
  if (years.length === 0) fail(`initiativet "${name}" saknar år.`);
  return {
    id: requireString(value.id, 'Initiativ-id'),
    name,
    productOwnerId: requireString(value.productOwnerId, 'Initiativets produktägare'),
    personIds: requireArray(value.personIds, 'Initiativets personal').map((id) => requireString(id, 'Person-id')),
    years: [...new Set(years)].sort((a, b) => a - b),
    // Äldre versioner hade en enda budget, `budget`, som nu blir den interna budgeten.
    internalBudget: parseBudget(value.internalBudget ?? value.budget, name, 'intern budget'),
    externalBudget: parseBudget(value.externalBudget, name, 'extern budget'),
    tajmaClass: parseTajmaClass(value.tajmaClass, name),
  };
}

// ---------------------------------------------------------------- Samband mellan entiteter

/**
 * Sektioner saknas i data från äldre versioner. Personal och produktägare utan sektion flyttas
 * då in i en standardsektion, som bara skapas om den behövs.
 */
function resolveSections<T extends { name: string; sectionId: string }>(
  sections: Section[],
  items: T[],
): { sections: Section[]; items: T[] } {
  const needsDefault = items.some((item) => item.sectionId === UNASSIGNED_SECTION);
  const allSections =
    needsDefault && !sections.some((section) => section.id === DEFAULT_SECTION.id)
      ? [...sections, DEFAULT_SECTION]
      : sections;
  const knownIds = new Set(allSections.map((section) => section.id));
  const resolved = items.map((item) => {
    const sectionId = item.sectionId === UNASSIGNED_SECTION ? DEFAULT_SECTION.id : item.sectionId;
    if (!knownIds.has(sectionId)) fail(`"${item.name}" pekar på en okänd sektion.`);
    return { ...item, sectionId };
  });
  return { sections: allSections, items: resolved };
}

/** Behåller endast timmar som hör till existerande initiativ, kopplade personer och initiativets år. */
function parseTimeMap<T extends number | null>(
  rawMap: unknown,
  initiatives: Initiative[],
  what: string,
  isValue: (value: unknown) => value is T,
): TimeMap<T> {
  const result: TimeMap<T> = {};
  const source = isRecord(rawMap) ? rawMap : {};
  for (const initiative of initiatives) {
    const byPerson = source[initiative.id];
    if (!isRecord(byPerson)) continue;
    for (const personId of initiative.personIds) {
      const byYear = byPerson[personId];
      if (!isRecord(byYear)) continue;
      for (const year of initiative.years) {
        const months = byYear[String(year)];
        if (months === undefined) continue;
        if (!Array.isArray(months) || months.length !== 12 || !months.every(isValue)) {
          fail(`${what} för initiativet "${initiative.name}" år ${year} är felaktiga.`);
        }
        ((result[initiative.id] ??= {})[personId] ??= {})[year] = months.map((value) =>
          typeof value === 'number' ? (toWholeNumber(value) as T) : value,
        );
      }
    }
  }
  return result;
}

const isActualValue = (value: unknown): value is number | null => value === null || isNonNegativeNumber(value);

// ---------------------------------------------------------------- Inläsning

/**
 * Validerar sparad data, som kan vara skadad eller från en äldre version, och returnerar en
 * konsistent AppData.
 */
export function parseAppData(raw: unknown): AppData {
  if (!isRecord(raw)) fail('ingen budgetdata.');
  if (!isRecord(raw.settings)) fail('inställningar saknas.');

  const settings: Settings = {
    employee: parseTypeSettings(raw.settings.employee, 'employee'),
    consultant: parseTypeSettings(raw.settings.consultant, 'consultant'),
  };

  const parsedSections = raw.sections === undefined ? [] : requireArray(raw.sections, 'Sektioner').map(parseSection);
  const parsedPeople = requireArray(raw.people, 'Personal').map(parsePerson);
  const parsedOwners = requireArray(raw.productOwners, 'Produktägare').map(parseOwner);
  const withPeople = resolveSections(parsedSections, parsedPeople);
  const withOwners = resolveSections(withPeople.sections, parsedOwners);
  const people = withPeople.items;
  const productOwners = withOwners.items;

  const ownerIds = new Set(productOwners.map((owner) => owner.id));
  // Extern personal är inbyggd och finns inte bland personalen, men kan vara kopplad till initiativ.
  const personIds = new Set([...people.map((person) => person.id), EXTERNAL_STAFF_ID]);
  const initiatives = requireArray(raw.initiatives, 'Initiativ')
    .map(parseInitiative)
    .map((initiative) => {
      if (!ownerIds.has(initiative.productOwnerId)) {
        fail(`initiativet "${initiative.name}" pekar på en okänd produktägare.`);
      }
      return { ...initiative, personIds: [...new Set(initiative.personIds)].filter((id) => personIds.has(id)) };
    });

  // Äldre data kan ha personal kopplad till initiativ i andra sektioner. Den tiden blir låst;
  // kopplingar helt utan timmar tas bort, liksom raderad personal som inte längre har någon tid.
  return removeUnusedLockedData({
    settings,
    sections: withOwners.sections,
    people,
    productOwners,
    initiatives,
    // Estimaten hette `hours` i äldre versioner. Utfall saknas i äldre data (= inget rapporterat).
    estimates: parseTimeMap(raw.estimates ?? raw.hours, initiatives, 'timmar', isNonNegativeNumber),
    actuals: parseTimeMap(raw.actuals, initiatives, 'utfall', isActualValue),
  });
}
