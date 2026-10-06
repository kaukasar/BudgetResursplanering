import { externalHourlyRate, storedEstimateAndActual } from '../../domain/calc';
import { formatSek, hoursPairText } from '../../domain/format';
import {
  EXTERNAL_STAFF,
  EXTERNAL_STAFF_LABEL,
  PERSON_TYPE_LABEL,
  type AppData,
  type Initiative,
  type Person,
} from '../../domain/types';
import { sectionName } from '../labels';

interface Props {
  data: AppData;
  /** Initiativet som redigeras, eller `undefined` för ett nytt initiativ. */
  initiative: Initiative | undefined;
  /** Produktägarens sektion. */
  sectionId: string;
  /** Aktiv personal i sektionen, dvs. de som kan kopplas. */
  people: Person[];
  personIds: string[];
  selectedCount: number;
  onToggle: (personId: string) => void;
}

/**
 * Kryssrutor för personalen i produktägarens sektion och för Extern personal. Vid redigering visas
 * de timmar som redan finns sparade, så att det syns vad en borttagning skulle radera.
 */
export function InitiativePeopleField({
  data,
  initiative,
  sectionId,
  people,
  personIds,
  selectedCount,
  onToggle,
}: Props) {
  const section = sectionName(data, sectionId);
  const storedHoursText = (personId: string) =>
    initiative ? hoursPairText(storedEstimateAndActual(data, initiative.id, personId)) : '';
  const externalStoredHours = storedHoursText(EXTERNAL_STAFF.id);

  return (
    <>
      <fieldset className="field plain">
        <legend>
          Personal i {section}{' '}
          <span className="muted small">
            ({selectedCount} valda{initiative ? '' : ', minst 1'})
          </span>
        </legend>
        {people.length === 0 ? (
          <div className="notice">Det finns ingen personal i {section}. Lägg till personal under fliken Personal.</div>
        ) : (
          <div className="check-list">
            {people.map((person) => {
              const storedHours = storedHoursText(person.id);
              return (
                <label key={person.id}>
                  <input type="checkbox" checked={personIds.includes(person.id)} onChange={() => onToggle(person.id)} />
                  <span>{person.name}</span>
                  <span className={`tag ${person.type}`}>{PERSON_TYPE_LABEL[person.type]}</span>
                  <span className="spacer" />
                  {storedHours && <span className="small muted">{storedHours}</span>}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <fieldset className="field plain">
        <legend>Extern personal</legend>
        <div className="check-list">
          <label>
            <input
              type="checkbox"
              checked={personIds.includes(EXTERNAL_STAFF.id)}
              onChange={() => onToggle(EXTERNAL_STAFF.id)}
            />
            <span>{EXTERNAL_STAFF.name}</span>
            <span className="tag external">{EXTERNAL_STAFF_LABEL}</span>
            <span className="small muted">schablon {formatSek(externalHourlyRate(data.settings))}/h</span>
            <span className="spacer" />
            {externalStoredHours && <span className="small muted">{externalStoredHours}</span>}
          </label>
        </div>
        <p className="small muted form-note">
          Samlad tid från personal utanför sektionen och de ordinarie teamen. Timkostnaden är medelvärdet av
          standardtimkostnaden för anställd och konsult, och arbetstiden har inget tak.
        </p>
      </fieldset>
    </>
  );
}
