import { initiativeSectionId } from './calc';
import { isTajmaClass, type AppData, type Initiative, type ProductOwner, type TajmaClass } from './types';

/** Värdena för "alla" i väljarna för sektion, produktägare och tajmaklass. */
export const ALL_SECTIONS = '';
export const ALL_OWNERS = '';
export const ALL_TAJMA_CLASSES = '';
/** Initiativ utan tajmaklass. */
export const NO_TAJMA_CLASS = 'none';

export type TajmaClassFilter = typeof ALL_TAJMA_CLASSES | typeof NO_TAJMA_CLASS | TajmaClass;

export const isTajmaClassFilter = (value: unknown): value is TajmaClassFilter =>
  value === ALL_TAJMA_CLASSES || value === NO_TAJMA_CLASS || isTajmaClass(value);

/** Arbetslägets filter. */
export interface InitiativeFilter {
  year: number;
  sectionId: string;
  ownerId: string;
  tajmaClass: TajmaClassFilter;
}

function matchesTajmaClass(initiative: Initiative, filter: TajmaClassFilter): boolean {
  if (filter === ALL_TAJMA_CLASSES) return true;
  if (filter === NO_TAJMA_CLASS) return !initiative.tajmaClass;
  return initiative.tajmaClass === filter;
}

/** Initiativ som gäller året och, om angivet, tillhör sektionen och produktägaren och har tajmaklassen. */
export function filterInitiatives(data: AppData, filter: InitiativeFilter): Initiative[] {
  return data.initiatives.filter(
    (initiative) =>
      initiative.years.includes(filter.year) &&
      (filter.sectionId === ALL_SECTIONS || initiativeSectionId(data, initiative) === filter.sectionId) &&
      (filter.ownerId === ALL_OWNERS || initiative.productOwnerId === filter.ownerId) &&
      matchesTajmaClass(initiative, filter.tajmaClass),
  );
}

/** Produktägarna i sektionen, eller alla produktägare när ingen sektion är vald. */
export function ownersInSection(data: AppData, sectionId: string): ProductOwner[] {
  return data.productOwners.filter((owner) => sectionId === ALL_SECTIONS || owner.sectionId === sectionId);
}

/**
 * Ett sparat filter kan peka på sådant som inte längre finns: en raderad sektion eller produktägare,
 * en produktägare utanför vald sektion eller en okänd tajmaklass. Då gäller "alla" i stället.
 */
export function resolveFilter(data: AppData, saved: InitiativeFilter): InitiativeFilter {
  const sectionId = data.sections.some((section) => section.id === saved.sectionId) ? saved.sectionId : ALL_SECTIONS;
  const ownerId = ownersInSection(data, sectionId).some((owner) => owner.id === saved.ownerId)
    ? saved.ownerId
    : ALL_OWNERS;
  const tajmaClass = isTajmaClassFilter(saved.tajmaClass) ? saved.tajmaClass : ALL_TAJMA_CLASSES;
  return { year: saved.year, sectionId, ownerId, tajmaClass };
}

/** Åren i årsväljaren: alla år som förekommer på något initiativ samt innevarande och valt år, stigande. */
export function selectableYears(data: AppData, selectedYear: number, currentYear: number): number[] {
  const initiativeYears = data.initiatives.flatMap((initiative) => initiative.years);
  return [...new Set([...initiativeYears, currentYear, selectedYear])].sort((a, b) => a - b);
}
