import { useState, type FormEvent } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Modal } from '../../components/Modal';
import { plural } from '../../domain/format';
import { isSectionEmpty, sectionContents } from '../../domain/operations';
import { sortByName } from '../../domain/sorting';
import type { Section } from '../../domain/types';
import { useCanEdit } from '../../store/editLock';
import { useDataStore } from '../../store/store';
import { RowActions, RowActionsHeader } from './RowActions';
import { useAdminSort } from './useAdminSort';

export function SectionsAdmin() {
  const data = useDataStore((state) => state.data);
  const canEdit = useCanEdit();
  const addSection = useDataStore((state) => state.addSection);
  const deleteSection = useDataStore((state) => state.deleteSection);
  const confirm = useConfirm();

  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Section | null>(null);
  const [blocked, setBlocked] = useState<Section | null>(null);
  const { sortedRows: sections, sortHeader } = useAdminSort('sections', data.sections, {
    name: (section) => section.name,
  });

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return setAddError('Ange ett namn.');
    addSection(newName);
    setNewName('');
    setAddError(null);
  };

  const remove = async (section: Section) => {
    if (!isSectionEmpty(sectionContents(data, section.id))) {
      setBlocked(section);
      return;
    }
    const confirmed = await confirm({
      title: 'Radera sektion',
      danger: true,
      confirmLabel: 'Radera',
      message: (
        <p>
          Vill du radera sektionen <strong>{section.name}</strong>?
        </p>
      ),
    });
    if (confirmed) deleteSection(section.id);
  };

  return (
    <div className="card">
      <div className="card-head admin-section-head">
        <div>
          <h2>Sektioner</h2>
          <div className="small muted">{plural(sections.length, 'sektion', 'sektioner')}</div>
        </div>
        <form className="inline-form" onSubmit={add}>
          <input
            className={addError ? 'input invalid' : 'input'}
            placeholder="Namn på ny sektion"
            aria-label="Namn på ny sektion"
            value={newName}
            disabled={!canEdit}
            onChange={(e) => {
              setNewName(e.target.value);
              setAddError(null);
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={!canEdit}>
            + Lägg till
          </button>
        </form>
      </div>
      {addError && (
        <div className="card-body notice-row">
          <ErrorNotice>{addError}</ErrorNotice>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="empty">
          <h3>Börja med att skapa en sektion</h3>
          <p>
            Sektionen ligger högst upp i hierarkin. Personal och produktägare tillhör en sektion, och initiativ tillhör
            sin produktägares sektion.
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {sortHeader('name', 'Namn')}
                <th className="num">Personal</th>
                <th className="num">Produktägare</th>
                <th className="num">Initiativ</th>
                <RowActionsHeader />
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const contents = sectionContents(data, section.id);
                return (
                  <tr key={section.id}>
                    <td>
                      <strong>{section.name}</strong>
                    </td>
                    <td className="num">{contents.people.length}</td>
                    <td className="num">{contents.productOwners.length}</td>
                    <td className="num">{contents.initiatives.length}</td>
                    <RowActions
                      disabled={!canEdit}
                      editLabel="Byt namn"
                      onEdit={() => setRenaming(section)}
                      onDelete={() => void remove(section)}
                    />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {renaming && <RenameSectionDialog section={renaming} onClose={() => setRenaming(null)} />}
      {blocked && <BlockedDeleteDialog section={blocked} onClose={() => setBlocked(null)} />}
    </div>
  );
}

function RenameSectionDialog({ section, onClose }: { section: Section; onClose: () => void }) {
  const renameSection = useDataStore((state) => state.renameSection);
  const [name, setName] = useState(section.name);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Ange ett namn.');
    renameSection(section.id, name);
    onClose();
  };

  return (
    <Modal
      title="Byt namn på sektion"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button type="submit" form="rename-section" className="btn btn-primary">
            Spara
          </button>
        </>
      }
    >
      <form id="rename-section" onSubmit={submit} className="form-stack">
        <label className="field">
          <span>Namn</span>
          <input className={error ? 'input invalid' : 'input'} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <ErrorNotice>{error}</ErrorNotice>}
      </form>
    </Modal>
  );
}

/**
 * Visas när man försöker radera en sektion som har innehåll. Allt innehåll – personal, produktägare
 * och initiativ – flyttas tillsammans till en annan sektion först; en sektion med data kan aldrig
 * raderas.
 */
function BlockedDeleteDialog({ section, onClose }: { section: Section; onClose: () => void }) {
  const data = useDataStore((state) => state.data);
  const moveSectionContents = useDataStore((state) => state.moveSectionContents);
  const deleteSection = useDataStore((state) => state.deleteSection);

  const contents = sectionContents(data, section.id);
  const otherSections = sortByName(data.sections.filter((candidate) => candidate.id !== section.id));
  const isEmpty = isSectionEmpty(contents);
  const contentsText = [
    contents.people.length > 0 && plural(contents.people.length, 'person', 'personer'),
    contents.deletedPeople.length > 0 &&
      plural(contents.deletedPeople.length, 'raderad person med låst tid', 'raderade personer med låst tid'),
    contents.productOwners.length > 0 && `${contents.productOwners.length} produktägare`,
    contents.initiatives.length > 0 && `${contents.initiatives.length} initiativ`,
  ]
    .filter(Boolean)
    .join(', ');

  const deleteAndClose = () => {
    deleteSection(section.id);
    onClose();
  };

  return (
    <Modal
      title={`Radera ${section.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button type="button" className="btn btn-danger" disabled={!isEmpty} onClick={deleteAndClose}>
            Radera sektion
          </button>
        </>
      }
    >
      {isEmpty ? (
        <div className="notice success" role="status">
          Sektionen är tom. Nu kan <strong>{section.name}</strong> raderas.
        </div>
      ) : (
        <div className="form-stack">
          <ErrorNotice>
            <strong>{section.name}</strong> kan inte raderas eftersom den har innehåll
            {contentsText && <> ({contentsText})</>}. Flytta allt till en annan sektion först. Personal, produktägare
            och initiativ flyttas tillsammans, så att personalen behåller sina initiativ.
          </ErrorNotice>
          <label className="field">
            <span>Flytta allt till</span>
            <select
              className="select"
              aria-label={`Flytta allt i ${section.name} till sektion`}
              value=""
              disabled={otherSections.length === 0}
              onChange={(e) => e.target.value && moveSectionContents(section.id, e.target.value)}
            >
              <option value="">{otherSections.length > 0 ? 'Välj sektion…' : 'Det finns inga andra sektioner'}</option>
              {otherSections.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </Modal>
  );
}
