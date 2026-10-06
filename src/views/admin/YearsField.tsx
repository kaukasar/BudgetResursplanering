import { useState } from 'react';
import { isValidYear } from '../../domain/operations';
import { toggle } from './toggle';

interface Props {
  years: number[];
  onChange: (years: number[]) => void;
  /** År som redan är sparade på initiativet. De visas alltid som val, även när de avmarkeras. */
  savedYears: number[];
  /** Felmeddelande vid ogiltigt årtal; `null` när ett år har lagts till. */
  onError: (message: string | null) => void;
}

/** Förra året och fyra år framåt, plus alla år som redan är valda eller sparade. */
function yearChoices(currentYear: number, ...selectedYears: number[][]): number[] {
  const nearbyYears = Array.from({ length: 5 }, (_, offset) => currentYear - 1 + offset);
  return [...new Set([...nearbyYears, ...selectedYears.flat()])].sort((a, b) => a - b);
}

/** Initiativets år som kryssrutor, och ett fält för att lägga till andra år. */
export function YearsField({ years, onChange, savedYears, onError }: Props) {
  const [extraYear, setExtraYear] = useState('');

  const addExtraYear = () => {
    const year = Number(extraYear);
    if (!isValidYear(year)) return onError('Ange ett giltigt årtal, t.ex. 2030.');
    if (!years.includes(year)) onChange([...years, year]);
    setExtraYear('');
    onError(null);
  };

  return (
    <fieldset className="field plain">
      <legend>År</legend>
      <div className="chips">
        {yearChoices(new Date().getFullYear(), years, savedYears).map((year) => (
          <label key={year} className={years.includes(year) ? 'chip checked' : 'chip'}>
            <input type="checkbox" checked={years.includes(year)} onChange={() => onChange(toggle(years, year))} />
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
  );
}
