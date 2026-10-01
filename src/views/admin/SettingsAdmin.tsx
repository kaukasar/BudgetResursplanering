import { useId, useState } from 'react';
import { externalHourlyRate, hasExternalStaff } from '../../domain/calc';
import { formatInputNumber, formatSek, parseWholeNumber, plural } from '../../domain/format';
import { EXTERNAL_STAFF, PERSON_TYPE_LABEL, type PersonType } from '../../domain/types';
import { useCanEdit } from '../../store/editLock';
import { useDataStore } from '../../store/store';

const PERSON_TYPES = Object.keys(PERSON_TYPE_LABEL) as PersonType[];

export function SettingsAdmin() {
  const data = useDataStore((state) => state.data);
  const updateTypeSettings = useDataStore((state) => state.updateTypeSettings);
  const canEdit = useCanEdit();

  return (
    <div className="stack">
      <div className="card card-body">
        <h2 className="settings-title">Globala inställningar</h2>
        <p className="muted settings-intro">
          Standardvärden för timkostnad och normal arbetstid per personaltyp. De gäller all personal av typen som inte
          har egna värden angivna. Ändringar slår igenom direkt i alla beräkningar.
        </p>
      </div>
      <div className="settings-grid">
        {PERSON_TYPES.map((type) => {
          const peopleOfType = data.people.filter((person) => person.type === type);
          const usingDefaultRate = peopleOfType.filter((person) => person.hourlyRate === null).length;
          const usingDefaultHours = peopleOfType.filter((person) => person.monthlyHours === null).length;
          return (
            <section key={type} className="card" aria-label={PERSON_TYPE_LABEL[type]}>
              <div className="card-head">
                <h3>{PERSON_TYPE_LABEL[type]}</h3>
                <span className="small muted">{plural(peopleOfType.length, 'person', 'personer')}</span>
              </div>
              <div className="card-body">
                <LiveNumberField
                  label="Timkostnad"
                  unit="kr/h"
                  value={data.settings[type].hourlyRate}
                  readOnly={!canEdit}
                  onCommit={(hourlyRate) => updateTypeSettings(type, { hourlyRate })}
                />
                <LiveNumberField
                  label="Normal arbetstid"
                  unit="h/månad"
                  value={data.settings[type].monthlyHours}
                  readOnly={!canEdit}
                  onCommit={(monthlyHours) => updateTypeSettings(type, { monthlyHours })}
                />
                <div className="small muted">
                  Används av {usingDefaultRate} av {peopleOfType.length} för timkostnad och {usingDefaultHours} av{' '}
                  {peopleOfType.length} för arbetstid.
                </div>
              </div>
            </section>
          );
        })}
        <ExternalStaffSettings />
      </div>
    </div>
  );
}

/** Extern personal har inga egna inställningar; timkostnaden räknas fram och visas här. */
function ExternalStaffSettings() {
  const data = useDataStore((state) => state.data);
  const initiativeCount = data.initiatives.filter(hasExternalStaff).length;
  return (
    <section className="card" aria-label={EXTERNAL_STAFF.name}>
      <div className="card-head">
        <h3>{EXTERNAL_STAFF.name}</h3>
        <span className="small muted">{plural(initiativeCount, 'initiativ', 'initiativ')}</span>
      </div>
      <div className="card-body">
        <div className="field">
          <span>Timkostnad (schablon)</span>
          <strong className="settings-value">{formatSek(externalHourlyRate(data.settings))}/h</strong>
        </div>
        <div className="field">
          <span>Normal arbetstid</span>
          <strong className="settings-value">Inget tak</strong>
        </div>
        <div className="small muted">
          Räknas fram automatiskt som medelvärdet av standardtimkostnaden för anställd och konsult, avrundat till
          heltal. Extern personal blir aldrig överallokerad.
        </div>
      </div>
    </section>
  );
}

interface LiveNumberFieldProps {
  label: string;
  unit: string;
  value: number;
  /** Skrivskyddat när redigering i adminläget är avstängd. */
  readOnly: boolean;
  onCommit: (value: number) => void;
}

/** Nummerfält som sparar direkt när värdet är giltigt. Ett tomt fält är ogiltigt. */
function LiveNumberField({ label, unit, value, readOnly, onCommit }: LiveNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const parse = (text: string) => (text.trim() === '' ? null : parseWholeNumber(text));
  const invalid = draft !== null && parse(draft) === null;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="inline-form with-unit">
        <input
          id={id}
          className={invalid ? 'input invalid number-input' : 'input number-input'}
          inputMode="numeric"
          readOnly={readOnly}
          value={draft ?? formatInputNumber(value)}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parse(e.target.value);
            if (parsed !== null) onCommit(parsed);
          }}
          onBlur={() => setDraft(null)}
          aria-invalid={invalid || undefined}
        />
        <span className="muted">{unit}</span>
      </div>
    </div>
  );
}
