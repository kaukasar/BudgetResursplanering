import type { ComponentType } from 'react';
import { activePeople } from '../../domain/calc';
import { useCanEdit, useEditLockStore } from '../../store/editLock';
import { useDataStore } from '../../store/store';
import { useUiStore, type AdminTab } from '../../store/ui';
import { DataAdmin } from './DataAdmin';
import { InitiativesAdmin } from './InitiativesAdmin';
import { OwnersAdmin } from './OwnersAdmin';
import { PeopleAdmin } from './PeopleAdmin';
import { SectionsAdmin } from './SectionsAdmin';
import { SettingsAdmin } from './SettingsAdmin';

const TAB_CONTENT: Record<AdminTab, ComponentType> = {
  sections: SectionsAdmin,
  people: PeopleAdmin,
  owners: OwnersAdmin,
  initiatives: InitiativesAdmin,
  settings: SettingsAdmin,
  data: DataAdmin,
};

export function AdminView() {
  const { adminTab, setAdminTab } = useUiStore();
  const data = useDataStore((state) => state.data);
  const canEdit = useCanEdit();
  const TabContent = TAB_CONTENT[adminTab];

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'sections', label: `Sektioner (${data.sections.length})` },
    { id: 'people', label: `Personal (${activePeople(data).length})` },
    { id: 'owners', label: `Produktägare (${data.productOwners.length})` },
    { id: 'initiatives', label: `Initiativ (${data.initiatives.length})` },
    { id: 'settings', label: 'Inställningar' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <div className={canEdit ? 'admin editing-enabled' : 'admin'}>
      <div className="admin-toolbar">
        <EditLockToggle />
      </div>
      <div className="segmented tabs" role="tablist" aria-label="Administration">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={adminTab === tab.id}
            aria-controls="admin-panel"
            onClick={() => setAdminTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="admin-panel" aria-labelledby={`tab-${adminTab}`}>
        <TabContent />
      </div>
    </div>
  );
}

/** Växel som slår på och av möjligheten att ändra data i adminläget (spärr mot misstag). */
function EditLockToggle() {
  const { editingEnabled, setEditingEnabled } = useEditLockStore();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={editingEnabled}
      // Knappen visar bara låset; namnet behövs för skärmläsare.
      aria-label="Redigering"
      className={editingEnabled ? 'edit-toggle on' : 'edit-toggle'}
      onClick={() => setEditingEnabled(!editingEnabled)}
    >
      <span aria-hidden="true">{editingEnabled ? '🔓' : '🔒'}</span>
    </button>
  );
}
