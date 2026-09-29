import { useState, type KeyboardEvent } from 'react';
import { formatInputNumber, parseNonNegative } from '../domain/format';

interface HoursCellProps {
  /** `null` = inget värde (endast när `nullable`). */
  value: number | null;
  onCommit: (value: number | null) => void;
  label: string;
  /**
   * `nullable` (utfall): tom cell betyder "inte rapporterat" och 0 visas som 0.
   * Annars (estimat): tom cell betyder 0 och 0 visas som tom cell.
   */
  nullable?: boolean;
  /** Ledtext i tom cell, t.ex. estimatet när utfall matas in. */
  placeholder?: string;
  /** Grupp-id för tangentbordsnavigering mellan celler i samma tabell. */
  grid: string;
  row: number;
  col: number;
}

/** Estimat visar 0 som tom cell; utfall visar 0 som "0" eftersom tom cell betyder "ej rapporterat". */
const display = (value: number | null, nullable: boolean) => formatInputNumber(!nullable && value === 0 ? null : value);

/** `undefined` = ogiltig inmatning. */
function parse(text: string, nullable: boolean): number | null | undefined {
  if (nullable && text.trim() === '') return null;
  return parseNonNegative(text) ?? undefined;
}

function focusCell(grid: string, row: number, col: number) {
  const target = document.querySelector<HTMLInputElement>(
    `input[data-grid="${grid}"][data-row="${row}"][data-col="${col}"]`,
  );
  target?.focus();
}

/**
 * Inmatningscell för timmar. Giltiga värden sparas direkt vid varje tangenttryckning så att
 * summor uppdateras omedelbart; ogiltig inmatning markeras och sparas inte.
 */
export function HoursCell({
  value,
  onCommit,
  label,
  nullable = false,
  placeholder = '0',
  grid,
  row,
  col,
}: HoursCellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parse(draft, nullable) === undefined;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(grid, row + (e.shiftKey && e.key === 'Enter' ? -1 : 1), col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(grid, row - 1, col);
    } else if (e.key === 'Escape' && draft !== null) {
      setDraft(null);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={invalid ? 'invalid' : undefined}
      aria-label={label}
      aria-invalid={invalid || undefined}
      title={invalid ? 'Ange ett tal som är 0 eller större' : undefined}
      placeholder={placeholder}
      data-grid={grid}
      data-row={row}
      data-col={col}
      value={draft ?? display(value, nullable)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const parsed = parse(text, nullable);
        if (parsed !== undefined && parsed !== value) onCommit(parsed);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={onKeyDown}
    />
  );
}
