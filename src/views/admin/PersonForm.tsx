import { useState, type FormEvent } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { Modal } from '../../components/Modal';
import { storedHoursForPersonInInitiative } from '../../domain/calc';
import { SectionSelect } from '../../components/SectionSelect';
import { formatHours, formatInputNumber, formatSek, listText, parseOptionalWholeNumber } from '../../domain/format';
import { initiativesLockedBySectionChange } from '../../domain/operations';
import { sortByName } from '../../domain/sorting';
import { PERSON_TYPE_LABEL, type Person, type PersonType } from '../../domain/types';
import { useDataStore } from '../../store/store';

interface Props {
  person?: Person;
  onClose: () => void;
}

const PERSON_TYPES = Object.keys(PERSON_TYPE_LABEL) as PersonType[];

/** Formulär för att skapa eller redigera en person. Tomma värden = ärv typens standard. */
export function PersonForm({ person, onClose }: Props) {
  const settings = useDataStore((state) => state.data.settings);
  const sections = useDataStore((state) => state.data.sections);
  const addPerson = useDataStore((state) => state.addPerson);
  const updatePerson = useDataStore((state) => state.updatePerson);
  const data = useDataStore((state) => state.data);
  const confirm = useConfirm();
  // Med en enda sektion förväljs den.
  const defaultSectionId = sections.length === 1 ? sections[0]!.id : '';

  const [name, setName] = useState(person?.name ?? '');
  const [type, setType] = useState<PersonType>(person?.type ?? 'employee');
  const [sectionId, setSectionId] = useState(person?.sectionId ?? defaultSectionId);
  const [rate, setRate] = useState(formatInputNumber(person?.hourlyRate ?? null));
  const [hours, setHours] = useState(formatInputNumber(person?.monthlyHours ?? null));
  const [error, setError] = useState<string | null>(null);

  const parsedRate = parseOptionalWholeNumber(rate);
  const parsedHours = parseOptionalWholeNumber(hours);

  /**
   * Byter personen sektion låses tiden på den gamla sektionens initiativ. Bekräftas först, med de
   * initiativ som berörs.
   */
  const confirmSectionChange = async (current: Person) => {
    const affected = initiativesLockedBySectionChange(data, current.id, sectionId);
    if (affected.length === 0) return true;
    const hasHours = (initiativeId: string) =>
      storedHoursForPersonInInitiative(data, initiativeId, current.id, 'estimate') > 0 ||
      storedHoursForPersonInInitiative(data, initiativeId, current.id, 'actual') > 0;
    const locked = affected.filter((initiative) => hasHours(initiative.id));
    const unlinked = affected.filter((initiative) => !hasHours(initiative.id));
    return confirm({
      title: 'Byt sektion',
      confirmLabel: 'Byt sektion',
      message: (
        <>
          {locked.length > 0 && (
            <p>
              {current.name} blir låst på {listText(sortByName(locked).map((initiative) => initiative.name))}. Tiden
              finns kvar men kan inte ändras.
            </p>
          )}
          {unlinked.length > 0 && (
            <p>
              {current.name} kopplas bort från {listText(sortByName(unlinked).map((initiative) => initiative.name))},
              där ingen tid är registrerad.
            </p>
          )}
          <p>Personen kan därefter bara arbeta på initiativ i den nya sektionen.</p>
        </>
      ),
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Ange ett namn.');
    if (!sectionId) return setError('Välj en sektion.');
    if (!parsedRate.ok || !parsedHours.ok)
      return setError('Timkostnad och arbetstid måste vara heltal som är 0 eller större.');
    const values = {
      name: name.trim(),
      type,
      sectionId,
      hourlyRate: parsedRate.value,
      monthlyHours: parsedHours.value,
    };
    try {
      if (person) {
        if (sectionId !== person.sectionId && !(await confirmSectionChange(person))) return;
        updatePerson(person.id, values);
      } else {
        addPerson(values);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal
      title={person ? `Redigera ${person.name}` : 'Ny person'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button type="submit" form="person-form" className="btn btn-primary">
            {person ? 'Spara' : 'Skapa person'}
          </button>
        </>
      }
    >
      <form id="person-form" onSubmit={(e) => void submit(e)} className="form-stack" noValidate>
        <div className="form-row">
          <label className="field">
            <span>Namn</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Sektion</span>
            <SectionSelect sections={sections} value={sectionId} onChange={setSectionId} />
          </label>
        </div>

        <div className="field">
          <span id="person-type-label">Typ</span>
          <div className="segmented" role="group" aria-labelledby="person-type-label">
            {PERSON_TYPES.map((option) => (
              <button key={option} type="button" aria-pressed={type === option} onClick={() => setType(option)}>
                {PERSON_TYPE_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label className="field">
            <span>Timkostnad (kr/h)</span>
            <input
              className={parsedRate.ok ? 'input' : 'input invalid'}
              inputMode="numeric"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={`Standard: ${formatSek(settings[type].hourlyRate)}`}
            />
          </label>
          <label className="field">
            <span>Normal arbetstid (h/mån)</span>
            <input
              className={parsedHours.ok ? 'input' : 'input invalid'}
              inputMode="numeric"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder={`Standard: ${formatHours(settings[type].monthlyHours)} h`}
            />
          </label>
        </div>
        <p className="small muted">
          Lämna fälten tomma för att använda standardvärdena för {PERSON_TYPE_LABEL[type].toLowerCase()}{' '}
          (inställningar). Ändras standardvärdena följer personen med automatiskt.
        </p>

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
