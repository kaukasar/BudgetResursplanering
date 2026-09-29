import type { ComponentType } from 'react';
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
  const TabContent = TAB_CONTENT[adminTab];

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'sections', label: `Sektioner (${data.sections.length})` },
    { id: 'people', label: `Personal (${data.people.length})` },
    { id: 'owners', label: `Produktägare (${data.productOwners.length})` },
    { id: 'initiatives', label: `Initiativ (${data.initiatives.length})` },
    { id: 'settings', label: 'Inställningar' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <>
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
    </>
  );
}
