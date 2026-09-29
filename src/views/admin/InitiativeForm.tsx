import { useState, type FormEvent } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { Modal } from '../../components/Modal';
import { hoursLostByUpdate, storedHoursForPersonInInitiative, type HoursLoss } from '../../domain/calc';
import { formatInputNumber, hoursPairText, parseOptionalNonNegative } from '../../domain/format';
import { compareByName, compareValues, sortByName } from '../../domain/sorting';
import { PERSON_TYPE_LABEL, TAJMA_CLASSES, type AppData, type Initiative, type TajmaClass } from '../../domain/types';
import { useDataStore } from '../../store/store';
import { personName, sectionName } from '../labels';

interface Props {
  initiative?: Initiative;
  /** Förvald produktägare för nya initiativ. */
  defaultOwnerId?: string;
  onClose: () => void;
}

/** Rader som beskriver vilka timmar en ändring skulle radera, för bekräftelsedialogen. */
function describeHoursLoss(data: AppData, loss: HoursLoss): string[] {
  return [
    ...loss.people.map(
      (person) =>
        `${personName(data, person.personId)}: ${hoursPairText(person.estimate, person.actual)} (tas bort från initiativet)`,
    ),
    ...loss.years.map((year) => `År ${year.year}: ${hoursPairText(year.estimate, year.actual)} (året tas bort)`),
  ];
}

/** Förra året och fyra år framåt, plus alla år som redan är valda eller sparade på initiativet. */
function yearChoices(currentYear: number, ...selectedYears: number[][]): number[] {
  const nearbyYears = Array.from({ length: 5 }, (_, offset) => currentYear - 1 + offset);
  return [...new Set([...nearbyYears, ...selectedYears.flat()])].sort((a, b) => a - b);
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

export function InitiativeForm({ initiative, defaultOwnerId, onClose }: Props) {
  const data = useDataStore((state) => state.data);
  const addInitiative = useDataStore((state) => state.addInitiative);
  const updateInitiative = useDataStore((state) => state.updateInitiative);
  const confirm = useConfirm();
  const isNew = !initiative;
  const currentYear = new Date().getFullYear();

  const [name, setName] = useState(initiative?.name ?? '');
  const [ownerId, setOwnerId] = useState(initiative?.productOwnerId ?? defaultOwnerId ?? '');
  const [years, setYears] = useState<number[]>(initiative?.years ?? [currentYear]);
  const [personIds, setPersonIds] = useState<string[]>(initiative?.personIds ?? []);
  const [extraYear, setExtraYear] = useState('');
  const [budget, setBudget] = useState(formatInputNumber(initiative?.budget ?? null));
  // Tom sträng = ingen tajmaklass (standard för nya initiativ).
  const [tajmaClass, setTajmaClass] = useState<TajmaClass | ''>(initiative?.tajmaClass ?? '');
  const [error, setError] = useState<string | null>(null);

  const parsedBudget = parseOptionalNonNegative(budget);
  const budgetInvalid = !parsedBudget.ok || parsedBudget.value === 0;

  // Initiativets sektion följer produktägaren. Ett befintligt initiativ kan bara byta till en
  // produktägare i samma sektion; nya initiativ kan välja produktägare i alla sektioner.
  const lockedSectionId = initiative
    ? data.productOwners.find((owner) => owner.id === initiative.productOwnerId)?.sectionId
    : undefined;
  const ownerGroups = sortByName(data.sections)
    .filter((section) => !lockedSectionId || section.id === lockedSectionId)
    .map((section) => ({
      section,
      owners: sortByName(data.productOwners.filter((owner) => owner.sectionId === section.id)),
    }))
    .filter((group) => group.owners.length > 0);
  const selectedSectionId = data.productOwners.find((owner) => owner.id === ownerId)?.sectionId;
  // Personal i initiativets sektion först, därefter personal som lånas in från andra sektioner.
  const isBorrowed = (sectionId: string) => Boolean(selectedSectionId) && sectionId !== selectedSectionId;
  const people = [...data.people].sort(
    (a, b) => compareValues(Number(isBorrowed(a.sectionId)), Number(isBorrowed(b.sectionId))) || compareByName(a, b),
  );

  const addExtraYear = () => {
    const year = Number(extraYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return setError('Ange ett giltigt årtal, t.ex. 2030.');
    setYears((current) => (current.includes(year) ? current : [...current, year]));
    setExtraYear('');
    setError(null);
  };

  const validationError = () => {
    if (!name.trim()) return 'Ange ett namn.';
    if (!ownerId) return 'Välj en produktägare.';
    if (years.length === 0) return 'Välj minst ett år.';
    if (isNew && personIds.length === 0) return 'Koppla minst en person till initiativet.';
    if (budgetInvalid) return 'Budget måste vara ett belopp större än 0, eller lämnas tom.';
    return null;
  };

  /** Varnar om ändringen raderar timmar för personer eller år som tas bort. */
  const confirmHoursLoss = async (current: Initiative) => {
    const losses = describeHoursLoss(data, hoursLostByUpdate(data, current, { personIds, years }));
    if (losses.length === 0) return true;
    return confirm({
      title: 'Timmar kommer att raderas',
      danger: true,
      confirmLabel: 'Spara och radera timmar',
      message: (
        <>
          <p>Ändringarna tar bort planerade timmar:</p>
          <ul>
            {losses.map((loss) => (
              <li key={loss}>{loss}</li>
            ))}
          </ul>
          <p>Vill du fortsätta?</p>
        </>
      ),
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validationError();
    if (invalid) return setError(invalid);

    const values = {
      name: name.trim(),
      productOwnerId: ownerId,
      personIds,
      years,
      budget: parsedBudget.ok ? parsedBudget.value : null,
      tajmaClass: tajmaClass || null,
    };
    try {
      if (initiative) {
        if (!(await confirmHoursLoss(initiative))) return;
        updateInitiative(initiative.id, values);
      } else {
        addInitiative(values);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal
      title={initiative ? `Redigera ${initiative.name}` : 'Nytt initiativ'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Avbryt
          </button>
          <button type="submit" form="initiative-form" className="btn btn-primary">
            {isNew ? 'Skapa initiativ' : 'Spara'}
          </button>
        </>
      }
    >
      <form id="initiative-form" onSubmit={(e) => void submit(e)} className="form-stack" noValidate>
        <div className="form-row">
          <label className="field">
            <span>Namn</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Produktägare</span>
            <select
              className="select"
              aria-label="Produktägare"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="" disabled>
                Välj produktägare…
              </option>
              {ownerGroups.map(({ section, owners }) => (
                <optgroup key={section.id} label={section.name}>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="small muted field-hint">
              Sektion: {selectedSectionId ? sectionName(data, selectedSectionId) : '– (följer produktägaren)'}
            </span>
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span>Budget (kr, frivillig)</span>
            <input
              className={budgetInvalid ? 'input invalid' : 'input'}
              inputMode="decimal"
              placeholder="Ingen budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Tajmaklass</span>
            <select
              className="select"
              value={tajmaClass}
              onChange={(e) => setTajmaClass(e.target.value as TajmaClass | '')}
            >
              <option value="">– (ingen)</option>
              {TAJMA_CLASSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="small muted form-note">
          Budgeten är en totalbudget för initiativets alla år. I arbetsläget visas prognos och utfall som andel av
          budgeten. Budget och tajmaklass är frivilliga.
        </p>

        <fieldset className="field plain">
          <legend>År</legend>
          <div className="chips">
            {yearChoices(currentYear, years, initiative?.years ?? []).map((year) => (
              <label key={year} className={years.includes(year) ? 'chip checked' : 'chip'}>
                <input
                  type="checkbox"
                  checked={years.includes(year)}
                  onChange={() => setYears((current) => toggle(current, year))}
                />
                {year}
              </label>
            ))}
            <span className="inline-form">
              <input
                className="input year-input"
                inputMode="numeric"
                placeholder="Annat år"
                aria-label="Lägg till annat år"
                value={extraYear}
                onChange={(e) => setExtraYear(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExtraYear();
                  }
                }}
              />
              <button type="button" className="btn" onClick={addExtraYear} disabled={!extraYear.trim()}>
                Lägg till
              </button>
            </span>
          </div>
        </fieldset>

        <fieldset className="field plain">
          <legend>
            Personal{' '}
            <span className="muted small">
              ({personIds.length} valda{isNew ? ', minst 1' : ''})
            </span>
          </legend>
          {people.length === 0 ? (
            <div className="notice">Det finns ingen personal. Lägg till personal först.</div>
          ) : (
            <div className="check-list">
              {people.map((person) => {
                const storedHours = initiative
                  ? hoursPairText(
                      storedHoursForPersonInInitiative(data, initiative.id, person.id, 'estimate'),
                      storedHoursForPersonInInitiative(data, initiative.id, person.id, 'actual'),
                    )
                  : '';
                return (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={personIds.includes(person.id)}
                      onChange={() => setPersonIds((current) => toggle(current, person.id))}
                    />
                    <span>{person.name}</span>
                    <span className={`tag ${person.type}`}>{PERSON_TYPE_LABEL[person.type]}</span>
                    {isBorrowed(person.sectionId) && (
                      <span className="small muted">lånas från {sectionName(data, person.sectionId)}</span>
                    )}
                    <span className="spacer" />
                    {storedHours && <span className="small muted">{storedHours}</span>}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
