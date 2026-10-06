import { useState, type FormEvent } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Modal } from '../../components/Modal';
import { activePeopleInSection, hoursLostByUpdate, ownerSectionId, type HoursLoss } from '../../domain/calc';
import { formatInputNumber, hoursPairText, parseOptionalWholeNumber } from '../../domain/format';
import { sortByName } from '../../domain/sorting';
import { EXTERNAL_STAFF_ID, TAJMA_CLASSES, type AppData, type Initiative, type TajmaClass } from '../../domain/types';
import { useDataStore } from '../../store/store';
import { personName, sectionName } from '../labels';
import { InitiativePeopleField } from './InitiativePeopleField';
import { toggle } from './toggle';
import { YearsField } from './YearsField';

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
      (person) => `${personName(data, person.personId)}: ${hoursPairText(person)} (tas bort från initiativet)`,
    ),
    ...loss.years.map((year) => `År ${year.year}: ${hoursPairText(year)} (året tas bort)`),
  ];
}

/** Intern och extern budget är frivilliga och oberoende; en angiven budget är ett heltal över 0. */
function parseBudget(text: string): { value: number | null; invalid: boolean } {
  const parsed = parseOptionalWholeNumber(text);
  return { value: parsed.ok ? parsed.value : null, invalid: !parsed.ok || parsed.value === 0 };
}

/** Produktägarna grupperade per sektion. Ett befintligt initiativ kan bara byta inom sin sektion. */
function ownerGroups(data: AppData, onlySectionId: string | undefined) {
  return sortByName(data.sections)
    .filter((section) => !onlySectionId || section.id === onlySectionId)
    .map((section) => ({
      section,
      owners: sortByName(data.productOwners.filter((owner) => owner.sectionId === section.id)),
    }))
    .filter((group) => group.owners.length > 0);
}

export function InitiativeForm({ initiative, defaultOwnerId, onClose }: Props) {
  const data = useDataStore((state) => state.data);
  const addInitiative = useDataStore((state) => state.addInitiative);
  const updateInitiative = useDataStore((state) => state.updateInitiative);
  const confirm = useConfirm();
  const isNew = !initiative;

  const [name, setName] = useState(initiative?.name ?? '');
  const [ownerId, setOwnerId] = useState(initiative?.productOwnerId ?? defaultOwnerId ?? '');
  const [years, setYears] = useState<number[]>(initiative?.years ?? [new Date().getFullYear()]);
  // Personer med låst tid (bytt sektion eller raderade) visas inte i listan men finns kvar i
  // initiativet, eftersom låst tid inte kan ändras.
  const [personIds, setPersonIds] = useState<string[]>(initiative?.personIds ?? []);
  const [internalBudget, setInternalBudget] = useState(formatInputNumber(initiative?.internalBudget ?? null));
  const [externalBudget, setExternalBudget] = useState(formatInputNumber(initiative?.externalBudget ?? null));
  // Tom sträng = ingen tajmaklass (standard för nya initiativ).
  const [tajmaClass, setTajmaClass] = useState<TajmaClass | ''>(initiative?.tajmaClass ?? '');
  const [error, setError] = useState<string | null>(null);

  const parsedInternal = parseBudget(internalBudget);
  const parsedExternal = parseBudget(externalBudget);
  // Initiativets sektion följer produktägaren, och personal kan bara kopplas från den sektionen.
  const selectedSectionId = ownerSectionId(data, ownerId);
  const people = sortByName(activePeopleInSection(data, selectedSectionId));
  const selectedCount = people.filter((person) => personIds.includes(person.id)).length;

  // Ett nytt initiativ kan byta produktägare till en annan sektion; vald personal från den tidigare
  // sektionen kan då inte längre kopplas och avmarkeras.
  const changeOwner = (id: string) => {
    const newSectionId = ownerSectionId(data, id);
    if (newSectionId !== selectedSectionId) {
      const linkable = activePeopleInSection(data, newSectionId).map((person) => person.id);
      setPersonIds((current) => current.filter((id) => id === EXTERNAL_STAFF_ID || linkable.includes(id)));
    }
    setOwnerId(id);
  };

  const validationError = () => {
    if (!name.trim()) return 'Ange ett namn.';
    if (!ownerId) return 'Välj en produktägare.';
    if (years.length === 0) return 'Välj minst ett år.';
    // Extern personal räknas inte som en person i kravet på minst en kopplad person.
    if (isNew && selectedCount === 0) return 'Koppla minst en person till initiativet.';
    if (parsedInternal.invalid) return 'Intern budget måste vara ett heltal större än 0, eller lämnas tom.';
    if (parsedExternal.invalid) return 'Extern budget måste vara ett heltal större än 0, eller lämnas tom.';
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
      internalBudget: parsedInternal.value,
      externalBudget: parsedExternal.value,
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
              onChange={(e) => changeOwner(e.target.value)}
            >
              <option value="" disabled>
                Välj produktägare…
              </option>
              {ownerGroups(data, initiative && ownerSectionId(data, initiative.productOwnerId)).map(
                ({ section, owners }) => (
                  <optgroup key={section.id} label={section.name}>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
            <span className="small muted field-hint">
              Sektion: {selectedSectionId ? sectionName(data, selectedSectionId) : '– (följer produktägaren)'}
            </span>
          </label>
        </div>

        <div className="form-row">
          <BudgetField
            label="Intern budget (kr, frivillig)"
            value={internalBudget}
            invalid={parsedInternal.invalid}
            onChange={setInternalBudget}
          />
          <BudgetField
            label="Extern budget (kr, frivillig)"
            value={externalBudget}
            invalid={parsedExternal.invalid}
            onChange={setExternalBudget}
          />
        </div>
        <p className="small muted form-note">
          Budgetarna gäller initiativets alla år. Den interna budgeten avser tid för personal i sektionen och den
          externa budgeten tid för Extern personal. I arbetsläget visas prognos och utfall som andel av respektive
          budget.
        </p>

        <div className="form-row">
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

        <YearsField years={years} onChange={setYears} savedYears={initiative?.years ?? []} onError={setError} />

        {selectedSectionId ? (
          <InitiativePeopleField
            data={data}
            initiative={initiative}
            sectionId={selectedSectionId}
            people={people}
            personIds={personIds}
            selectedCount={selectedCount}
            onToggle={(personId) => setPersonIds((current) => toggle(current, personId))}
          />
        ) : (
          <div className="notice">Välj en produktägare för att se personalen i produktägarens sektion.</div>
        )}

        {error && <ErrorNotice>{error}</ErrorNotice>}
      </form>
    </Modal>
  );
}

interface BudgetFieldProps {
  label: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}

function BudgetField({ label, value, invalid, onChange }: BudgetFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className={invalid ? 'input invalid' : 'input'}
        inputMode="numeric"
        placeholder="Ingen budget"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
