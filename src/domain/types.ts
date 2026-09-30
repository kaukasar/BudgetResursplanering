export type PersonType = 'employee' | 'consultant';

export const PERSON_TYPE_LABEL: Record<PersonType, string> = {
  employee: 'Anställd',
  consultant: 'Konsult',
};

export interface TypeSettings {
  /** Timkostnad i SEK/h. */
  hourlyRate: number;
  /** Normal arbetstid i timmar per månad. */
  monthlyHours: number;
}

export type Settings = Record<PersonType, TypeSettings>;

/** Högsta nivån i hierarkin. Personal och produktägare tillhör exakt en sektion. */
export interface Section {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  type: PersonType;
  /** Hemsektion. Personen kan ändå kopplas till initiativ i andra sektioner. */
  sectionId: string;
  /** Egen timkostnad. `null` = ärv från typens globala inställning. */
  hourlyRate: number | null;
  /** Egen arbetstid per månad. `null` = ärv från typens globala inställning. */
  monthlyHours: number | null;
}

export interface ProductOwner {
  id: string;
  name: string;
  /** Produktägarens initiativ tillhör samma sektion. */
  sectionId: string;
}

export const TAJMA_CLASSES = ['IMM', 'Vidareutveckling', 'Drift'] as const;
export type TajmaClass = (typeof TAJMA_CLASSES)[number];

export interface Initiative {
  id: string;
  name: string;
  productOwnerId: string;
  personIds: string[];
  /** Kalenderår som initiativet är relevant för, sorterade stigande. */
  years: number[];
  /** Frivillig totalbudget i SEK för initiativets alla år. */
  budget?: number | null;
  tajmaClass?: TajmaClass | null;
}

/** Timmar per månad (index 0 = januari … 11 = december). */
export type MonthHours = number[];

/** Utfall per månad. `null` = inget utfall rapporterat, vilket skiljer sig från rapporterade 0 h. */
export type MonthActuals = (number | null)[];

/** Tid per initiativ-id → person-id → år → månad. Samma struktur för estimat och utfall. */
export type TimeMap<Month> = Record<string, Record<string, Record<string, Month[]>>>;

export type Measure = 'estimate' | 'actual';

export interface AppData {
  settings: Settings;
  sections: Section[];
  people: Person[];
  productOwners: ProductOwner[];
  initiatives: Initiative[];
  /** Planerad tid. */
  estimates: TimeMap<number>;
  /** Faktiskt nedlagd tid. */
  actuals: TimeMap<number | null>;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'] as const;

export const MONTHS_LONG = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
] as const;

export const DEFAULT_SETTINGS: Settings = {
  employee: { hourlyRate: 625, monthlyHours: 160 },
  consultant: { hourlyRate: 1130, monthlyHours: 160 },
};

export function emptyData(): AppData {
  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    sections: [],
    people: [],
    productOwners: [],
    initiatives: [],
    estimates: {},
    actuals: {},
  };
}

export function isEmptyData(data: AppData): boolean {
  return [data.sections, data.people, data.productOwners, data.initiatives].every((list) => list.length === 0);
}
