import { useState } from 'react';
import { activePeople, initiativeSectionId } from '../../domain/calc';
import { formatSek } from '../../domain/format';
import { joinSorted, sortByName } from '../../domain/sorting';
import type { AppData, Initiative } from '../../domain/types';
import { useCanEdit } from '../../store/editLock';
import { useDataStore } from '../../store/store';
import { MISSING, ownerName, personName, sectionName } from '../labels';
import { InitiativeForm } from './InitiativeForm';
import { useAdminSort } from './useAdminSort';
import { useConfirmDeleteInitiative } from './useConfirmDeleteInitiative';

/** Det som saknas för att kunna skapa ett initiativ, t.ex. ["en sektion", "personal"]. */
function missingPrerequisites(data: AppData): string[] {
  return [
    data.sections.length === 0 && 'en sektion',
    data.productOwners.length === 0 && 'en produktägare',
    activePeople(data).length === 0 && 'personal',
  ].filter((text): text is string => Boolean(text));
}

export function InitiativesAdmin() {
  const data = useDataStore((state) => state.data);
  const confirmDeleteInitiative = useConfirmDeleteInitiative();
  const canEdit = useCanEdit();
  const [editing, setEditing] = useState<Initiative | 'new' | null>(null);
  const [ownerFilter, setOwnerFilter] = useState('');

  const owners = sortByName(data.productOwners);
  const personNames = (initiative: Initiative) => joinSorted(initiative.personIds.map((id) => personName(data, id)));
  const { sortedRows: initiatives, sortHeader } = useAdminSort(
    'initiatives',
    data.initiatives.filter((initiative) => !ownerFilter || initiative.productOwnerId === ownerFilter),
    {
      name: (initiative) => initiative.name,
      section: (initiative) => sectionName(data, initiativeSectionId(data, initiative)),
      owner: (initiative) => ownerName(data, initiative.productOwnerId),
      tajma: (initiative) => initiative.tajmaClass ?? null,
      // Första året avgör, därefter sista året (t.ex. 2026 före 2026–2027).
      years: (initiative) => initiative.years[0]! * 10_000 + initiative.years.at(-1)!,
      people: personNames,
      internalBudget: (initiative) => initiative.internalBudget ?? null,
      externalBudget: (initiative) => initiative.externalBudget ?? null,
    },
  );
  const missing = missingPrerequisites(data);

  return (
    <div className="card">
      <div className="card-head admin-section-head">
        <div>
          <h2>Initiativ</h2>
          <div className="small muted">{data.initiatives.length} initiativ</div>
        </div>
        <div className="inline-form">
          <select
            className="select"
            aria-label="Filtrera på produktägare"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">Alla produktägare</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={missing.length > 0 || !canEdit}
            title={missing.length > 0 ? `Skapa först ${missing.join(' och ')}` : undefined}
            onClick={() => setEditing('new')}
          >
            + Nytt initiativ
          </button>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="card-body">
          <div className="notice">
            För att skapa ett initiativ behövs {missing.join(' och ')}. Lägg till det under respektive flik.
          </div>
        </div>
      )}

      {initiatives.length === 0 ? (
        <div className="empty">Inga initiativ{ownerFilter ? ' för vald produktägare' : ''}.</div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {sortHeader('name', 'Namn')}
                {sortHeader('section', 'Sektion')}
                {sortHeader('owner', 'Produktägare')}
                {sortHeader('tajma', 'Tajmaklass')}
                {sortHeader('years', 'År')}
                {sortHeader('people', 'Personal')}
                {sortHeader('internalBudget', 'Intern budget', 'num')}
                {sortHeader('externalBudget', 'Extern budget', 'num')}
                <th>
                  <span className="sr-only">Åtgärder</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map((initiative) => (
                <tr key={initiative.id}>
                  <td>
                    <strong>{initiative.name}</strong>
                  </td>
                  <td>{sectionName(data, initiativeSectionId(data, initiative))}</td>
                  <td>{ownerName(data, initiative.productOwnerId)}</td>
                  <td>{initiative.tajmaClass ?? <span className="muted">{MISSING}</span>}</td>
                  <td className="nowrap">{initiative.years.join(', ')}</td>
                  <td className="small">{personNames(initiative) || <span className="muted">Ingen personal</span>}</td>
                  <BudgetCell budget={initiative.internalBudget} />
                  <BudgetCell budget={initiative.externalBudget} />
                  <td className="actions">
                    <button
                      type="button"
                      className="link-btn"
                      disabled={!canEdit}
                      onClick={() => setEditing(initiative)}
                    >
                      Redigera
                    </button>
                    <button
                      type="button"
                      className="link-btn danger"
                      disabled={!canEdit}
                      onClick={() => void confirmDeleteInitiative(initiative)}
                    >
                      Radera
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <InitiativeForm
          initiative={editing === 'new' ? undefined : editing}
          defaultOwnerId={ownerFilter || (owners.length === 1 ? owners[0]!.id : undefined)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BudgetCell({ budget }: { budget: number | null | undefined }) {
  return <td className="num">{budget ? formatSek(budget) : <span className="muted">{MISSING}</span>}</td>;
}
