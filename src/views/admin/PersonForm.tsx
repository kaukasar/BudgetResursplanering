import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { SectionSelect } from '../../components/SectionSelect';
import { formatHours, formatInputNumber, formatSek, parseOptionalNonNegative } from '../../domain/format';
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
  // Med en enda sektion förväljs den.
  const defaultSectionId = sections.length === 1 ? sections[0]!.id : '';

  const [name, setName] = useState(person?.name ?? '');
  const [type, setType] = useState<PersonType>(person?.type ?? 'employee');
  const [sectionId, setSectionId] = useState(person?.sectionId ?? defaultSectionId);
  const [rate, setRate] = useState(formatInputNumber(person?.hourlyRate ?? null));
  const [hours, setHours] = useState(formatInputNumber(person?.monthlyHours ?? null));
  const [error, setError] = useState<string | null>(null);

  const parsedRate = parseOptionalNonNegative(rate);
  const parsedHours = parseOptionalNonNegative(hours);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Ange ett namn.');
    if (!sectionId) return setError('Välj en sektion.');
    if (!parsedRate.ok || !parsedHours.ok) return setError('Rätta de markerade fälten.');
    const values = {
      name: name.trim(),
      type,
      sectionId,
      hourlyRate: parsedRate.value,
      monthlyHours: parsedHours.value,
    };
    try {
      if (person) updatePerson(person.id, values);
      else addPerson(values);
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
      <form id="person-form" onSubmit={submit} className="form-stack" noValidate>
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
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={`Standard: ${formatSek(settings[type].hourlyRate)}`}
            />
          </label>
          <label className="field">
            <span>Normal arbetstid (h/mån)</span>
            <input
              className={parsedHours.ok ? 'input' : 'input invalid'}
              inputMode="decimal"
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
