import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const EDIT_LOCK_STORAGE_KEY = 'ekonomi.adminEdit';

interface EditLockState {
  /** Redigering i adminläget är påslagen. Standard är avstängd. */
  editingEnabled: boolean;
  setEditingEnabled: (enabled: boolean) => void;
}

/**
 * Spärr mot oavsiktliga ändringar i adminläget. Valet sparas i sessionStorage och gäller därför
 * per webbläsarflik: det överlever att sidan laddas om, men en ny flik startar alltid avstängd.
 */
export const useEditLockStore = create<EditLockState>()(
  persist(
    (set) => ({
      editingEnabled: false,
      setEditingEnabled: (editingEnabled) => set({ editingEnabled }),
    }),
    { name: EDIT_LOCK_STORAGE_KEY, storage: createJSONStorage(() => sessionStorage) },
  ),
);

/** Kan data ändras i adminläget just nu? */
export const useCanEdit = () => useEditLockStore((state) => state.editingEnabled);
