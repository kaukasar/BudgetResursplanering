import {
  EXTERNAL_STAFF,
  EXTERNAL_STAFF_ID,
  isExternal,
  type AppData,
  type Initiative,
  type LockReason,
  type Measure,
  type MonthActuals,
  type MonthHours,
  type Person,
  type Settings,
  type TimeMap,
  type Worker,
} from './types';

export const zeroMonths = (): MonthHours => Array<number>(12).fill(0);
export const emptyActuals = (): MonthActuals => Array<number | null>(12).fill(null);

/** Summerar timmar, kostnader eller antal. `null` (ej rapporterat utfall) räknas som 0. */
export const sum = (values: readonly (number | null)[]) =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

// ---------------------------------------------------------------- Timkostnad och arbetstid

/**
 * Schablontimkostnad för Extern personal: mitt emellan standardtimkostnaden för anställd och
 * konsult, avrundad till heltal. Följer med när standardvärdena ändras.
 */
export function externalHourlyRate(settings: Settings): number {
  return Math.round((settings.employee.hourlyRate + settings.consultant.hourlyRate) / 2);
}

export function effectiveRate(worker: Worker, settings: Settings): number {
  if (isExternal(worker)) return externalHourlyRate(settings);
  return worker.hourlyRate ?? settings[worker.type].hourlyRate;
}

export function effectiveMonthlyHours(person: Person, settings: Settings): number {
  return person.monthlyHours ?? settings[person.type].monthlyHours;
}

// ---------------------------------------------------------------- Timmar per månad

/** Estimerade timmar per månad för en person i ett initiativ ett visst år (alltid 12 värden). */
export function getMonthEstimates(data: AppData, initiativeId: string, personId: string, year: number): MonthHours {
  const stored = data.estimates[initiativeId]?.[personId]?.[year];
  return zeroMonths().map((_, month) => stored?.[month] ?? 0);
}

/** Rapporterat utfall per månad (alltid 12 värden, `null` = inte rapporterat). */
export function getMonthActuals(data: AppData, initiativeId: string, personId: string, year: number): MonthActuals {
  const stored = data.actuals[initiativeId]?.[personId]?.[year];
  return emptyActuals().map((_, month) => stored?.[month] ?? null);
}

/** Timmar per månad enligt valt mått. Ej rapporterat utfall räknas som 0. */
export function getMonthValues(
  data: AppData,
  initiativeId: string,
  personId: string,
  year: number,
  measure: Measure,
): MonthHours {
  if (measure === 'estimate') return getMonthEstimates(data, initiativeId, personId, year);
  return getMonthActuals(data, initiativeId, personId, year).map((actual) => actual ?? 0);
}

// ---------------------------------------------------------------- Initiativ

export interface InitiativeRow {
  person: Worker;
  /** `null` = tiden kan ändras. */
  lockReason: LockReason | null;
  rate: number;
  months: MonthHours;
  totalHours: number;
  totalCost: number;
}

export interface InitiativeSummary {
  rows: InitiativeRow[];
  monthTotals: MonthHours;
  totalHours: number;
  totalCost: number;
}

/** Timmar och kostnad per person och månad för ett initiativ ett visst år. */
export function summarizeInitiative(
  data: AppData,
  initiative: Initiative,
  year: number,
  measure: Measure = 'estimate',
): InitiativeSummary {
  const rows = linkedPeople(data, initiative).map((person): InitiativeRow => {
    const months = getMonthValues(data, initiative.id, person.id, year, measure);
    const rate = effectiveRate(person, data.settings);
    const totalHours = sum(months);
    return {
      person,
      lockReason: lockReason(data, initiative, person),
      rate,
      months,
      totalHours,
      totalCost: totalHours * rate,
    };
  });
  return {
    rows,
    monthTotals: zeroMonths().map((_, month) => sum(rows.map((row) => row.months[month]!))),
    totalHours: sum(rows.map((row) => row.totalHours)),
    totalCost: sum(rows.map((row) => row.totalCost)),
  };
}

export interface CostByPart {
  /** Personal i sektionen, även låst tid. */
  internal: number;
  /** Extern personal. */
  external: number;
}

/** Kostnaden i en sammanställning, uppdelad på intern personal och Extern personal. */
export function costByPart(summary: InitiativeSummary): CostByPart {
  const costOf = (external: boolean) =>
    sum(summary.rows.filter((row) => isExternal(row.person) === external).map((row) => row.totalCost));
  return { internal: costOf(false), external: costOf(true) };
}

/** Personal kopplad till initiativet, i initiativets ordning. Extern personal kommer alltid sist. */
export function linkedPeople(data: AppData, initiative: Initiative): Worker[] {
  const peopleById = new Map(data.people.map((person) => [person.id, person]));
  const people = initiative.personIds.flatMap((id) => peopleById.get(id) ?? []);
  return hasExternalStaff(initiative) ? [...people, EXTERNAL_STAFF] : people;
}

export const hasExternalStaff = (initiative: Initiative) => initiative.personIds.includes(EXTERNAL_STAFF_ID);

/** Kopplad personal utom Extern personal. */
export const regularPersonIds = (personIds: readonly string[]) => personIds.filter((id) => id !== EXTERNAL_STAFF_ID);

export function ownerSectionId(data: AppData, ownerId: string): string | undefined {
  return data.productOwners.find((owner) => owner.id === ownerId)?.sectionId;
}

/** Ett initiativs sektion är dess produktägares sektion. */
export function initiativeSectionId(data: AppData, initiative: Initiative): string | undefined {
  return ownerSectionId(data, initiative.productOwnerId);
}

/** Personal som inte är raderad. */
export const activePeople = (data: AppData): Person[] => data.people.filter((person) => !person.deleted);

/** Personal som kan kopplas till initiativ i sektionen. */
export const activePeopleInSection = (data: AppData, sectionId: string | undefined): Person[] =>
  activePeople(data).filter((person) => person.sectionId === sectionId);

/**
 * Varför tiden på initiativet är låst för personen, eller `null` om den kan ändras. Personal kan
 * bara arbeta på initiativ i sin egen sektion; den som har bytt sektion eller raderats behåller sin
 * tid, men den går inte att ändra. Extern personal tillhör ingen sektion och låses aldrig.
 */
export function lockReason(data: AppData, initiative: Initiative, worker: Worker): LockReason | null {
  if (isExternal(worker)) return null;
  if (worker.deleted) return 'deleted';
  return worker.sectionId === initiativeSectionId(data, initiative) ? null : 'moved';
}

/** Personer kopplade till initiativet vars tid är låst. */
export function lockedPersonIds(data: AppData, initiative: Initiative): string[] {
  return linkedPeople(data, initiative)
    .filter((worker) => lockReason(data, initiative, worker) !== null)
    .map((worker) => worker.id);
}

// ---------------------------------------------------------------- Kapacitet

export interface PersonCapacity {
  /** Normal arbetstid per månad. */
  capacity: number;
  /** Personens totala tid per månad i alla initiativ. */
  monthTotals: MonthHours;
  /** Per månad: tiden överskrider den normala arbetstiden. */
  overallocated: boolean[];
}

/**
 * En persons totala tid per månad i alla initiativ (oavsett sektion) jämfört med den normala
 * arbetstiden. Endast initiativ där personen är kopplad och som gäller året räknas.
 */
export function personCapacity(
  data: AppData,
  person: Person,
  year: number,
  measure: Measure = 'estimate',
): PersonCapacity {
  const monthTotals = zeroMonths();
  for (const initiative of data.initiatives) {
    if (!initiative.personIds.includes(person.id) || !initiative.years.includes(year)) continue;
    getMonthValues(data, initiative.id, person.id, year, measure).forEach((hours, month) => {
      monthTotals[month]! += hours;
    });
  }
  const capacity = effectiveMonthlyHours(person, data.settings);
  return { capacity, monthTotals, overallocated: monthTotals.map((total) => total > capacity) };
}

export const countOverallocatedMonths = (capacity: PersonCapacity) => capacity.overallocated.filter(Boolean).length;

// ---------------------------------------------------------------- Lagrade timmar (alla år)

const timeMapFor = (data: AppData, measure: Measure): TimeMap<number | null> =>
  measure === 'estimate' ? data.estimates : data.actuals;

/** Summa av alla lagrade timmar för en person i ett initiativ, alla år. */
export function storedHoursForPersonInInitiative(
  data: AppData,
  initiativeId: string,
  personId: string,
  measure: Measure = 'estimate',
): number {
  const byYear = timeMapFor(data, measure)[initiativeId]?.[personId] ?? {};
  return sum(Object.values(byYear).map(sum));
}

/** Summa av alla lagrade timmar i ett initiativ, alla personer och år. */
export function storedHoursForInitiative(data: AppData, initiativeId: string, measure: Measure = 'estimate'): number {
  const personIds = Object.keys(timeMapFor(data, measure)[initiativeId] ?? {});
  return sum(personIds.map((id) => storedHoursForPersonInInitiative(data, initiativeId, id, measure)));
}

export interface StoredHours {
  estimate: number;
  actual: number;
}

/** Lagrade estimat- och utfallstimmar för en person i ett initiativ, alla år. */
export function storedEstimateAndActual(data: AppData, initiativeId: string, personId: string): StoredHours {
  return {
    estimate: storedHoursForPersonInInitiative(data, initiativeId, personId, 'estimate'),
    actual: storedHoursForPersonInInitiative(data, initiativeId, personId, 'actual'),
  };
}

export const hasStoredHours = (hours: StoredHours) => hours.estimate > 0 || hours.actual > 0;

export interface HoursLoss {
  /** Borttagna personer med lagrade timmar (alla år). */
  people: ({ personId: string } & StoredHours)[];
  /** Borttagna år med lagrade timmar för personer som finns kvar i initiativet. */
  years: ({ year: number } & StoredHours)[];
}

/** Vilka timmar skulle raderas om initiativet fick nya personer och år? */
export function hoursLostByUpdate(
  data: AppData,
  initiative: Initiative,
  next: { personIds: string[]; years: number[] },
): HoursLoss {
  const keptPersonIds = initiative.personIds.filter((id) => next.personIds.includes(id));
  const yearHours = (map: TimeMap<number | null>, year: number) =>
    sum(keptPersonIds.map((id) => sum(map[initiative.id]?.[id]?.[year] ?? [])));

  const people = initiative.personIds
    .filter((id) => !next.personIds.includes(id))
    .map((personId) => ({ personId, ...storedEstimateAndActual(data, initiative.id, personId) }))
    .filter(hasStoredHours);
  const years = initiative.years
    .filter((year) => !next.years.includes(year))
    .map((year) => ({ year, estimate: yearHours(data.estimates, year), actual: yearHours(data.actuals, year) }))
    .filter(hasStoredHours);
  return { people, years };
}

// ---------------------------------------------------------------- Rapportering

/**
 * Index för den sista avslutade månaden i `year` (0 = januari), sett från `today`: 11 för
 * passerade år och -1 om ingen månad har hunnit avslutas.
 */
export function lastCompletedMonth(year: number, today: Date): number {
  if (year < today.getFullYear()) return 11;
  if (year > today.getFullYear()) return -1;
  return today.getMonth() - 1;
}
