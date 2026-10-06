import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as ops from '../domain/operations';
import { parseAppData } from '../domain/serialization';
import {
  emptyData,
  type AppData,
  type Initiative,
  type Person,
  type PersonType,
  type ProductOwner,
  type TypeSettings,
} from '../domain/types';

export const DATA_STORAGE_KEY = 'ekonomi.data';

interface DataState {
  data: AppData;

  updateTypeSettings: (type: PersonType, patch: Partial<TypeSettings>) => void;

  addSection: (name: string) => string;
  renameSection: (id: string, name: string) => void;
  deleteSection: (id: string) => void;
  moveSectionContents: (fromSectionId: string, toSectionId: string) => void;

  addPerson: (person: Omit<Person, 'id' | 'deleted'>) => string;
  updatePerson: (id: string, patch: ops.PersonPatch) => void;
  deletePerson: (id: string) => void;

  addProductOwner: (name: string, sectionId: string) => string;
  updateProductOwner: (id: string, patch: Partial<Omit<ProductOwner, 'id'>>) => void;
  deleteProductOwner: (id: string) => void;

  addInitiative: (initiative: Omit<Initiative, 'id'>) => string;
  updateInitiative: (id: string, patch: Partial<Omit<Initiative, 'id'>>) => void;
  deleteInitiative: (id: string) => void;

  setEstimate: (initiativeId: string, personId: string, year: number, month: number, hours: number) => void;
  setActual: (initiativeId: string, personId: string, year: number, month: number, hours: number | null) => void;
  fillActualsFromEstimate: (initiativeId: string, personId: string, year: number, throughMonth: number) => void;
}

/**
 * Validerar sparad data vid inläsning. Är den trasig (t.ex. manuellt ändrad) startar appen tom
 * i stället för att krascha, och originalet sparas undan för manuell återställning.
 */
function restoreSavedData(persisted: unknown, current: DataState): DataState {
  const saved = (persisted as { data?: unknown } | undefined)?.data;
  if (saved === undefined) return current;
  try {
    return { ...current, data: parseAppData(saved) };
  } catch (error) {
    console.error('Sparad data kunde inte läsas och har ignorerats.', error);
    const raw = localStorage.getItem(DATA_STORAGE_KEY);
    if (raw) localStorage.setItem(`${DATA_STORAGE_KEY}.backup`, raw);
    return current;
  }
}

/**
 * All affärslogik finns i `domain/operations` som rena funktioner. Storen applicerar dem
 * och sparar resultatet i localStorage. Ogiltiga operationer kastar `DomainError`.
 */
export const useDataStore = create<DataState>()(
  persist(
    (set, get) => {
      const apply = (operation: (data: AppData) => AppData) => set({ data: operation(get().data) });
      const create = (operation: (data: AppData, id: string) => AppData) => {
        const id = crypto.randomUUID();
        apply((data) => operation(data, id));
        return id;
      };

      return {
        data: emptyData(),

        updateTypeSettings: (type, patch) => apply((data) => ops.updateTypeSettings(data, type, patch)),

        addSection: (name) => create((data, id) => ops.addSection(data, { id, name })),
        renameSection: (id, name) => apply((data) => ops.renameSection(data, id, name)),
        deleteSection: (id) => apply((data) => ops.deleteSection(data, id)),
        moveSectionContents: (fromSectionId, toSectionId) =>
          apply((data) => ops.moveSectionContents(data, fromSectionId, toSectionId)),

        addPerson: (person) => create((data, id) => ops.addPerson(data, { ...person, id })),
        updatePerson: (id, patch) => apply((data) => ops.updatePerson(data, id, patch)),
        deletePerson: (id) => apply((data) => ops.deletePerson(data, id)),

        addProductOwner: (name, sectionId) => create((data, id) => ops.addProductOwner(data, { id, name, sectionId })),
        updateProductOwner: (id, patch) => apply((data) => ops.updateProductOwner(data, id, patch)),
        deleteProductOwner: (id) => apply((data) => ops.deleteProductOwner(data, id)),

        addInitiative: (initiative) => create((data, id) => ops.addInitiative(data, { ...initiative, id })),
        updateInitiative: (id, patch) => apply((data) => ops.updateInitiative(data, id, patch)),
        deleteInitiative: (id) => apply((data) => ops.deleteInitiative(data, id)),

        setEstimate: (initiativeId, personId, year, month, hours) =>
          apply((data) => ops.setEstimate(data, initiativeId, personId, year, month, hours)),
        setActual: (initiativeId, personId, year, month, hours) =>
          apply((data) => ops.setActual(data, initiativeId, personId, year, month, hours)),
        fillActualsFromEstimate: (initiativeId, personId, year, throughMonth) =>
          apply((data) => ops.fillActualsFromEstimate(data, initiativeId, personId, year, throughMonth)),
      };
    },
    {
      name: DATA_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ data: state.data }),
      merge: restoreSavedData,
    },
  ),
);

// Håll flera öppna flikar i synk: läs om data när en annan flik har sparat.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === DATA_STORAGE_KEY) void useDataStore.persist.rehydrate();
  });
}
