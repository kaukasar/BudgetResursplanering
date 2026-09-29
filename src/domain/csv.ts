import { effectiveRate, getMonthActuals, getMonthEstimates, personCapacity, type PersonCapacity } from './calc';
import { compareByName } from './sorting';
import { MONTHS_LONG, PERSON_TYPE_LABEL, type AppData } from './types';

const SEPARATOR = ';';
const LINE_BREAK = '\r\n';
/** Byte order mark: får Excel att läsa filen som UTF-8 så att å, ä och ö visas rätt. */
const BOM = '\uFEFF';

export const CSV_COLUMNS = [
  'År',
  'Månad',
  'Månadsnamn',
  'Sektion',
  'Produktägare',
  'Initiativ',
  'Person',
  'Personens sektion',
  'Typ',
  'Estimat (h)',
  'Utfall (h)',
  'Avvikelse (h)',
  'Timkostnad (kr/h)',
  'Estimerad kostnad (kr)',
  'Utfallskostnad (kr)',
  'Normal arbetstid (h/mån)',
  'Totalt estimat alla initiativ (h)',
  'Överallokerad (estimat)',
] as const;

/** Tal med decimalkomma och utan tusentalsavgränsare, så att svensk Excel tolkar det som ett tal. */
const excelNumber = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',');

/** Citerar vid behov och neutraliserar text som Excel annars kan tolka som en formel. */
function excelText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Platt analysexport för t.ex. pivottabeller i Excel: en rad per initiativ, person, år och månad.
 * Alla kopplade personer och initiativets alla år tas med, även månader med 0 timmar.
 * Utfall, avvikelse och utfallskostnad lämnas tomma för månader utan rapporterat utfall.
 */
export function toAnalysisCsv(data: AppData): string {
  const peopleById = new Map(data.people.map((person) => [person.id, person]));
  const ownersById = new Map(data.productOwners.map((owner) => [owner.id, owner]));
  const sectionName = (id: string | undefined) => data.sections.find((section) => section.id === id)?.name ?? '';

  // Samma person och år förekommer i flera initiativ; kapaciteten räknas en gång per par.
  const capacityCache = new Map<string, PersonCapacity>();
  const capacityOf = (personId: string, year: number) => {
    const key = `${personId}|${year}`;
    if (!capacityCache.has(key)) capacityCache.set(key, personCapacity(data, peopleById.get(personId)!, year));
    return capacityCache.get(key)!;
  };

  const lines: string[] = [CSV_COLUMNS.join(SEPARATOR)];
  for (const initiative of [...data.initiatives].sort(compareByName)) {
    const owner = ownersById.get(initiative.productOwnerId);
    for (const year of initiative.years) {
      for (const personId of initiative.personIds) {
        const person = peopleById.get(personId);
        if (!person) continue;
        const rate = effectiveRate(person, data.settings);
        const estimates = getMonthEstimates(data, initiative.id, personId, year);
        const actuals = getMonthActuals(data, initiative.id, personId, year);
        const { capacity, monthTotals, overallocated } = capacityOf(personId, year);

        estimates.forEach((estimate, month) => {
          const actual = actuals[month]!;
          // Tomt fält = inget utfall rapporterat (skiljer sig från rapporterade 0 h).
          const ifReported = (value: (reported: number) => number) =>
            actual === null ? '' : excelNumber(value(actual));
          const row = [
            String(year),
            String(month + 1),
            MONTHS_LONG[month]!,
            excelText(sectionName(owner?.sectionId)),
            excelText(owner?.name ?? ''),
            excelText(initiative.name),
            excelText(person.name),
            excelText(sectionName(person.sectionId)),
            PERSON_TYPE_LABEL[person.type],
            excelNumber(estimate),
            ifReported((reported) => reported),
            ifReported((reported) => reported - estimate),
            excelNumber(rate),
            excelNumber(estimate * rate),
            ifReported((reported) => reported * rate),
            excelNumber(capacity),
            excelNumber(monthTotals[month]!),
            overallocated[month] ? 'Ja' : 'Nej',
          ];
          lines.push(row.join(SEPARATOR));
        });
      }
    }
  }
  return BOM + lines.join(LINE_BREAK) + LINE_BREAK;
}
