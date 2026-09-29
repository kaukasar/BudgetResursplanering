import { useState, type FormEvent } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { Modal } from '../../components/Modal';
import { plural } from '../../domain/format';
import { sectionContents } from '../../domain/operations';
import { sortByName } from '../../domain/sorting';
import type { Section } from '../../domain/types';
import { useDataStore } from '../../store/store';
import { useAdminSort } from './useAdminSort';

export function SectionsAdmin() {
  const data = useDataStore((state) => state.data);
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
    const { people, productOwners } = sectionContents(data, section.id);
    if (people.length > 0 || productOwners.length > 0) {
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
            onChange={(e) => {
              setNewName(e.target.value);
              setAddError(null);
            }}
          />
          <button type="submit" className="btn btn-primary">
            + Lägg till
          </button>
        </form>
      </div>
      {addError && (
        <div className="card-body notice-row">
          <div className="notice error" role="alert">
            {addError}
          </div>
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
                <th>
                  <span className="sr-only">Åtgärder</span>
                </th>
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
                    <td className="actions">
                      <button type="button" className="link-btn" onClick={() => setRenaming(section)}>
                        Byt namn
                      </button>
                      <button type="button" className="link-btn danger" onClick={() => void remove(section)}>
                        Radera
                      </button>
                    </td>
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
 * Visas när man försöker radera en sektion som innehåller personal eller produktägare.
 * Innehållet måste flyttas till en annan sektion (eller raderas under respektive flik) först.
 */
function BlockedDeleteDialog({ section, onClose }: { section: Section; onClose: () => void }) {
  const data = useDataStore((state) => state.data);
  const updatePerson = useDataStore((state) => state.updatePerson);
  const updateProductOwner = useDataStore((state) => state.updateProductOwner);
  const deleteSection = useDataStore((state) => state.deleteSection);

  const { people, productOwners, initiatives } = sectionContents(data, section.id);
  const otherSections = sortByName(data.sections.filter((candidate) => candidate.id !== section.id));
  const isEmpty = people.length === 0 && productOwners.length === 0;
  const contentsText = [
    people.length > 0 && plural(people.length, 'person', 'personer'),
    productOwners.length > 0 && `${productOwners.length} produktägare`,
  ]
    .filter(Boolean)
    .join(' och ');

  const moveAll = (sectionId: string) => {
    people.forEach((person) => updatePerson(person.id, { sectionId }));
    productOwners.forEach((owner) => updateProductOwner(owner.id, { sectionId }));
  };
  const initiativeCount = (ownerId: string) =>
    initiatives.filter((initiative) => initiative.productOwnerId === ownerId).length;

  const moveSelect = (label: string, onMove: (sectionId: string) => void) => (
    <select
      className="select"
      aria-label={label}
      value=""
      disabled={otherSections.length === 0}
      onChange={(e) => e.target.value && onMove(e.target.value)}
    >
      <option value="">{otherSections.length > 0 ? 'Flytta till…' : 'Inga andra sektioner'}</option>
      {otherSections.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );

  const deleteAndClose = () => {
    deleteSection(section.id);
    onClose();
  };

  return (
    <Modal
      title={`Radera ${section.name}`}
      onClose={onClose}
      wide
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
        <>
          <div className="notice error" role="alert">
            <strong>{section.name}</strong> kan inte raderas eftersom den innehåller {contentsText}. Flytta dem till en
            annan sektion, eller radera dem under flikarna Personal och Produktägare. Initiativ följer med sin
            produktägare.
          </div>
          <div className="reassign-row">
            <span className="name">Flytta allt</span>
            {moveSelect(`Flytta allt i ${section.name} till sektion`, moveAll)}
          </div>
          <div className="reassign-list">
            {productOwners.map((owner) => (
              <div key={owner.id} className="reassign-row">
                <span className="name">
                  {owner.name}{' '}
                  <span className="small muted">
                    produktägare · {plural(initiativeCount(owner.id), 'initiativ', 'initiativ')}
                  </span>
                </span>
                {moveSelect(`Flytta ${owner.name} till sektion`, (sectionId) =>
                  updateProductOwner(owner.id, { sectionId }),
                )}
              </div>
            ))}
            {people.map((person) => (
              <div key={person.id} className="reassign-row">
                <span className="name">
                  {person.name} <span className="small muted">personal</span>
                </span>
                {moveSelect(`Flytta ${person.name} till sektion`, (sectionId) =>
                  updatePerson(person.id, { sectionId }),
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
