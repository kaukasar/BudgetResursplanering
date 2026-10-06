import { useState, type FormEvent } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Modal } from '../../components/Modal';
import { preselectedSectionId, SectionSelect } from '../../components/SectionSelect';
import { initiativesForOwner } from '../../domain/operations';
import { joinSorted, sortByName } from '../../domain/sorting';
import type { ProductOwner } from '../../domain/types';
import { useCanEdit } from '../../store/editLock';
import { useDataStore } from '../../store/store';
import { MISSING, sectionName } from '../labels';
import { MissingSectionNotice } from './MissingSectionNotice';
import { RowActions, RowActionsHeader } from './RowActions';
import { useAdminSort } from './useAdminSort';

export function OwnersAdmin() {
  const data = useDataStore((state) => state.data);
  const addProductOwner = useDataStore((state) => state.addProductOwner);
  const deleteProductOwner = useDataStore((state) => state.deleteProductOwner);
  const canEdit = useCanEdit();
  const confirm = useConfirm();

  const [newName, setNewName] = useState('');
  const [newSectionId, setNewSectionId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductOwner | null>(null);
  const [blocked, setBlocked] = useState<ProductOwner | null>(null);

  const noSections = data.sections.length === 0;
  const sectionForNew = newSectionId || preselectedSectionId(data.sections);
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
              disabled={!canEdit}
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
              disabled={!canEdit}
            />
            <button type="submit" className="btn btn-primary" disabled={!canEdit}>
              + Lägg till
            </button>
          </form>
        )}
      </div>
      {noSections && <MissingSectionNotice />}
      {addError && (
        <div className="card-body notice-row">
          <ErrorNotice>{addError}</ErrorNotice>
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
                <RowActionsHeader />
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
                  <RowActions
                    disabled={!canEdit}
                    onEdit={() => setEditing(owner)}
                    onDelete={() => void remove(owner)}
                  />
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
  // Initiativen stannar i sin sektion med sin personal. Byter produktägaren sektion måste
  // initiativen därför först få en ny produktägare i den nuvarande sektionen.
  const mustReassign = sectionId !== owner.sectionId && initiativesForOwner(data, owner.id).length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Ange ett namn.');
    if (mustReassign) return;
    try {
      updateProductOwner(owner.id, { name, sectionId });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal
      title={`Redigera ${owner.name}`}
      onClose={onClose}
      wide={mustReassign}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button type="submit" form="edit-owner" className="btn btn-primary" disabled={mustReassign}>
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
        {mustReassign && (
          <>
            <ErrorNotice>
              Initiativen stannar i {sectionName(data, owner.sectionId)} med sin personal. Ge varje initiativ en ny
              produktägare i {sectionName(data, owner.sectionId)} innan {owner.name} kan byta sektion.
            </ErrorNotice>
            <ReassignInitiatives owner={owner} />
          </>
        )}
        {error && <ErrorNotice>{error}</ErrorNotice>}
      </form>
    </Modal>
  );
}

/**
 * Visas när man försöker radera en produktägare som har initiativ. Initiativen måste först få en
 * ny produktägare i samma sektion.
 */
function BlockedDeleteDialog({ owner, onClose }: { owner: ProductOwner; onClose: () => void }) {
  const data = useDataStore((state) => state.data);
  const deleteProductOwner = useDataStore((state) => state.deleteProductOwner);
  const hasInitiatives = initiativesForOwner(data, owner.id).length > 0;

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
          <button type="button" className="btn btn-danger" disabled={hasInitiatives} onClick={deleteAndClose}>
            Radera produktägare
          </button>
        </>
      }
    >
      {hasInitiatives ? (
        <>
          <ErrorNotice>
            <strong>{owner.name}</strong> har initiativ som först måste få en ny produktägare i{' '}
            {sectionName(data, owner.sectionId)}.
          </ErrorNotice>
          <ReassignInitiatives owner={owner} />
        </>
      ) : (
        <div className="notice success" role="status">
          Alla initiativ har fått en ny produktägare. Nu kan <strong>{owner.name}</strong> raderas.
        </div>
      )}
    </Modal>
  );
}

/** Ger produktägarens initiativ en ny produktägare i samma sektion, ett initiativ i taget. */
function ReassignInitiatives({ owner }: { owner: ProductOwner }) {
  const data = useDataStore((state) => state.data);
  const updateInitiative = useDataStore((state) => state.updateInitiative);
  const linked = sortByName(initiativesForOwner(data, owner.id));
  const candidates = sortByName(
    data.productOwners.filter((candidate) => candidate.id !== owner.id && candidate.sectionId === owner.sectionId),
  );

  if (candidates.length === 0) {
    return (
      <div className="notice">
        Det finns ingen annan produktägare i {sectionName(data, owner.sectionId)}. Skapa först en ny produktägare i
        sektionen under fliken Produktägare.
      </div>
    );
  }
  return (
    <div className="reassign-list">
      {linked.map((initiative) => (
        <div key={initiative.id} className="reassign-row">
          <span className="name">{initiative.name}</span>
          <select
            className="select"
            aria-label={`Ny produktägare för ${initiative.name}`}
            value=""
            onChange={(e) => e.target.value && updateInitiative(initiative.id, { productOwnerId: e.target.value })}
          >
            <option value="">Välj ny produktägare…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
