import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nextSort, type SortState } from '../domain/sorting';

export type Mode = 'work' | 'admin';
/** Vad arbetsläget visar och låter användaren mata in. */
export type WorkView = 'estimate' | 'actual' | 'compare';

export type AdminTab = 'sections' | 'people' | 'owners' | 'initiatives' | 'settings' | 'data';

/** Flikar i adminläget med sorterbara kolumner. */
export type SortableTab = 'sections' | 'people' | 'owners' | 'initiatives';

export const DEFAULT_ADMIN_SORT: Record<SortableTab, SortState> = {
  sections: { key: 'name', direction: 'asc' },
  people: { key: 'name', direction: 'asc' },
  owners: { key: 'name', direction: 'asc' },
  initiatives: { key: 'name', direction: 'asc' },
};

/** Värdet för "alla" i sektions- och produktägarväljarna. */
export const ALL_SECTIONS = '';
export const ALL_OWNERS = '';

interface UiState {
  mode: Mode;
  adminTab: AdminTab;
  /** Sorteringskolumn och riktning per adminflik. */
  adminSort: Record<SortableTab, SortState>;
  year: number;
  view: WorkView;
  sectionId: string;
  ownerId: string;
  setMode: (mode: Mode) => void;
  setAdminTab: (tab: AdminTab) => void;
  /** Klick på en kolumnrubrik: ny kolumn sorteras stigande, samma kolumn vänder riktningen. */
  sortAdminBy: (tab: SortableTab, key: string) => void;
  setYear: (year: number) => void;
  setView: (view: WorkView) => void;
  setSectionId: (id: string) => void;
  setOwnerId: (id: string) => void;
}

/** Vy-inställningar (valt läge, år, sektion och produktägare) som minns mellan besök. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: 'work',
      adminTab: 'sections',
      adminSort: DEFAULT_ADMIN_SORT,
      year: new Date().getFullYear(),
      view: 'estimate',
      sectionId: ALL_SECTIONS,
      ownerId: ALL_OWNERS,
      setMode: (mode) => set({ mode }),
      setAdminTab: (adminTab) => set({ adminTab }),
      sortAdminBy: (tab, key) =>
        set((s) => ({ adminSort: { ...s.adminSort, [tab]: nextSort(s.adminSort[tab], key) } })),
      setYear: (year) => set({ year }),
      setView: (view) => set({ view }),
      setSectionId: (sectionId) => set({ sectionId }),
      setOwnerId: (ownerId) => set({ ownerId }),
    }),
    {
      name: 'ekonomi.ui',
      // Version 2: sorteringen sparas som { key, direction } per flik (tidigare bara riktning).
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => ({ ...(persisted as object), adminSort: DEFAULT_ADMIN_SORT }),
    },
  ),
);
