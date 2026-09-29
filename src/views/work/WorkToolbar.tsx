import type { ProductOwner, Section } from '../../domain/types';
import { ALL_OWNERS, ALL_SECTIONS, useUiStore, type WorkView } from '../../store/ui';
import { VIEW_LABEL } from './workViews';

interface Props {
  years: number[];
  sections: Section[];
  /** Produktägare i vald sektion. */
  owners: ProductOwner[];
  /** Vald sektion och produktägare efter kontroll att de finns kvar (annars "alla"). */
  sectionId: string;
  ownerId: string;
}

/** Filter för år, sektion och produktägare samt val av vy (estimat, utfall, jämförelse). */
export function WorkToolbar({ years, sections, owners, sectionId, ownerId }: Props) {
  const { year, setYear, setSectionId, setOwnerId, view, setView } = useUiStore();
  const selectedSection = sections.find((section) => section.id === sectionId);

  return (
    <div className="toolbar">
      <div className="field">
        <span>År</span>
        <div className="year-picker">
          <button type="button" className="btn" aria-label="Föregående år" onClick={() => setYear(year - 1)}>
            ‹
          </button>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="År">
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button type="button" className="btn" aria-label="Nästa år" onClick={() => setYear(year + 1)}>
            ›
          </button>
        </div>
      </div>
      <label className="field">
        <span>Sektion</span>
        <select
          className="select filter-select"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          aria-label="Sektion"
        >
          <option value={ALL_SECTIONS}>Alla sektioner</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Produktägare</span>
        <select
          className="select filter-select"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          aria-label="Produktägare"
        >
          <option value={ALL_OWNERS}>{selectedSection ? `Alla i ${selectedSection.name}` : 'Alla produktägare'}</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field view-switch">
        <span id="view-switch-label">Visa</span>
        <div className="segmented" role="group" aria-labelledby="view-switch-label">
          {(Object.keys(VIEW_LABEL) as WorkView[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`view-${option}`}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {VIEW_LABEL[option]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
