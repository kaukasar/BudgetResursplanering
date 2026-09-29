import { useState, type FormEvent } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { Modal } from '../../components/Modal';
import { SectionSelect } from '../../components/SectionSelect';
import { initiativesForOwner } from '../../domain/operations';
import { joinSorted, sortByName } from '../../domain/sorting';
import type { ProductOwner } from '../../domain/types';
import { useDataStore } from '../../store/store';
import { MISSING, sectionName } from '../labels';
import { MissingSectionNotice } from './MissingSectionNotice';
import { useAdminSort } from './useAdminSort';
import { useConfirmDeleteInitiative } from './useConfirmDeleteInitiative';

export function OwnersAdmin() {
  const data = useDataStore((state) => state.data);
  const addProductOwner = useDataStore((state) => state.addProductOwner);
  const deleteProductOwner = useDataStore((state) => state.deleteProductOwner);
  const confirm = useConfirm();

  const [newName, setNewName] = useState('');
  const [newSectionId, setNewSectionId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductOwner | null>(null);
  const [blocked, setBlocked] = useState<ProductOwner | null>(null);

  const noSections = data.sections.length === 0;
  // Med en enda sektion förväljs den.
  const sectionForNew = newSectionId || (data.sections.length === 1 ? data.sections[0]!.id : '');
  const initiativeNames = (owner: ProductOwner) =>
    joinSorted(initiativesForOwner(data, owner.id).map((initiative) => initiative.name));
  const { sortedRows: owners, sortHeader } = useAdminSort('owners', data.productOwners, {
    name: (owner) => owner.name,
    section: (owner) => sectionName(data, owner.sectionId),
    initiatives: initiativeNames,
  });

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return setAddError('Ange ett namn.');
    if (!sectionForNew) return setAddError('Välj en sektion.');
    addProductOwner(newName, sectionForNew);
    setNewName('');
    setAddError(null);
  };

  const remove = async (owner: ProductOwner) => {
    if (initiativesForOwner(data, owner.id).length > 0) {
      setBlocked(owner);
      return;
    }
    const confirmed = await confirm({
      title: 'Radera produktägare',
      danger: true,
      confirmLabel: 'Radera',
      message: (
        <p>
          Vill du radera <strong>{owner.name}</strong>?
        </p>
      ),
    });
    if (confirmed) deleteProductOwner(owner.id);
  };

  return (
    <div className="card">
      <div className="card-head admin-section-head">
        <div>
          <h2>Produktägare</h2>
          <div className="small muted">{owners.length} produktägare</div>
        </div>
        {!noSections && (
          <form className="inline-form" onSubmit={add}>
            <input
              className={addError ? 'input invalid' : 'input'}
              placeholder="Namn på ny produktägare"
              aria-label="Namn på ny produktägare"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setAddError(null);
              }}
            />
            <SectionSelect
              sections={data.sections}
              value={sectionForNew}
              onChange={setNewSectionId}
              label="Sektion för ny produktägare"
            />
            <button type="submit" className="btn btn-primary">
              + Lägg till
            </button>
          </form>
        )}
      </div>
      {noSections && <MissingSectionNotice />}
      {addError && (
        <div className="card-body notice-row">
          <div className="notice error" role="alert">
            {addError}
          </div>
        </div>
      )}

      {owners.length === 0 ? (
        <div className="empty">Inga produktägare ännu.</div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {sortHeader('name', 'Namn')}
                {sortHeader('section', 'Sektion')}
                {sortHeader('initiatives', 'Initiativ')}
                <th>
                  <span className="sr-only">Åtgärder</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id}>
                  <td>
                    <strong>{owner.name}</strong>
                  </td>
                  <td>{sectionName(data, owner.sectionId)}</td>
                  <td className="small">{initiativeNames(owner) || <span className="muted">{MISSING}</span>}</td>
                  <td className="actions">
                    <button type="button" className="link-btn" onClick={() => setEditing(owner)}>
                      Redigera
                    </button>
                    <button type="button" className="link-btn danger" onClick={() => void remove(owner)}>
                      Radera
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditOwnerDialog owner={editing} onClose={() => setEditing(null)} />}
      {blocked && <BlockedDeleteDialog owner={blocked} onClose={() => setBlocked(null)} />}
    </div>
  );
}

function EditOwnerDialog({ owner, onClose }: { owner: ProductOwner; onClose: () => void }) {
  const data = useDataStore((state) => state.data);
  const updateProductOwner = useDataStore((state) => state.updateProductOwner);
  const [name, setName] = useState(owner.name);
  const [sectionId, setSectionId] = useState(owner.sectionId);
  const [error, setError] = useState<string | null>(null);
  const initiativeCount = initiativesForOwner(data, owner.id).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Ange ett namn.');
    updateProductOwner(owner.id, { name, sectionId });
    onClose();
  };

  return (
    <Modal
      title={`Redigera ${owner.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button type="submit" form="edit-owner" className="btn btn-primary">
            Spara
          </button>
        </>
      }
    >
      <form id="edit-owner" onSubmit={submit} className="form-stack">
        <label className="field">
          <span>Namn</span>
          <input className={error ? 'input invalid' : 'input'} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Sektion</span>
          <SectionSelect sections={data.sections} value={sectionId} onChange={setSectionId} />
        </label>
        {sectionId !== owner.sectionId && initiativeCount > 0 && (
          <div className="notice">
            Produktägarens {initiativeCount} initiativ flyttas med till {sectionName(data, sectionId)}.
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/**
 * Visas när man försöker radera en produktägare som har initiativ. Initiativen måste
 * flyttas till en annan produktägare i samma sektion eller raderas först.
 */
function BlockedDeleteDialog({ owner, onClose }: { owner: ProductOwner; onClose: () => void }) {
  const data = useDataStore((state) => state.data);
  const updateInitiative = useDataStore((state) => state.updateInitiative);
  const deleteProductOwner = useDataStore((state) => state.deleteProductOwner);
  const confirmDeleteInitiative = useConfirmDeleteInitiative();

  const linked = initiativesForOwner(data, owner.id);
  const ownersInSameSection = sortByName(
    data.productOwners.filter((candidate) => candidate.id !== owner.id && candidate.sectionId === owner.sectionId),
  );
  const linkedText = linked.length === 1 ? 'ett initiativ är kopplat' : `${linked.length} initiativ är kopplade`;

  const deleteAndClose = () => {
    deleteProductOwner(owner.id);
    onClose();
  };

  return (
    <Modal
      title={`Radera ${owner.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button type="button" className="btn btn-danger" disabled={linked.length > 0} onClick={deleteAndClose}>
            Radera produktägare
          </button>
        </>
      }
    >
      {linked.length > 0 ? (
        <>
          <div className="notice error" role="alert">
            <strong>{owner.name}</strong> kan inte raderas eftersom {linkedText}. Flytta varje initiativ till en annan
            produktägare i samma sektion ({sectionName(data, owner.sectionId)}) eller radera det.
          </div>
          <div className="reassign-list">
            {linked.map((initiative) => (
              <div key={initiative.id} className="reassign-row">
                <span className="name">{initiative.name}</span>
                <select
                  className="select"
                  aria-label={`Flytta ${initiative.name} till produktägare`}
                  value=""
                  disabled={ownersInSameSection.length === 0}
                  onChange={(e) =>
                    e.target.value && updateInitiative(initiative.id, { productOwnerId: e.target.value })
                  }
                >
                  <option value="">
                    {ownersInSameSection.length > 0 ? 'Flytta till…' : 'Inga andra produktägare i sektionen'}
                  </option>
                  {ownersInSameSection.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm" onClick={() => void confirmDeleteInitiative(initiative)}>
                  Radera initiativ
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="notice success" role="status">
          Alla initiativ är flyttade eller raderade. Nu kan <strong>{owner.name}</strong> raderas.
        </div>
      )}
    </Modal>
  );
}
