import { useState } from 'react';
import { useConfirm } from '../../components/confirm-context';
import {
  activePeople,
  effectiveMonthlyHours,
  effectiveRate,
  storedHoursForPersonInInitiative,
} from '../../domain/calc';
import { formatHours, formatSek, hoursPairText, plural } from '../../domain/format';
import { joinSorted } from '../../domain/sorting';
import { PERSON_TYPE_LABEL, type Initiative, type Person } from '../../domain/types';
import { useCanEdit } from '../../store/editLock';
import { useDataStore } from '../../store/store';
import { MISSING, sectionName } from '../labels';
import { MissingSectionNotice } from './MissingSectionNotice';
import { PersonForm } from './PersonForm';
import { useAdminSort } from './useAdminSort';

export function PeopleAdmin() {
  const data = useDataStore((state) => state.data);
  const deletePerson = useDataStore((state) => state.deletePerson);
  const canEdit = useCanEdit();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Person | 'new' | null>(null);

  const noSections = data.sections.length === 0;
  const initiativesOf = (person: Person) => data.initiatives.filter((i) => i.personIds.includes(person.id));
  const initiativeNames = (person: Person) => joinSorted(initiativesOf(person).map((initiative) => initiative.name));
  // Raderad personal visas inte; den finns kvar endast för den låsta tidens skull.
  const { sortedRows: people, sortHeader } = useAdminSort('people', activePeople(data), {
    name: (person) => person.name,
    section: (person) => sectionName(data, person.sectionId),
    type: (person) => PERSON_TYPE_LABEL[person.type],
    rate: (person) => effectiveRate(person, data.settings),
    hours: (person) => effectiveMonthlyHours(person, data.settings),
    initiatives: initiativeNames,
  });

  const remove = async (person: Person) => {
    const confirmed = await confirm({
      title: 'Radera person',
      danger: true,
      confirmLabel: 'Radera',
      message: <DeletePersonMessage person={person} linked={initiativesOf(person)} />,
    });
    if (confirmed) deletePerson(person.id);
  };

  return (
    <div className="card">
      <div className="card-head admin-section-head">
        <div>
          <h2>Personal</h2>
          <div className="small muted">{plural(people.length, 'person', 'personer')}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={noSections || !canEdit}
          title={noSections ? 'Skapa först en sektion' : undefined}
          onClick={() => setEditing('new')}
        >
          + Ny person
        </button>
      </div>

      {noSections && <MissingSectionNotice />}

      {people.length === 0 ? (
        <div className="empty">Ingen personal ännu. Börja med att lägga till en person.</div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {sortHeader('name', 'Namn')}
                {sortHeader('section', 'Sektion')}
                {sortHeader('type', 'Typ')}
                {sortHeader('rate', 'Timkostnad', 'num')}
                {sortHeader('hours', 'Arbetstid/mån', 'num')}
                {sortHeader('initiatives', 'Initiativ')}
                <th>
                  <span className="sr-only">Åtgärder</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td>
                    <strong>{person.name}</strong>
                  </td>
                  <td>{sectionName(data, person.sectionId)}</td>
                  <td>
                    <span className={`tag ${person.type}`}>{PERSON_TYPE_LABEL[person.type]}</span>
                  </td>
                  <td className="num">
                    {formatSek(effectiveRate(person, data.settings))}/h{' '}
                    <SourceTag isOwnValue={person.hourlyRate !== null} />
                  </td>
                  <td className="num">
                    {formatHours(effectiveMonthlyHours(person, data.settings))} h{' '}
                    <SourceTag isOwnValue={person.monthlyHours !== null} />
                  </td>
                  <td className="small">{initiativeNames(person) || <span className="muted">{MISSING}</span>}</td>
                  <td className="actions">
                    <button type="button" className="link-btn" disabled={!canEdit} onClick={() => setEditing(person)}>
                      Redigera
                    </button>
                    <button
                      type="button"
                      className="link-btn danger"
                      disabled={!canEdit}
                      onClick={() => void remove(person)}
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

      {editing && <PersonForm person={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Visar om värdet är personens eget eller ärvs från typens standardvärde. */
function SourceTag({ isOwnValue }: { isOwnValue: boolean }) {
  return <span className={isOwnValue ? 'tag custom' : 'tag'}>{isOwnValue ? 'egen' : 'standard'}</span>;
}

/**
 * Radering låser personens tid: den finns kvar och räknas med men kan inte ändras. Initiativ där
 * personen saknar timmar kopplas bort.
 */
function DeletePersonMessage({ person, linked }: { person: Person; linked: Initiative[] }) {
  const data = useDataStore((state) => state.data);
  const hoursOn = (initiative: Initiative) =>
    hoursPairText(
      storedHoursForPersonInInitiative(data, initiative.id, person.id, 'estimate'),
      storedHoursForPersonInInitiative(data, initiative.id, person.id, 'actual'),
    );
  const withHours = linked.filter((initiative) => hoursOn(initiative));
  return (
    <>
      <p>
        Vill du radera <strong>{person.name}</strong>? Personen kan inte väljas igen, men namnet kan användas av en ny
        person.
      </p>
      {withHours.length > 0 && (
        <>
          <p>Tiden som redan registrerats finns kvar och räknas med, men låses och kan inte ändras:</p>
          <ul>
            {withHours.map((initiative) => (
              <li key={initiative.id}>
                {initiative.name}: {hoursOn(initiative)}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
